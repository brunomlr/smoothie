import { pool } from './lib/db/config'

async function debug() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  // Check today's date in LA vs UTC
  const dateCheck = await pool.query(`
    SELECT
      CURRENT_TIMESTAMP AS now_utc,
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::text AS yesterday_la
  `, [tz])

  console.log('Date check:', dateCheck.rows[0])
  console.log('\nFor live period:')
  console.log('  boundary.start = today_la =', dateCheck.rows[0].today_la)
  console.log('  dayBeforeStr = yesterday_la =', dateCheck.rows[0].yesterday_la)

  // Check the LATEST pool share rate in the database (not user-specific)
  const latestPoolState = await pool.query(`
    WITH pool_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::date AS event_date,
        ledger_closed_at as raw_ts,
        SUM(CASE WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
                 WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
                 ELSE 0 END) AS lp_change,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS pool_shares_change
      FROM backstop_events
      WHERE pool_address IN ('CAJJZSGMPXBCW5FIRLMIFNXRQ6PZGMZ7FFCQD27QDMJFQYGQIVDILK6J', 'CCCCIQSDQSWHPFV46KBN4LWBBBLFBX4FD47YWDBVWLQMCV5S3HYZHQKC')
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::date, ledger_closed_at
    ),
    pool_cumulative AS (
      SELECT pool_address, event_date, raw_ts,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY raw_ts) AS total_lp,
        SUM(pool_shares_change) OVER (PARTITION BY pool_address ORDER BY raw_ts) AS total_shares
      FROM pool_events
    )
    SELECT
      pool_address,
      event_date,
      raw_ts,
      total_lp,
      total_shares,
      CASE WHEN total_shares > 0 THEN total_lp / total_shares ELSE 0 END as share_rate
    FROM pool_cumulative
    WHERE event_date >= '2026-01-04'
    ORDER BY pool_address, raw_ts DESC
    LIMIT 10
  `, [tz])

  console.log('\n--- Latest pool share rates in DB ---')
  latestPoolState.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    console.log(`  ${r.event_date} (raw: ${r.raw_ts}): pool=${poolShort}, rate=${Number(r.share_rate).toFixed(6)}, total_lp=${Number(r.total_lp).toFixed(2)}`)
  })

  // Get backstop balance by date (LA) - see what positions exist on which days
  const backstopHistory = await pool.query(`
    WITH user_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS shares_change
      FROM backstop_events
      WHERE user_address = $1
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    ),
    cumulative AS (
      SELECT pool_address, event_date, SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS cumulative_shares
      FROM user_events
    ),
    pool_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
        SUM(CASE WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
                 WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
                 ELSE 0 END) AS lp_change,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS pool_shares_change
      FROM backstop_events
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    ),
    pool_cumulative AS (
      SELECT pool_address, event_date,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_lp,
        SUM(pool_shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_shares
      FROM pool_events
    )
    SELECT
      c.pool_address,
      c.event_date,
      c.cumulative_shares as user_shares,
      pc.total_lp as pool_lp,
      pc.total_shares as pool_shares,
      CASE WHEN pc.total_shares > 0 THEN pc.total_lp / pc.total_shares ELSE 0 END as share_rate,
      c.cumulative_shares * (CASE WHEN pc.total_shares > 0 THEN pc.total_lp / pc.total_shares ELSE 0 END) as user_lp_value
    FROM cumulative c
    JOIN pool_cumulative pc ON c.pool_address = pc.pool_address AND c.event_date = pc.event_date
    WHERE c.event_date >= '2026-01-03'
    ORDER BY c.pool_address, c.event_date
  `, [userAddress, tz])

  console.log('\nBackstop positions by date (LA timezone):')
  backstopHistory.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    console.log(`  ${r.event_date}: pool=${poolShort}, user_shares=${Number(r.user_shares).toFixed(2)}, share_rate=${Number(r.share_rate).toFixed(6)}, user_lp=${Number(r.user_lp_value).toFixed(2)}`)
  })

  // Check what happens when we look up Jan 4 position (what API would get)
  console.log('\n--- What API gets for dayBeforeStr = 2026-01-04 ---')
  const jan4Position = await pool.query(`
    WITH user_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS shares_change
      FROM backstop_events
      WHERE user_address = $1
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    ),
    cumulative AS (
      SELECT pool_address, event_date, SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS cumulative_shares
      FROM user_events
    ),
    pool_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
        SUM(CASE WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
                 WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
                 ELSE 0 END) AS lp_change,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS pool_shares_change
      FROM backstop_events
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    ),
    pool_cumulative AS (
      SELECT pool_address, event_date,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_lp,
        SUM(pool_shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_shares
      FROM pool_events
    ),
    final_balances AS (
      SELECT
        c.pool_address,
        c.event_date as date,
        c.cumulative_shares as user_shares,
        pc.total_lp as pool_lp,
        pc.total_shares as pool_shares,
        CASE WHEN pc.total_shares > 0 THEN pc.total_lp / pc.total_shares ELSE 0 END as share_rate,
        c.cumulative_shares * (CASE WHEN pc.total_shares > 0 THEN pc.total_lp / pc.total_shares ELSE 0 END) as lp_tokens_value
      FROM cumulative c
      JOIN pool_cumulative pc ON c.pool_address = pc.pool_address AND c.event_date = pc.event_date
    )
    SELECT pool_address, date, user_shares, share_rate, lp_tokens_value
    FROM final_balances
    WHERE date <= '2026-01-04'
    ORDER BY pool_address, date DESC
  `, [userAddress, tz])

  // Group by pool and take the latest for each
  const poolPositions = new Map()
  jan4Position.rows.forEach(r => {
    if (!poolPositions.has(r.pool_address)) {
      poolPositions.set(r.pool_address, r)
    }
  })

  console.log('Position at end of Jan 4 (LA) - used as START for live period:')
  poolPositions.forEach((r, pool) => {
    console.log(`  ${pool.slice(0,8)}: shares=${Number(r.user_shares).toFixed(2)}, rate=${Number(r.share_rate).toFixed(6)}, lp=${Number(r.lp_tokens_value).toFixed(2)}`)
  })

  await pool.end()
}

debug().catch(console.error)
