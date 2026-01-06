import { pool } from './lib/db/config'

async function debug() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  console.log('=== Debugging Yield Calculation ===\n')

  // 1. Check current time
  const dateCheck = await pool.query(`
    SELECT
      CURRENT_TIMESTAMP AS now_utc,
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::text AS yesterday_la
  `, [tz])
  console.log('Current time (UTC):', dateCheck.rows[0].now_utc)
  console.log('Today (LA):', dateCheck.rows[0].today_la)
  console.log('Yesterday (LA):', dateCheck.rows[0].yesterday_la)

  // 2. Check all backstop events in recent days
  const recentEvents = await pool.query(`
    SELECT
      pool_address,
      action_type,
      ledger_closed_at as raw_ts,
      (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::date AS la_date,
      lp_tokens,
      shares
    FROM backstop_events
    WHERE pool_address IN ('CAJJZSGMPXBCW5FIRLMIFNXRQ6PZGMZ7FFCQD27QDMJFQYGQIVDILK6J', 'CCCCIQSDQSWHPFV46KBN4LWBBBLFBX4FD47YWDBVWLQMCV5S3HYZHQKC')
    ORDER BY ledger_closed_at DESC
    LIMIT 20
  `, [tz])

  console.log('\n=== Recent Backstop Events (all users) ===')
  recentEvents.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    console.log(`  ${r.la_date} | ${r.raw_ts} | ${poolShort} | ${r.action_type} | lp=${r.lp_tokens} | shares=${r.shares}`)
  })

  // 3. Get pool share rates at end of Jan 3, Jan 4, and latest
  const shareRates = await pool.query(`
    WITH pool_events AS (
      SELECT
        pool_address,
        ledger_closed_at as raw_ts,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::date AS la_date,
        CASE WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
             WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
             ELSE 0 END AS lp_change,
        CASE WHEN action_type = 'deposit' THEN shares::numeric
             WHEN action_type = 'withdraw' THEN -shares::numeric
             ELSE 0 END AS shares_change
      FROM backstop_events
      WHERE pool_address IN ('CAJJZSGMPXBCW5FIRLMIFNXRQ6PZGMZ7FFCQD27QDMJFQYGQIVDILK6J', 'CCCCIQSDQSWHPFV46KBN4LWBBBLFBX4FD47YWDBVWLQMCV5S3HYZHQKC')
    ),
    pool_cumulative AS (
      SELECT
        pool_address,
        raw_ts,
        la_date,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY raw_ts) AS pool_total_lp,
        SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY raw_ts) AS pool_total_shares
      FROM pool_events
    ),
    daily_rates AS (
      SELECT DISTINCT ON (pool_address, la_date)
        pool_address,
        la_date,
        pool_total_lp,
        pool_total_shares,
        CASE WHEN pool_total_shares > 0 THEN pool_total_lp / pool_total_shares ELSE 0 END as share_rate
      FROM pool_cumulative
      ORDER BY pool_address, la_date, raw_ts DESC
    )
    SELECT *
    FROM daily_rates
    WHERE la_date >= '2026-01-02'
    ORDER BY pool_address, la_date
  `, [tz])

  console.log('\n=== Pool Share Rates by Day (LA timezone) ===')
  let prevRates: Record<string, number> = {}
  shareRates.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    const rate = Number(r.share_rate)
    const prevRate = prevRates[r.pool_address] || rate
    const rateChange = rate - prevRate
    prevRates[r.pool_address] = rate
    console.log(`  ${r.la_date} | ${poolShort} | rate=${rate.toFixed(6)} | change=${rateChange.toFixed(6)} | pool_lp=${(Number(r.pool_total_lp)/1e7).toFixed(2)}`)
  })

  // 4. Calculate expected yield for each day
  console.log('\n=== Yield Calculation Per Day ===')
  const userShares = {
    'CAJJZSGM': 436097394033 / 1e7, // User shares scaled to LP units
    'CCCCIQSD': 155826610467 / 1e7,
  }

  const lpPrice = 2.80 // approximate LP price

  // Group rates by date
  const ratesByDate: Record<string, Record<string, number>> = {}
  shareRates.rows.forEach(r => {
    const date = r.la_date.toISOString().split('T')[0]
    if (!ratesByDate[date]) ratesByDate[date] = {}
    ratesByDate[date][r.pool_address.slice(0, 8)] = Number(r.share_rate)
  })

  const dates = Object.keys(ratesByDate).sort()
  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1]
    const currDate = dates[i]
    let totalYield = 0

    Object.entries(userShares).forEach(([pool, shares]) => {
      const prevRate = ratesByDate[prevDate]?.[pool] || 0
      const currRate = ratesByDate[currDate]?.[pool] || prevRate
      const lpYield = shares * (currRate - prevRate)
      const usdYield = lpYield * lpPrice
      totalYield += usdYield
      if (lpYield > 0) {
        console.log(`  ${currDate}: ${pool} yield = ${shares.toFixed(2)} shares × (${currRate.toFixed(6)} - ${prevRate.toFixed(6)}) = ${lpYield.toFixed(2)} LP = $${usdYield.toFixed(2)}`)
      }
    })
    console.log(`  ${currDate} TOTAL: $${totalYield.toFixed(2)}`)
    console.log('')
  }

  await pool!.end()
}

debug().catch(console.error)
