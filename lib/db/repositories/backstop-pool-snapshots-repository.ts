/**
 * Backstop Pool Snapshots Repository
 *
 * Handles queries for historical backstop pool Q4W data.
 */

import { BaseRepository } from './base-repository'

export interface Q4wHistoryPoint {
  date: string
  q4wPercent: number
}

export class BackstopPoolSnapshotsRepository extends BaseRepository {
  /**
   * Get historical Q4W percentage for a backstop pool.
   * Returns daily snapshots filtered by date range and timezone.
   * Forward-fills missing dates with the most recent available value.
   *
   * @param poolAddress - The pool address to query
   * @param days - Number of days of history to fetch
   * @param timezone - User timezone for date boundary calculation
   */
  async getQ4wHistory(
    poolAddress: string,
    days: number,
    timezone: string = 'UTC'
  ): Promise<Q4wHistoryPoint[]> {
    const rows = await this.query<{
      date: string
      q4w_pct: string | null
    }>(
      `
      WITH today_in_tz AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE $3)::date AS today
      ),
      date_range AS (
        SELECT generate_series(
          (SELECT today FROM today_in_tz) - $2::integer,
          (SELECT today FROM today_in_tz),
          '1 day'::interval
        )::date AS date
      ),
      available_snapshots AS (
        SELECT
          snapshot_date,
          q4w_pct
        FROM backstop_pool_snapshots
        WHERE pool_address = $1
          AND snapshot_date >= (SELECT today FROM today_in_tz) - $2::integer
        ORDER BY snapshot_date DESC
      )
      SELECT
        d.date::text as date,
        COALESCE(
          s.q4w_pct,
          -- Forward-fill: use most recent value before this date
          (
            SELECT q4w_pct
            FROM backstop_pool_snapshots
            WHERE pool_address = $1
              AND snapshot_date <= d.date
            ORDER BY snapshot_date DESC
            LIMIT 1
          )
        ) as q4w_pct
      FROM date_range d
      LEFT JOIN available_snapshots s ON s.snapshot_date = d.date
      WHERE d.date <= (SELECT today FROM today_in_tz)
      ORDER BY d.date ASC
      `,
      [poolAddress, days, timezone]
    )

    return rows
      .filter((row) => row.q4w_pct !== null)
      .map((row) => ({
        date: row.date,
        q4wPercent: parseFloat(row.q4w_pct!) || 0,
      }))
  }
}

// Export singleton instance
export const backstopPoolSnapshotsRepository = new BackstopPoolSnapshotsRepository()
