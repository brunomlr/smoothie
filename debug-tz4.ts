import { pool } from './lib/db/config'

async function check() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Comparing Historical vs SDK Data ===\n')

  // Get what the API would see for Jan 5 historical data
  const jan5Historical = await pool.query(`
    WITH user_events AS (
      SELECT
        pool_address,
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS event_date,
        SUM(CASE WHEN action_type = 'deposit' THEN shares::numeric
                 WHEN action_type = 'withdraw' THEN -shares::numeric
                 ELSE 0 END) AS shares_change
      FROM backstop_events
      WHERE user_address = $1 AND pool_address IS NOT NULL
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
      WHERE pool_address IN (SELECT DISTINCT pool_address FROM backstop_events WHERE user_address = $1 AND pool_address IS NOT NULL)
      GROUP BY pool_address, (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    ),
    pool_cumulative AS (
      SELECT pool_address, event_date,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_lp,
        SUM(pool_shares_change) OVER (PARTITION BY pool_address ORDER BY event_date) AS total_shares
      FROM pool_events
    ),
    final AS (
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
    SELECT * FROM final WHERE date >= '2026-01-04' ORDER BY pool_address, date
  `, [userAddress, tz])

  console.log('Historical backstop positions (what API uses):')
  jan5Historical.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    const date = r.date.toISOString().split('T')[0]
    console.log(`  ${date} | ${poolShort} | shares=${(Number(r.user_shares)/1e7).toFixed(2)} | rate=${Number(r.share_rate).toFixed(6)} | lp_value=${(Number(r.lp_tokens_value)/1e7).toFixed(2)}`)
  })

  // Get the latest pool share rate (this is what SDK would show)
  const latestPoolRates = await pool.query(`
    WITH pool_events AS (
      SELECT
        pool_address,
        ledger_closed_at,
        CASE WHEN action_type IN ('deposit', 'donate') THEN lp_tokens::numeric
             WHEN action_type IN ('withdraw', 'draw') THEN -COALESCE(lp_tokens::numeric, 0)
             ELSE 0 END AS lp_change,
        CASE WHEN action_type = 'deposit' THEN shares::numeric
             WHEN action_type = 'withdraw' THEN -shares::numeric
             ELSE 0 END AS shares_change
      FROM backstop_events
      WHERE pool_address IN (SELECT DISTINCT pool_address FROM backstop_events WHERE user_address = $1 AND pool_address IS NOT NULL)
    ),
    pool_cumulative AS (
      SELECT pool_address, ledger_closed_at,
        SUM(lp_change) OVER (PARTITION BY pool_address ORDER BY ledger_closed_at) AS total_lp,
        SUM(shares_change) OVER (PARTITION BY pool_address ORDER BY ledger_closed_at) AS total_shares
      FROM pool_events
    ),
    latest AS (
      SELECT DISTINCT ON (pool_address)
        pool_address,
        ledger_closed_at,
        total_lp,
        total_shares,
        CASE WHEN total_shares > 0 THEN total_lp / total_shares ELSE 0 END as share_rate
      FROM pool_cumulative
      ORDER BY pool_address, ledger_closed_at DESC
    )
    SELECT * FROM latest
  `, [userAddress])

  console.log('\nLatest pool share rates (what SDK would reflect):')
  latestPoolRates.rows.forEach(r => {
    const poolShort = r.pool_address.slice(0, 8)
    console.log(`  ${poolShort} | rate=${Number(r.share_rate).toFixed(6)} | pool_lp=${(Number(r.total_lp)/1e7).toFixed(2)} | pool_shares=${(Number(r.total_shares)/1e7).toFixed(2)}`)
  })

  // Calculate the difference
  console.log('\n=== Yield Calculation Comparison ===')

  const lpPrice = 2.80 // approximate
  const jan4Positions: Record<string, { shares: number, rate: number, lp: number }> = {}

  // Get Jan 4 positions
  jan5Historical.rows.forEach(r => {
    const date = r.date.toISOString().split('T')[0]
    if (date === '2026-01-04') {
      jan4Positions[r.pool_address.slice(0, 8)] = {
        shares: Number(r.user_shares) / 1e7,
        rate: Number(r.share_rate),
        lp: Number(r.lp_tokens_value) / 1e7
      }
    }
  })

  console.log('\nJan 4 positions (start of live period):')
  Object.entries(jan4Positions).forEach(([pool, pos]) => {
    console.log(`  ${pool}: shares=${pos.shares.toFixed(2)}, rate=${pos.rate.toFixed(6)}, lp=${pos.lp.toFixed(2)}`)
  })

  // Calculate yield with historical end (Jan 5 = Jan 4 since no Jan 5 data)
  console.log('\nWith historical data (no SDK):')
  console.log('  End position = Jan 4 (same as start, no Jan 5 events)')
  console.log('  Yield from rate change = 0')

  // Calculate yield with SDK end
  console.log('\nWith SDK data (live):')
  let totalYield = 0
  latestPoolRates.rows.forEach(r => {
    const pool = r.pool_address.slice(0, 8)
    const jan4Pos = jan4Positions[pool]
    if (!jan4Pos) return

    const currentRate = Number(r.share_rate)
    const rateChange = currentRate - jan4Pos.rate

    // User LP at current rate = user_shares * current_rate
    const currentLp = jan4Pos.shares * currentRate
    const lpYield = currentLp - jan4Pos.lp
    const usdYield = lpYield * lpPrice

    console.log(`  ${pool}: rate change = ${rateChange.toFixed(6)}, LP yield = ${lpYield.toFixed(2)}, USD yield = $${usdYield.toFixed(2)}`)
    totalYield += usdYield
  })
  console.log(`  Total backstop yield with SDK: $${totalYield.toFixed(2)}`)

  await pool.end()
}
check().catch(console.error)
