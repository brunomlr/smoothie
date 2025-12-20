import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { calculateHistoricalYieldBreakdown, HistoricalYieldBreakdown } from '@/lib/balance-history-utils'

export interface AssetYieldBreakdown extends HistoricalYieldBreakdown {
  assetAddress: string
  poolId: string
  assetSymbol?: string
}

export interface CostBasisHistoricalResponse {
  byAsset: Record<string, AssetYieldBreakdown>  // compositeKey (poolId-assetAddress) -> breakdown
  totalCostBasisHistorical: number
  totalProtocolYieldUsd: number
  totalPriceChangeUsd: number
  totalEarnedUsd: number
}

/**
 * GET /api/cost-basis-historical
 *
 * Returns yield breakdown with historical prices for all user positions.
 *
 * Query params:
 * - userAddress: The user's wallet address
 * - sdkPrices: JSON object mapping asset addresses to current SDK prices (for current value calculation)
 *
 * Returns cost basis calculated using deposit-time prices from daily_token_prices.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userAddress = searchParams.get('userAddress')
  const sdkPricesParam = searchParams.get('sdkPrices')

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing required parameter: userAddress' },
      { status: 400 }
    )
  }

  // Parse SDK prices (current prices from SDK for calculating current value)
  let sdkPrices: Record<string, number> = {}
  if (sdkPricesParam) {
    try {
      sdkPrices = JSON.parse(sdkPricesParam)
    } catch {
      console.warn('[Cost Basis Historical API] Failed to parse sdkPrices')
    }
  }

  try {
    // Get all unique assets the user has interacted with
    const userActions = await eventsRepository.getUserActions(userAddress, {
      actionTypes: ['supply', 'supply_collateral', 'withdraw', 'withdraw_collateral'],
      limit: 1000,
    })

    // Group actions by pool-asset
    const poolAssetPairs = new Map<string, { poolId: string; assetAddress: string }>()
    for (const action of userActions) {
      if (!action.pool_id || !action.asset_address) continue
      const compositeKey = `${action.pool_id}-${action.asset_address}`
      if (!poolAssetPairs.has(compositeKey)) {
        poolAssetPairs.set(compositeKey, {
          poolId: action.pool_id,
          assetAddress: action.asset_address,
        })
      }
    }

    const byAsset: Record<string, AssetYieldBreakdown> = {}
    let totalCostBasisHistorical = 0
    let totalProtocolYieldUsd = 0
    let totalPriceChangeUsd = 0
    let totalEarnedUsd = 0

    // Calculate breakdown for each pool-asset pair
    for (const [compositeKey, { poolId, assetAddress }] of poolAssetPairs) {
      const sdkPrice = sdkPrices[assetAddress] || 0

      // Get deposit/withdrawal events with historical prices
      const { deposits, withdrawals } = await eventsRepository.getDepositEventsWithPrices(
        userAddress,
        assetAddress,
        poolId,
        sdkPrice
      )

      // Skip if no events
      if (deposits.length === 0 && withdrawals.length === 0) continue

      // Calculate using AVERAGE COST METHOD
      // This ensures the weighted average price reflects actual prices paid
      const totalDepositedUsd = deposits.reduce((sum, d) => sum + d.usdValue, 0)
      const totalDepositedTokens = deposits.reduce((sum, d) => sum + d.tokens, 0)
      const totalWithdrawnTokens = withdrawals.reduce((sum, w) => sum + w.tokens, 0)
      const netDepositedTokens = totalDepositedTokens - totalWithdrawnTokens

      // Weighted average deposit price = total USD deposited / total tokens deposited
      const weightedAvgPrice = totalDepositedTokens > 0
        ? totalDepositedUsd / totalDepositedTokens
        : sdkPrice

      // Cost basis = remaining tokens × avg deposit price (withdrawals reduce at avg cost)
      const costRemovedByWithdrawals = totalWithdrawnTokens * weightedAvgPrice
      const costBasisHistorical = totalDepositedUsd - costRemovedByWithdrawals

      // We don't have current balance here (it comes from SDK on client side)
      // So we'll just return the cost basis data and let client calculate the full breakdown
      byAsset[compositeKey] = {
        assetAddress,
        poolId,
        costBasisHistorical,
        weightedAvgDepositPrice: weightedAvgPrice,
        netDepositedTokens,
        // These will be calculated client-side with current balance from SDK
        protocolYieldTokens: 0,
        protocolYieldUsd: 0,
        priceChangeUsd: 0,
        priceChangePercent: 0,
        currentValueUsd: 0,
        totalEarnedUsd: 0,
        totalEarnedPercent: 0,
      }

      totalCostBasisHistorical += costBasisHistorical
    }

    return NextResponse.json({
      byAsset,
      totalCostBasisHistorical,
      totalProtocolYieldUsd,
      totalPriceChangeUsd,
      totalEarnedUsd,
    } as CostBasisHistoricalResponse, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[Cost Basis Historical API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch historical cost basis' },
      { status: 500 }
    )
  }
}
