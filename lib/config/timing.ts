/**
 * Timing Configuration
 * Cache durations, refresh intervals, and timeouts
 */

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  /** Very short cache for real-time data (30 seconds) */
  REALTIME: 30 * 1000,
  /** Short cache for frequently updated data (2 minutes) */
  SHORT: 2 * 60 * 1000,
  /** Medium cache for balance history (5 minutes) */
  MEDIUM: 5 * 60 * 1000,
  /** Long cache for metadata (1 hour) */
  LONG: 60 * 60 * 1000,
  /** Extended cache for static data (24 hours) */
  STATIC: 24 * 60 * 60 * 1000,
} as const

// React Query stale times
export const STALE_TIMES = {
  /** Positions data (2 minutes) */
  POSITIONS: 2 * 60 * 1000,
  /** Balance history (5 minutes) */
  BALANCE_HISTORY: 5 * 60 * 1000,
  /** Metadata (1 hour) */
  METADATA: 60 * 60 * 1000,
  /** Prices (5 minutes) */
  PRICES: 5 * 60 * 1000,
  /** Historical prices (15 minutes) */
  HISTORICAL_PRICES: 15 * 60 * 1000,
} as const

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  /** Daily rates refresh (15 minutes) */
  RATES: 15 * 60 * 1000,
  /** Positions refresh (2 minutes) */
  POSITIONS: 2 * 60 * 1000,
  /** Wallet snapshot (30 seconds) */
  WALLET_SNAPSHOT: 30 * 1000,
} as const

// API timeouts (in milliseconds)
export const TIMEOUTS = {
  /** Default API timeout (30 seconds) */
  API_DEFAULT: 30 * 1000,
  /** Long-running query timeout (60 seconds) */
  API_LONG: 60 * 1000,
  /** RPC call timeout (15 seconds) */
  RPC: 15 * 1000,
} as const
