/**
 * Domain Types: Positions
 *
 * Consolidated position types used across the application.
 * Re-exports canonical types from lib/blend/positions and provides
 * simplified interfaces for component use.
 */

// Re-export canonical types from lib/blend
export type {
  BlendReservePosition,
  BlendBackstopPosition,
  BlendPoolEstimate,
  BlendWalletSnapshot,
  Q4WChunk,
} from '@/lib/blend/positions'

// Simplified position type for components that only need basic display data
export interface PositionDisplayData {
  id: string
  poolId: string
  poolName: string
  assetId?: string
  symbol?: string
  supplyAmount: number
  supplyUsdValue: number
  borrowAmount?: number
  borrowUsdValue?: number
  price?: { usdPrice?: number } | null
  supplyApy?: number
  borrowApy?: number
  blndApy?: number
}

// Simplified backstop position for display
export interface BackstopDisplayData {
  poolId: string
  poolName: string
  lpTokens: number
  lpTokensUsd: number
  interestApr: number
  emissionApy: number
  blndAmount?: number
  usdcAmount?: number
  q4wLpTokens?: number
  q4wLpTokensUsd?: number
  q4wExpiration?: number | null
  yieldPercent?: number
  costBasisLp?: number
  yieldLp?: number
  claimableBlnd?: number
}

// Supply position summary for supply-positions component
export interface SupplyPositionSummary {
  poolId: string
  poolName: string
  assetId: string
  symbol: string
  supplyAmount: number
  supplyUsdValue: number
  collateralAmount: number
  nonCollateralAmount: number
  supplyApy: number
  blndApy: number
  bRate?: number
  earnedYield?: number
  costBasis?: number
}

// Borrow position summary for borrow-positions component
export interface BorrowPositionSummary {
  poolId: string
  poolName: string
  assetId: string
  symbol: string
  borrowAmount: number
  borrowUsdValue: number
  borrowApy: number
  borrowBlndApy?: number
  dRate?: number
  accruedInterest?: number
  costBasis?: number
}

// Pool health/estimate for risk display
export interface PoolHealthData {
  poolId: string
  poolName: string
  borrowLimit: number // 0-1, higher = riskier
  borrowCap: number
  totalBorrowed: number
  totalEffectiveCollateral: number
  netApy: number
}

// Helper type to convert full position to display data
export function toPositionDisplay(
  position: import('@/lib/blend/positions').BlendReservePosition
): PositionDisplayData {
  return {
    id: position.id,
    poolId: position.poolId,
    poolName: position.poolName,
    assetId: position.assetId,
    symbol: position.symbol,
    supplyAmount: position.supplyAmount,
    supplyUsdValue: position.supplyUsdValue,
    borrowAmount: position.borrowAmount,
    borrowUsdValue: position.borrowUsdValue,
    price: position.price,
    supplyApy: position.supplyApy,
    borrowApy: position.borrowApy,
    blndApy: position.blndApy,
  }
}

// Helper type to convert full backstop position to display data
export function toBackstopDisplay(
  position: import('@/lib/blend/positions').BlendBackstopPosition
): BackstopDisplayData {
  return {
    poolId: position.poolId,
    poolName: position.poolName,
    lpTokens: position.lpTokens,
    lpTokensUsd: position.lpTokensUsd,
    interestApr: position.interestApr,
    emissionApy: position.emissionApy,
    blndAmount: position.blndAmount,
    usdcAmount: position.usdcAmount,
    q4wLpTokens: position.q4wLpTokens,
    q4wLpTokensUsd: position.q4wLpTokensUsd,
    q4wExpiration: position.q4wExpiration,
    yieldPercent: position.yieldPercent,
    costBasisLp: position.costBasisLp,
    yieldLp: position.yieldLp,
    claimableBlnd: position.claimableBlnd,
  }
}
