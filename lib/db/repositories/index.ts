/**
 * Database Repositories
 *
 * This module provides organized access to database operations through
 * focused repositories. Each repository handles a specific domain.
 *
 * For backwards compatibility, the original eventsRepository is still
 * exported and should be used for methods not yet migrated to new repositories.
 *
 * Usage:
 * ```typescript
 * import { db } from '@/lib/db/repositories'
 *
 * // Use focused repositories
 * const pools = await db.metadata.getPools()
 * const rates = await db.rates.getDailyRates(asset, pool, 30)
 *
 * // Or import individual repositories
 * import { metadataRepository } from '@/lib/db/repositories'
 * ```
 */

export { BaseRepository } from './base-repository'
export { MetadataRepository, metadataRepository } from './metadata-repository'
export { RatesRepository, ratesRepository } from './rates-repository'

// Aggregated database access
import { metadataRepository } from './metadata-repository'
import { ratesRepository } from './rates-repository'

/**
 * Aggregated database access
 *
 * Provides a single entry point for all repository operations.
 */
export const db = {
  metadata: metadataRepository,
  rates: ratesRepository,
  // Future repositories:
  // balance: balanceRepository,
  // actions: actionsRepository,
  // backstop: backstopRepository,
  // prices: pricesRepository,
} as const

// Type for the aggregated db object
export type Database = typeof db
