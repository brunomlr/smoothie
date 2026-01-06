import { pool } from './lib/db/config'

async function check() {
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  console.log('=== Timezone Boundary Analysis ===\n')

  // What does "Jan 4 LA" mean in UTC?
  const boundaries = await pool.query(`
    SELECT
      '2026-01-04'::date AS la_date,
      ('2026-01-04'::date::timestamp AT TIME ZONE $1 AT TIME ZONE 'UTC') AS start_utc,
      (('2026-01-04'::date + 1)::timestamp AT TIME ZONE $1 AT TIME ZONE 'UTC') AS end_utc,
      CURRENT_TIMESTAMP AS now_utc,
      CURRENT_TIMESTAMP AT TIME ZONE $1 AS now_la
  `, [tz])

  const b = boundaries.rows[0]
  console.log('Historical "Jan 4 LA":')
  console.log(`  LA date: ${b.la_date}`)
  console.log(`  UTC start: ${b.start_utc} (Jan 4 00:00 LA = Jan 4 08:00 UTC)`)
  console.log(`  UTC end: ${b.end_utc} (Jan 5 00:00 LA = Jan 5 08:00 UTC)`)
  console.log('')
  console.log('Current time:')
  console.log(`  UTC: ${b.now_utc}`)
  console.log(`  LA: ${b.now_la}`)

  // Calculate time span
  const endOfJan4UTC = new Date(b.end_utc)
  const nowUTC = new Date(b.now_utc)
  const hoursFromJan4EndToNow = (nowUTC.getTime() - endOfJan4UTC.getTime()) / (1000 * 60 * 60)

  console.log('')
  console.log('=== Live Period Time Span ===')
  console.log(`From: End of Jan 4 LA (${b.end_utc})`)
  console.log(`To: Now (${b.now_utc})`)
  console.log(`Duration: ${hoursFromJan4EndToNow.toFixed(1)} hours = ${(hoursFromJan4EndToNow / 24).toFixed(2)} days`)

  // But historical data is based on LAST EVENT on that date, not midnight
  const lastPoolEventJan4 = await pool.query(`
    SELECT
      pool_address,
      MAX(ledger_closed_at) as last_event_utc,
      MAX(ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2) as last_event_la
    FROM backstop_events
    WHERE (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date = '2026-01-04'
      AND pool_address IN ('CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS')
    GROUP BY pool_address
  `, ['GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J', tz])

  console.log('')
  console.log('=== Last Pool Events on Jan 4 LA ===')
  lastPoolEventJan4.rows.forEach(r => {
    const pool = r.pool_address.slice(0, 8)
    console.log(`  ${pool}: ${r.last_event_utc} UTC = ${r.last_event_la} LA`)
  })

  // The ACTUAL historical data uses the cumulative state at end of each day
  // This is based on when events happened, not midnight boundaries
  console.log('')
  console.log('=== What Historical Query Returns ===')
  console.log('The historical backstop query returns cumulative values grouped by LA date.')
  console.log('The "Jan 4" value represents the pool state AFTER all events on Jan 4 LA.')
  console.log('')
  console.log('KEY INSIGHT:')
  console.log('- Historical "Jan 4 EOD" = state after last event on Jan 4 LA')
  console.log('- SDK "current" = state at current block')
  console.log('- If these use different time references, the live period could be longer/shorter')

  await pool.end()
}
check().catch(console.error)
