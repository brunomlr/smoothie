import { pool } from './lib/db/config'

async function check() {
  const userAddress = 'GDD7N6ACZHGW2ELKV267HLGYBPWOLW3R3RDP4CWOTVZQHOVNVBOKPT4J'
  const tz = 'America/Los_Angeles'

  if (!pool) {
    console.log('Pool is null')
    return
  }

  // Current time
  const now = await pool.query(`SELECT CURRENT_TIMESTAMP AT TIME ZONE $1 as now_la`, [tz])
  console.log('Now (LA):', now.rows[0].now_la)

  // Last event on each day (pool-level, not user-level)
  const lastEvents = await pool.query(`
    WITH events_by_date AS (
      SELECT
        (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS la_date,
        MAX(ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2) AS last_event_la
      FROM backstop_events
      WHERE pool_address IN (
        SELECT DISTINCT pool_address FROM backstop_events WHERE user_address = $1 AND pool_address IS NOT NULL
      )
      GROUP BY (ledger_closed_at AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
    )
    SELECT
      la_date,
      last_event_la,
      LEAD(last_event_la) OVER (ORDER BY la_date) as next_day_last_event,
      EXTRACT(EPOCH FROM (LEAD(last_event_la) OVER (ORDER BY la_date) - last_event_la)) / 3600 as hours_to_next
    FROM events_by_date
    WHERE la_date >= '2026-01-01'
    ORDER BY la_date
  `, [userAddress, tz])

  console.log('\n=== Time Between Last Events (LA time) ===')
  lastEvents.rows.forEach(r => {
    const date = r.la_date.toISOString().split('T')[0]
    const lastEventTime = r.last_event_la.toISOString().replace('T', ' ').slice(0, 19)
    const hours = r.hours_to_next ? Number(r.hours_to_next).toFixed(1) : 'N/A'
    console.log(`  ${date}: last event at ${lastEventTime} LA | hours to next day's last event: ${hours}h`)
  })

  // Calculate hours from Jan 4 last event to now
  const jan4Last = lastEvents.rows.find(r => r.la_date.toISOString().split('T')[0] === '2026-01-04')
  if (jan4Last) {
    const jan4LastTime = new Date(jan4Last.last_event_la)
    const nowTime = new Date(now.rows[0].now_la)
    const hoursDiff = (nowTime.getTime() - jan4LastTime.getTime()) / (1000 * 60 * 60)
    console.log(`\n=== Live Period Duration ===`)
    console.log(`Jan 4 last event (LA): ${jan4LastTime.toISOString()}`)
    console.log(`Now (LA): ${nowTime.toISOString()}`)
    console.log(`Hours difference: ${hoursDiff.toFixed(1)}h (${(hoursDiff/24).toFixed(2)} days)`)
    console.log(`Expected yield multiplier: ${(hoursDiff/24).toFixed(2)}x daily yield`)
    console.log(`If daily yield is ~$125, live should be: $${(125 * hoursDiff/24).toFixed(0)}`)
  }

  await pool.end()
}
check().catch(console.error)
