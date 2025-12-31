/**
 * Rates Repository
 *
 * Handles daily rates queries and materialized view refresh.
 */

import { BaseRepository } from './base-repository'
import type { DailyRate } from '../types'

export class RatesRepository extends BaseRepository {
  /**
   * Get daily rates for an asset
   */
  async getDailyRates(
    assetAddress: string,
    poolId?: string,
    days: number = 30
  ): Promise<DailyRate[]> {
    let whereClause = 'WHERE asset_address = $1 AND rate_date >= CURRENT_DATE - $2::integer'
    const params: (string | number)[] = [assetAddress, days]

    if (poolId) {
      whereClause += ' AND pool_id = $3'
      params.push(poolId)
    }

    const rows = await this.query<{
      pool_id: string
      asset_address: string
      rate_date: string
      b_rate: string | null
      d_rate: string | null
      rate_timestamp: string
      ledger_sequence: number
    }>(
      `
      SELECT
        pool_id,
        asset_address,
        rate_date::text,
        b_rate,
        d_rate,
        rate_timestamp::text,
        ledger_sequence
      FROM daily_rates
      ${whereClause}
      ORDER BY rate_date DESC
      `,
      params
    )

    return rows.map((row) => ({
      pool_id: row.pool_id,
      asset_address: row.asset_address,
      rate_date: row.rate_date,
      b_rate: row.b_rate ? parseFloat(row.b_rate) : null,
      d_rate: row.d_rate ? parseFloat(row.d_rate) : null,
      rate_timestamp: row.rate_timestamp,
      ledger_sequence: row.ledger_sequence,
    }))
  }

  /**
   * Refresh the daily_rates materialized view
   */
  async refreshDailyRates(): Promise<void> {
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_rates')
  }
}

// Export singleton instance
export const ratesRepository = new RatesRepository()
