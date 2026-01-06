import { pool } from './lib/db/config'

async function debugRateLookup() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Rate Lookup Debug ===\n')

  // What is "today" and "yesterday" in LA timezone?
  const todayResult = await pool.query(`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::date AS yesterday_la,
      CURRENT_TIMESTAMP AS now_utc,
      CURRENT_TIMESTAMP AT TIME ZONE $1 AS now_la
  `, [tz])

  const t = todayResult.rows[0]
  console.log('Current time:')
  console.log(`  UTC: ${t.now_utc}`)
  console.log(`  LA:  ${t.now_la}`)
  console.log(`  Today LA: ${t.today_la}`)
  console.log(`  Yesterday LA: ${t.yesterday_la}`)

  // What UTC time range does "yesterday LA" cover?
  const yesterdayBounds = await pool.query(`
    SELECT
      $1::date AS la_date,
      ($1::date::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC') AS start_utc,
      (($1::date + 1)::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC') AS end_utc
  `, [t.yesterday_la, tz])

  const yb = yesterdayBounds.rows[0]
  console.log(`\n"${yb.la_date}" LA spans:`)
  console.log(`  UTC start: ${yb.start_utc}`)
  console.log(`  UTC end:   ${yb.end_utc}`)

  // What rate does the CURRENT query return for "yesterday LA"?
  // This simulates what getBalanceHistoryFromEvents does
  const currentRateLookup = await pool.query(`
    SELECT
      rate_date,
      b_rate,
      d_rate
    FROM daily_rates
    WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
      AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
      AND rate_date <= $1
    ORDER BY rate_date DESC
    LIMIT 3
  `, [t.yesterday_la])

  console.log(`\nCurrent rate lookup (rate_date <= '${t.yesterday_la}'):`)
  currentRateLookup.rows.forEach((r, i) => {
    console.log(`  ${i === 0 ? '→' : ' '} ${r.rate_date}: b_rate=${r.b_rate}`)
  })

  // What rate SHOULD we get for "end of yesterday LA"?
  // End of yesterday LA = start of today LA = some UTC time on "today UTC" or "yesterday UTC"
  const correctRateLookup = await pool.query(`
    WITH end_of_la_day AS (
      SELECT
        (($1::date + 1)::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC')::date AS utc_date_at_la_midnight
    )
    SELECT
      rate_date,
      b_rate,
      d_rate,
      (SELECT utc_date_at_la_midnight FROM end_of_la_day) AS target_utc_date
    FROM daily_rates
    WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
      AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
      AND rate_date <= (SELECT utc_date_at_la_midnight FROM end_of_la_day)
    ORDER BY rate_date DESC
    LIMIT 3
  `, [t.yesterday_la, tz])

  console.log(`\nCorrected rate lookup (end of "${t.yesterday_la}" LA = UTC ${correctRateLookup.rows[0]?.target_utc_date}):`)
  correctRateLookup.rows.forEach((r, i) => {
    console.log(`  ${i === 0 ? '→' : ' '} ${r.rate_date}: b_rate=${r.b_rate}`)
  })

  // Calculate the rate difference
  const currentRate = parseFloat(currentRateLookup.rows[0]?.b_rate || '0')
  const correctRate = parseFloat(correctRateLookup.rows[0]?.b_rate || '0')
  const rateDiff = ((correctRate - currentRate) / currentRate * 100).toFixed(6)

  console.log(`\nRate difference:`)
  console.log(`  Current lookup: ${currentRate}`)
  console.log(`  Correct lookup: ${correctRate}`)
  console.log(`  Difference: ${rateDiff}%`)

  // Show all rates for the last few days to see the pattern
  console.log(`\n=== Recent Rates (last 5 days UTC) ===`)
  const recentRates = await pool.query(`
    SELECT
      rate_date,
      b_rate,
      d_rate
    FROM daily_rates
    WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
      AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
    ORDER BY rate_date DESC
    LIMIT 5
  `)

  recentRates.rows.forEach(r => {
    console.log(`  ${r.rate_date}: b_rate=${r.b_rate}`)
  })

  // What's the actual balance history data?
  console.log(`\n=== Balance History Check ===`)
  const balanceHistory = await pool.query(`
    WITH date_range AS (
      SELECT generate_series(
        (CURRENT_TIMESTAMP AT TIME ZONE $3)::date - 3,
        (CURRENT_TIMESTAMP AT TIME ZONE $3)::date,
        '1 day'::interval
      )::date AS date
    )
    SELECT
      d.date AS la_date,
      (SELECT rate_date FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= d.date
       ORDER BY rate_date DESC LIMIT 1) AS rate_used_utc,
      (SELECT b_rate FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= d.date
       ORDER BY rate_date DESC LIMIT 1) AS b_rate,
      -- What rate SHOULD be used (UTC date at end of LA day)
      (SELECT rate_date FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= ((d.date + 1)::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC')::date
       ORDER BY rate_date DESC LIMIT 1) AS rate_should_use_utc,
      (SELECT b_rate FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= ((d.date + 1)::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC')::date
       ORDER BY rate_date DESC LIMIT 1) AS b_rate_should_use
    FROM date_range d
    ORDER BY d.date DESC
  `, [userAddress, 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', tz])

  console.log('LA Date | Rate Used (UTC) | b_rate | Should Use (UTC) | Correct b_rate')
  console.log('--------|-----------------|--------|------------------|---------------')
  balanceHistory.rows.forEach(r => {
    const diff = r.b_rate !== r.b_rate_should_use ? ' ← DIFF!' : ''
    console.log(`${r.la_date} | ${r.rate_used_utc} | ${r.b_rate?.substring(0, 12)} | ${r.rate_should_use_utc} | ${r.b_rate_should_use?.substring(0, 12)}${diff}`)
  })

  await pool.end()
}

debugRateLookup().catch(console.error)
