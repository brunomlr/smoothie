/**
 * Base Repository
 *
 * Common functionality for all repositories.
 */

import { Pool as PgPool } from 'pg'
import { pool } from '../config'

export abstract class BaseRepository {
  protected get pool(): PgPool {
    if (!pool) {
      throw new Error('Database pool not initialized')
    }
    return pool
  }

  /**
   * Execute a query with error handling
   */
  protected async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params)
    return result.rows
  }

  /**
   * Execute a query that returns a single row
   */
  protected async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.pool.query(sql, params)
    return result.rows[0] ?? null
  }

  /**
   * Check if database is available
   */
  protected get isAvailable(): boolean {
    return pool !== null
  }
}
