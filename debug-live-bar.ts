import { pool } from './lib/db/config'

async function debugLiveBar() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Live Bar Debug ===\n')

  // Get today and yesterday in LA
  const dates = await pool.query(`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::date AS yesterday_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 2)::date AS day_before_yesterday_la
  `, [tz])

  const { today_la, yesterday_la, day_before_yesterday_la } = dates.rows[0]
  console.log(`Today (LA): ${today_la}`)
  console.log(`Yesterday (LA): ${yesterday_la}`)
  console.log(`Day before yesterday (LA): ${day_before_yesterday_la}`)

  // The live bar for "today" compares:
  // - Start: end of yesterday (dayBeforeStr in pnl-change-chart)
  // - End: current SDK data
  //
  // For 1W view, there's also a "yesterday" bar that compares:
  // - Start: end of day before yesterday
  // - End: end of yesterday

  console.log('\n=== Backstop Position Analysis ===')

  // Get backstop positions for the last 3 days
  const backstopHistory = await pool.query(`
    WITH date_range AS (
      SELECT generate_series(
        (CURRENT_TIMESTAMP AT TIME ZONE $3)::date - 3,
        (CURRENT_TIMESTAMP AT TIME ZONE $3)::date,
        '1 day'::interval
      )::date AS date
    ),
    user_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $3)::date AS event_date,
        SUM(CASE
          WHEN action_type = 'deposit' THEN shares::numeric
          WHEN action_type = 'withdraw' THEN -shares::numeric
          ELSE 0
        END) AS shares_change
      FROM backstop_events
      WHERE user_address = $1
        AND pool_address = ANY($2)
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $3)::date
    ),
    user_cumulative AS (
      SELECT
        pool_address,
        event_date,
        SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS cumulative_shares
      FROM user_events
    ),
    pool_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $3)::date AS event_date,
        SUM(CASE
          WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
          WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
          ELSE 0
        END) AS lp_change,
        SUM(CASE
          WHEN action_type = 'deposit' THEN shares::numeric
          WHEN action_type = 'withdraw' THEN -shares::numeric
          ELSE 0
        END) AS shares_change
      FROM backstop_events
      WHERE pool_address = ANY($2)
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $3)::date
    ),
    pool_cumulative AS (
      SELECT
        pool_address,
        event_date,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_lp_tokens,
        SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_shares
      FROM pool_events
    )
    SELECT
      d.date AS la_date,
      p.pool_address,
      COALESCE(uc.cumulative_shares, 0) / 1e7 AS user_shares,
      COALESCE(pc.total_lp_tokens, 0) / 1e7 AS pool_lp,
      COALESCE(pc.total_shares, 0) / 1e7 AS pool_shares,
      CASE
        WHEN COALESCE(pc.total_shares, 0) > 0
        THEN COALESCE(pc.total_lp_tokens, 0) / pc.total_shares
        ELSE 0
      END AS share_rate,
      CASE
        WHEN COALESCE(pc.total_shares, 0) > 0
        THEN (COALESCE(uc.cumulative_shares, 0) / 1e7) *
             (COALESCE(pc.total_lp_tokens, 0) / COALESCE(pc.total_shares, 1))
        ELSE 0
      END AS lp_tokens_value
    FROM date_range d
    CROSS JOIN (SELECT DISTINCT pool_address FROM backstop_events WHERE user_address = $1 AND pool_address IS NOT NULL) p
    LEFT JOIN LATERAL (
      SELECT cumulative_shares
      FROM user_cumulative uc_inner
      WHERE uc_inner.pool_address = p.pool_address
        AND uc_inner.event_date <= d.date
      ORDER BY uc_inner.event_date DESC
      LIMIT 1
    ) uc ON true
    LEFT JOIN LATERAL (
      SELECT total_lp_tokens, total_shares
      FROM pool_cumulative pc_inner
      WHERE pc_inner.pool_address = p.pool_address
        AND pc_inner.event_date <= d.date
      ORDER BY pc_inner.event_date DESC
      LIMIT 1
    ) pc ON true
    WHERE COALESCE(uc.cumulative_shares, 0) > 0
    ORDER BY p.pool_address, d.date
  `, [userAddress, ['CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS'], tz])

  // Group by pool
  const byPool: Record<string, any[]> = {}
  backstopHistory.rows.forEach(r => {
    const pool = r.pool_address.slice(0, 8)
    if (!byPool[pool]) byPool[pool] = []
    byPool[pool].push(r)
  })

  const lpPrice = 2.80 // approximate

  Object.entries(byPool).forEach(([poolShort, rows]) => {
    console.log(`\n${poolShort}:`)
    console.log('  LA Date | User Shares | Pool LP | Pool Shares | Share Rate | LP Value')
    console.log('  --------|-------------|---------|-------------|------------|----------')

    rows.forEach(r => {
      const date = new Date(r.la_date).toISOString().split('T')[0]
      console.log(`  ${date} | ${Number(r.user_shares).toFixed(2).padStart(11)} | ${Number(r.pool_lp).toFixed(2).padStart(7)} | ${Number(r.pool_shares).toFixed(2).padStart(11)} | ${Number(r.share_rate).toFixed(6)} | ${Number(r.lp_tokens_value).toFixed(2)}`)
    })
  })

  // Calculate what the yield should be for "yesterday" bar (day_before_yesterday -> yesterday)
  console.log('\n=== Expected Yield for Yesterday Bar ===')
  console.log(`Period: ${day_before_yesterday_la} -> ${yesterday_la}`)

  let yesterdayYieldTotal = 0
  Object.entries(byPool).forEach(([poolShort, rows]) => {
    const startRow = rows.find(r => new Date(r.la_date).toISOString().split('T')[0] === new Date(day_before_yesterday_la).toISOString().split('T')[0])
    const endRow = rows.find(r => new Date(r.la_date).toISOString().split('T')[0] === new Date(yesterday_la).toISOString().split('T')[0])

    if (startRow && endRow) {
      const shareRateStart = Number(startRow.share_rate)
      const shareRateEnd = Number(endRow.share_rate)
      const userShares = Number(startRow.user_shares) // shares at start

      const yieldLp = userShares * (shareRateEnd - shareRateStart)
      const yieldUsd = yieldLp * lpPrice

      console.log(`  ${poolShort}: shares=${userShares.toFixed(2)}, rate ${shareRateStart.toFixed(6)} -> ${shareRateEnd.toFixed(6)}, yield=${yieldLp.toFixed(4)} LP = $${yieldUsd.toFixed(2)}`)
      yesterdayYieldTotal += yieldUsd
    }
  })
  console.log(`  TOTAL: $${yesterdayYieldTotal.toFixed(2)}`)

  // Calculate what the yield should be for "today" (live) bar (yesterday -> today)
  console.log('\n=== Expected Yield for Live Bar ===')
  console.log(`Period: ${yesterday_la} -> ${today_la} (current)`)

  let liveYieldTotal = 0
  Object.entries(byPool).forEach(([poolShort, rows]) => {
    const startRow = rows.find(r => new Date(r.la_date).toISOString().split('T')[0] === new Date(yesterday_la).toISOString().split('T')[0])
    const endRow = rows.find(r => new Date(r.la_date).toISOString().split('T')[0] === new Date(today_la).toISOString().split('T')[0])

    if (startRow && endRow) {
      const shareRateStart = Number(startRow.share_rate)
      const shareRateEnd = Number(endRow.share_rate)
      const userShares = Number(startRow.user_shares) // shares at start

      const yieldLp = userShares * (shareRateEnd - shareRateStart)
      const yieldUsd = yieldLp * lpPrice

      console.log(`  ${poolShort}: shares=${userShares.toFixed(2)}, rate ${shareRateStart.toFixed(6)} -> ${shareRateEnd.toFixed(6)}, yield=${yieldLp.toFixed(4)} LP = $${yieldUsd.toFixed(2)}`)
      liveYieldTotal += yieldUsd
    }
  })
  console.log(`  TOTAL: $${liveYieldTotal.toFixed(2)}`)

  // What if we look at the RAW events to see when things happened?
  console.log('\n=== Recent Backstop Events (Last 5) ===')
  const recentEvents = await pool.query(`
    SELECT
      pool_address,
      action_type,
      shares / 1e7 as shares,
      lp_tokens / 1e7 as lp_tokens,
      ledger_closed_at,
      (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS la_date,
      DATE(ledger_closed_at) AS utc_date
    FROM backstop_events
    WHERE pool_address = ANY($1)
    ORDER BY ledger_closed_at DESC
    LIMIT 5
  `, [['CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS'], tz])

  console.log('Pool     | Action   | Shares | LP Tokens | UTC Time           | LA Date | UTC Date')
  console.log('---------|----------|--------|-----------|-------------------|---------|----------')
  recentEvents.rows.forEach(r => {
    const pool = r.pool_address.slice(0, 8)
    const laDate = new Date(r.la_date).toISOString().split('T')[0]
    const utcDate = new Date(r.utc_date).toISOString().split('T')[0]
    console.log(`${pool} | ${r.action_type.padEnd(8)} | ${Number(r.shares).toFixed(2).padStart(6)} | ${Number(r.lp_tokens).toFixed(2).padStart(9)} | ${r.ledger_closed_at} | ${laDate} | ${utcDate}`)
  })

  await pool.end()
}

debugLiveBar().catch(console.error)
