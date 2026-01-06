import { pool } from './lib/db/config'

async function debugRateFix() {
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Rate Lookup Fix Verification ===\n')

  // Get current dates
  const dates = await pool.query(`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today_la,
      ((CURRENT_TIMESTAMP AT TIME ZONE $1)::date - 1)::date AS yesterday_la
  `, [tz])

  const { today_la, yesterday_la } = dates.rows[0]
  console.log(`Today LA: ${today_la}`)
  console.log(`Yesterday LA: ${yesterday_la}`)

  // OLD rate lookup: rate_date <= la_date (broken)
  const oldLookup = await pool.query(`
    SELECT
      $1::date AS la_date,
      (SELECT rate_date FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= $1::date
       ORDER BY rate_date DESC LIMIT 1) AS old_rate_date,
      (SELECT b_rate FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= $1::date
       ORDER BY rate_date DESC LIMIT 1) AS old_b_rate
  `, [yesterday_la])

  // NEW rate lookup: rate_date <= UTC date of end of LA day (fixed)
  const newLookup = await pool.query(`
    SELECT
      $1::date AS la_date,
      (($1::date + interval '1 day')::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC')::date AS utc_at_la_midnight,
      (SELECT rate_date FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= (($1::date + interval '1 day')::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC')::date
       ORDER BY rate_date DESC LIMIT 1) AS new_rate_date,
      (SELECT b_rate FROM daily_rates
       WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
         AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
         AND rate_date <= (($1::date + interval '1 day')::timestamp AT TIME ZONE $2 AT TIME ZONE 'UTC')::date
       ORDER BY rate_date DESC LIMIT 1) AS new_b_rate
  `, [yesterday_la, tz])

  const old = oldLookup.rows[0]
  const newR = newLookup.rows[0]

  console.log(`\nFor LA date: ${yesterday_la}`)
  console.log(`\nOLD lookup (broken):`)
  console.log(`  rate_date <= '${yesterday_la}'`)
  console.log(`  -> Uses rate from: ${old.old_rate_date}`)
  console.log(`  -> b_rate: ${old.old_b_rate}`)

  console.log(`\nNEW lookup (fixed):`)
  console.log(`  UTC at end of LA day: ${newR.utc_at_la_midnight}`)
  console.log(`  rate_date <= '${newR.utc_at_la_midnight}'`)
  console.log(`  -> Uses rate from: ${newR.new_rate_date}`)
  console.log(`  -> b_rate: ${newR.new_b_rate}`)

  // Show all recent rates for context
  console.log(`\n=== Recent Rates (for context) ===`)
  const rates = await pool.query(`
    SELECT rate_date, b_rate
    FROM daily_rates
    WHERE pool_id = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
      AND asset_address = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
    ORDER BY rate_date DESC
    LIMIT 5
  `)

  rates.rows.forEach(r => {
    const isOld = r.rate_date.toISOString().split('T')[0] === old.old_rate_date?.toISOString().split('T')[0]
    const isNew = r.rate_date.toISOString().split('T')[0] === newR.new_rate_date?.toISOString().split('T')[0]
    const marker = isNew ? ' <- NEW' : isOld ? ' <- OLD' : ''
    console.log(`  ${r.rate_date}: ${r.b_rate}${marker}`)
  })

  await pool.end()
}

debugRateFix().catch(console.error)
