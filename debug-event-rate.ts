import { pool } from './lib/db/config'

async function debugEventRate() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'
  const poolId = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
  const assetAddress = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Event-Based Rate Lookup for Live Bar ===\n')

  // Get current dates in LA timezone
  const dates = await pool.query(`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::date AS yesterday_la,
      -- End of yesterday LA = start of today LA in UTC
      (((CURRENT_TIMESTAMP AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1 AT TIME ZONE 'UTC') AS end_of_yesterday_utc,
      CURRENT_TIMESTAMP AS now_utc
  `, [tz])

  const { today_la, yesterday_la, end_of_yesterday_utc, now_utc } = dates.rows[0]
  console.log(`Today LA: ${today_la}`)
  console.log(`Yesterday LA: ${yesterday_la}`)
  console.log(`End of yesterday LA (in UTC): ${end_of_yesterday_utc}`)
  console.log(`Now UTC: ${now_utc}`)

  // For the live bar starting point, we want the rate at "end of yesterday LA"
  // Option 1: Get the last event BEFORE end of yesterday LA (on or before midnight LA)
  const lastEventBeforeMidnight = await pool.query(`
    SELECT
      ledger_closed_at,
      (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date AS la_date,
      action_type,
      implied_rate,
      amount_tokens
    FROM parsed_events
    WHERE pool_id = $1
      AND asset_address = $2
      AND action_type IN ('supply', 'withdraw', 'supply_collateral', 'withdraw_collateral')
      AND implied_rate IS NOT NULL
      AND amount_tokens >= 1000000  -- Filter dust like daily_rates does
      AND ledger_closed_at <= $3::timestamp
    ORDER BY ledger_closed_at DESC
    LIMIT 3
  `, [poolId, assetAddress, end_of_yesterday_utc, tz])

  console.log(`\n=== Last Events BEFORE end of yesterday LA ===`)
  console.log('(These would be used for the live bar start)')
  lastEventBeforeMidnight.rows.forEach((r, i) => {
    const laDate = new Date(r.la_date).toISOString().split('T')[0]
    console.log(`  ${i === 0 ? '→' : ' '} ${r.ledger_closed_at} (LA: ${laDate}) | ${r.action_type} | rate=${r.implied_rate}`)
  })

  // Option 2: Get the last event ON yesterday LA date
  const lastEventOnYesterday = await pool.query(`
    SELECT
      ledger_closed_at,
      (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date AS la_date,
      action_type,
      implied_rate,
      amount_tokens
    FROM parsed_events
    WHERE pool_id = $1
      AND asset_address = $2
      AND action_type IN ('supply', 'withdraw', 'supply_collateral', 'withdraw_collateral')
      AND implied_rate IS NOT NULL
      AND amount_tokens >= 1000000
      AND (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date = $3::date
    ORDER BY ledger_closed_at DESC
    LIMIT 3
  `, [poolId, assetAddress, yesterday_la, tz])

  console.log(`\n=== Last Events ON yesterday LA (${yesterday_la}) ===`)
  lastEventOnYesterday.rows.forEach((r, i) => {
    console.log(`  ${i === 0 ? '→' : ' '} ${r.ledger_closed_at} | ${r.action_type} | rate=${r.implied_rate}`)
  })

  // Compare with daily_rates
  const dailyRate = await pool.query(`
    SELECT rate_date, b_rate
    FROM daily_rates
    WHERE pool_id = $1
      AND asset_address = $2
      AND rate_date <= $3::date
    ORDER BY rate_date DESC
    LIMIT 1
  `, [poolId, assetAddress, yesterday_la])

  console.log(`\n=== Current daily_rates lookup (rate_date <= yesterday_la) ===`)
  if (dailyRate.rows[0]) {
    console.log(`  rate_date: ${dailyRate.rows[0].rate_date}`)
    console.log(`  b_rate: ${dailyRate.rows[0].b_rate}`)
  }

  // Show the difference
  const eventRate = parseFloat(lastEventBeforeMidnight.rows[0]?.implied_rate || '0')
  const viewRate = parseFloat(dailyRate.rows[0]?.b_rate || '0')

  console.log(`\n=== Rate Comparison ===`)
  console.log(`  Event-based rate (before midnight): ${eventRate}`)
  console.log(`  daily_rates view rate: ${viewRate}`)
  console.log(`  Difference: ${((eventRate - viewRate) / viewRate * 100).toFixed(6)}%`)

  // Also check: what's the FIRST event of TODAY in LA timezone?
  const firstEventToday = await pool.query(`
    SELECT
      ledger_closed_at,
      (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date AS la_date,
      action_type,
      implied_rate
    FROM parsed_events
    WHERE pool_id = $1
      AND asset_address = $2
      AND action_type IN ('supply', 'withdraw', 'supply_collateral', 'withdraw_collateral')
      AND implied_rate IS NOT NULL
      AND amount_tokens >= 1000000
      AND (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $4)::date = $3::date
    ORDER BY ledger_closed_at ASC
    LIMIT 3
  `, [poolId, assetAddress, today_la, tz])

  console.log(`\n=== First Events ON today LA (${today_la}) ===`)
  console.log('(Live bar covers from end of yesterday to now)')
  firstEventToday.rows.forEach((r, i) => {
    console.log(`  ${r.ledger_closed_at} | ${r.action_type} | rate=${r.implied_rate}`)
  })

  await pool.end()
}

debugEventRate().catch(console.error)
