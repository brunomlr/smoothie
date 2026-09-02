/**
 * Dashboard Data Hook
 *
 * Combines multiple data-fetching hooks for the dashboard page.
 * This hook orchestrates the data flow between:
 * - useBlendPositions (positions, asset cards, backstop data)
 * - useBalanceHistoryData (historical balance data)
 * - useChartHistoricalPrices (price history for charts)
 * - useHistoricalYieldBreakdown (yield calculations)
 *
 * Usage:
 * ```typescript
 * const dashboard = useDashboardData(publicKey)
 *
 * if (dashboard.isLoading) return <Skeleton />
 * if (dashboard.error) return <Error error={dashboard.error} />
 *
 * // All data available
 * const { positions, balanceHistory, prices, yieldBreakdown } = dashboard.data
 * ```
 */

"use client"

import { useMemo } from "react"
import { useBlendPositions } from "@/hooks/use-blend-positions"
import { useBalanceHistoryData } from "@/hooks/use-balance-history-data"
import { useChartHistoricalPrices } from "@/hooks/use-chart-historical-prices"
import { useHistoricalYieldBreakdown } from "@/hooks/use-historical-yield-breakdown"
import { LP_TOKEN_ADDRESS } from "@/lib/constants"

interface UseDashboardDataOptions {
  /** Whether historical prices should be fetched */
  enableHistoricalPrices?: boolean
  /** Whether yield breakdown should be calculated */
  enableYieldBreakdown?: boolean
}

export function useDashboardData(
  publicKey: string | undefined,
  options: UseDashboardDataOptions = {}
) {
  const {
    enableHistoricalPrices = true,
    enableYieldBreakdown = true,
  } = options

  // 1. Fetch blend positions (primary data source)
  const positions = useBlendPositions(publicKey)

  // 2. Fetch balance history data for all assets
  const balanceHistory = useBalanceHistoryData(
    publicKey,
    positions.assetCards,
    positions.data
  )

  // 3. Build SDK prices map from blend positions for historical price lookups
  const sdkPricesMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!positions.data?.positions) return map

    positions.data.positions.forEach(pos => {
      if (pos.assetId && pos.price?.usdPrice && pos.price.usdPrice > 0) {
        map.set(pos.assetId, pos.price.usdPrice)
      }
    })

    // Add LP token price if available
    if (positions.lpTokenPrice && positions.lpTokenPrice > 0) {
      map.set(LP_TOKEN_ADDRESS, positions.lpTokenPrice)
    }

    return map
  }, [positions.data, positions.lpTokenPrice])

  // 4/5. Token set and date span for historical prices. Both come from the
  // history response alone (supersets of what the chart plots), so this request
  // runs alongside the wallet snapshot rather than after it.

  // 6. Fetch historical prices for chart data
  const historicalPrices = useChartHistoricalPrices({
    tokenAddresses: balanceHistory.historyTokenAddresses,
    dates: balanceHistory.historyDateRange,
    sdkPrices: sdkPricesMap,
    enabled: enableHistoricalPrices
      && balanceHistory.historyDateRange.length > 0
      && balanceHistory.historyTokenAddresses.length > 0,
  })

  // 7. Fetch historical yield breakdown data
  const yieldBreakdown = useHistoricalYieldBreakdown(
    enableYieldBreakdown ? publicKey : undefined,
    positions.data?.positions,
    positions.backstopPositions,
    positions.lpTokenPrice
  )

  // Calculate overall loading state
  const isLoading = positions.isLoading

  // Calculate if we have the minimum data to render
  const hasPositions = !positions.isLoading && positions.data !== undefined

  // Aggregate error state
  const error = positions.error || null

  return {
    // Loading states
    isLoading,
    hasPositions,
    error,

    // Position data
    positions: {
      data: positions.data,
      assetCards: positions.assetCards,
      balanceData: positions.balanceData,
      backstopPositions: positions.backstopPositions,
      lpTokenPrice: positions.lpTokenPrice,
      blndPrice: positions.blndPrice,
      totalEmissions: positions.totalEmissions,
      isLoading: positions.isLoading,
    },

    // Balance history data
    balanceHistory: {
      dataMap: balanceHistory.balanceHistoryDataMap,
      backstopQuery: balanceHistory.backstopBalanceHistoryQuery,
      poolAssetCostBasisMap: balanceHistory.poolAssetCostBasisMap,
      poolAssetBorrowCostBasisMap: balanceHistory.poolAssetBorrowCostBasisMap,
      uniqueAssetAddresses: balanceHistory.uniqueAssetAddresses,
      queries: balanceHistory.balanceHistoryQueries,
    },

    // Historical prices data
    historicalPrices: {
      data: historicalPrices,
      hasData: historicalPrices.hasHistoricalData,
      dates: balanceHistory.historyDateRange,
      tokenAddresses: balanceHistory.historyTokenAddresses,
      sdkPricesMap,
    },

    // Yield breakdown data
    yieldBreakdown: {
      isLoading: yieldBreakdown.isLoading,
      byAsset: yieldBreakdown.byAsset,
      byBackstop: yieldBreakdown.byBackstop,
      totals: {
        totalCostBasisHistorical: yieldBreakdown.totalCostBasisHistorical,
        totalProtocolYieldUsd: yieldBreakdown.totalProtocolYieldUsd,
        totalPriceChangeUsd: yieldBreakdown.totalPriceChangeUsd,
        totalEarnedUsd: yieldBreakdown.totalEarnedUsd,
      },
    },
  }
}

export type DashboardData = ReturnType<typeof useDashboardData>
