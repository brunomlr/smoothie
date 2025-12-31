/**
 * Metadata Repository
 *
 * Handles pool and token metadata queries.
 */

import { BaseRepository } from './base-repository'
import type { Pool, Token } from '../types'

export class MetadataRepository extends BaseRepository {
  /**
   * Get all pools metadata
   */
  async getPools(): Promise<Pool[]> {
    const rows = await this.query<Pool & { version: string }>(
      `
      SELECT pool_id, name, short_name, description, icon_url, website_url, is_active, version
      FROM pools
      WHERE is_active = true
      ORDER BY name
      `
    )

    return rows.map((row) => ({
      ...row,
      version: parseInt(row.version, 10),
    }))
  }

  /**
   * Get all tokens metadata
   */
  async getTokens(): Promise<Token[]> {
    const rows = await this.query<Token & { decimals: string }>(
      `
      SELECT asset_address, symbol, name, decimals, icon_url, coingecko_id, is_native, pegged_currency
      FROM tokens
      ORDER BY symbol
      `
    )

    return rows.map((row) => ({
      ...row,
      decimals: parseInt(row.decimals),
      pegged_currency: row.pegged_currency || null,
    }))
  }

  /**
   * Get a single token by address
   */
  async getToken(assetAddress: string): Promise<Token | null> {
    const row = await this.queryOne<Token & { decimals: string }>(
      `
      SELECT asset_address, symbol, name, decimals, icon_url, coingecko_id, is_native, pegged_currency
      FROM tokens
      WHERE asset_address = $1
      `,
      [assetAddress]
    )

    if (!row) return null

    return {
      ...row,
      decimals: parseInt(row.decimals),
      pegged_currency: row.pegged_currency || null,
    }
  }

  /**
   * Get a single pool by ID
   */
  async getPool(poolId: string): Promise<Pool | null> {
    return this.queryOne<Pool>(
      `
      SELECT pool_id, name, short_name, description, icon_url, website_url, is_active
      FROM pools
      WHERE pool_id = $1
      `,
      [poolId]
    )
  }
}

// Export singleton instance
export const metadataRepository = new MetadataRepository()
