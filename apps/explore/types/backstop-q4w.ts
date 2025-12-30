// Q4W Position status
export type Q4WStatus = 'unlocked' | 'locked'

// Aggregated Q4W position per user-pool combination
export interface AggregatedQ4WPosition {
  userAddress: string
  poolAddress: string
  poolName: string | null
  poolShortName: string | null
  lockedShares: number
  lockedLpTokens: number
  lockedLpTokensUsd: number
  unlockedShares: number
  unlockedLpTokens: number
  unlockedLpTokensUsd: number
  totalShares: number
  totalLpTokens: number
  totalLpTokensUsd: number
  earliestUnlock: number | null // Unix timestamp for earliest locked position
  hasUnlocked: boolean // True if any positions are unlocked
}

// Summary metrics for the Q4W page
export interface Q4WSummary {
  totalUsers: number
  totalLpTokensLocked: number
  totalLpTokensLockedUsd: number
  totalLpTokensUnlocked: number
  totalLpTokensUnlockedUsd: number
  totalLpTokens: number
  totalLpTokensUsd: number
}

// Filter state for the Q4W page
export interface Q4WFilterState {
  poolAddress?: string
  status: 'all' | 'unlocked' | 'locked'
  orderBy: 'unlock_time' | 'lp_tokens'
  orderDir: 'asc' | 'desc'
}

// API response
export interface Q4WResponse {
  results: AggregatedQ4WPosition[]
  summary: Q4WSummary
  totalCount: number
  currentTimestamp: number // Server's current unix timestamp for consistent status calculation
}

// Pool with Q4W activity
export interface Q4WPool {
  poolAddress: string
  poolName: string | null
}
