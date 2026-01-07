/**
 * Pool Snapshots Repository
 *
 * Handles queries for historical pool TVL and borrow data.
 */

import { BaseRepository } from './base-repository'

export interface PoolTvlHistoryPoint {
  poolId: string
  date: string
  tvlUsd: number
  borrowedUsd: number
}

export class PoolSnapshotsRepository extends BaseRepository {
  /**
   * Get historical TVL and borrowed amounts for all pools.
   * Aggregates by pool and date, joining with daily prices for USD conversion.
   *
   * Formula:
   * - TVL (USD) = b_supply * b_rate * usd_price
   * - Borrowed (USD) = d_supply * d_rate * usd_price
   */
  async getPoolTvlHistory(days?: number): Promise<PoolTvlHistoryPoint[]> {
    // If days is provided, filter by date range; otherwise get all data
    const whereClause = days ? 'WHERE ps.snapshot_date >= CURRENT_DATE - $1::integer' : ''
    const params = days ? [days] : []

    const rows = await this.query<{
      pool_id: string
      snapshot_date: string
      tvl_usd: string
      borrowed_usd: string
    }>(
      `
      SELECT
        ps.pool_id,
        ps.snapshot_date::text,
        COALESCE(SUM(ps.b_supply * ps.b_rate * COALESCE(dtp.usd_price, 0)), 0) as tvl_usd,
        COALESCE(SUM(ps.d_supply * ps.d_rate * COALESCE(dtp.usd_price, 0)), 0) as borrowed_usd
      FROM pool_snapshots ps
      LEFT JOIN daily_token_prices dtp
        ON ps.asset_address = dtp.token_address
        AND ps.snapshot_date = dtp.price_date
      ${whereClause}
      GROUP BY ps.pool_id, ps.snapshot_date
      ORDER BY ps.pool_id, ps.snapshot_date
      `,
      params
    )

    return rows.map((row) => ({
      poolId: row.pool_id,
      date: row.snapshot_date,
      tvlUsd: parseFloat(row.tvl_usd) || 0,
      borrowedUsd: parseFloat(row.borrowed_usd) || 0,
    }))
  }
}

// Export singleton instance
export const poolSnapshotsRepository = new PoolSnapshotsRepository()
