"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useDisplayPreferences } from "@/contexts/display-preferences-context"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import type { PnlChangeChartResponse, PnlChangeDataPoint, PnlPeriodType } from "@/app/api/pnl-change-chart/route"

export type { PnlChangeDataPoint, PnlPeriodType }

// Position shapes — minimal fields the chart needs.
export interface PnlChartBlendPosition {
  poolId: string
  assetId?: string
  supplyAmount: number
  borrowAmount: number
  price?: { usdPrice?: number } | null
}

export interface PnlChartBackstopPosition {
  poolId: string
  lpTokens: number
  shares: bigint
  q4wLpTokens?: number
  q4wShares?: bigint
  emissionApy?: number
  lpTokensUsd?: number
}

interface BackstopPositionData {
  lpTokens: number
  shares: number
}

export interface PnlChangeChartCoreOptions {
  /** Public keys to query for (single-wallet hooks pass `[publicKey]`). */
  publicKeys: string[]
  period: PnlPeriodType
  enabled: boolean
  /** Already-loaded SDK positions. `undefined` means SDK still loading. */
  blendPositions: PnlChartBlendPosition[] | undefined
  backstopPositions: PnlChartBackstopPosition[] | undefined
  blndPrice: number | null | undefined
  lpTokenPrice: number | null | undefined
  weightedBlndApy: number
  /** React Query cache prefix — keeps single vs multi caches isolated. */
  queryKeyPrefix: string
  /** Set to false to drive isLoading off the SDK readiness signal. */
  sdkReady: boolean
}

export interface PnlChangeChartCoreResult {
  data: PnlChangeDataPoint[] | undefined
  isLoading: boolean
  error: Error | null
  granularity: 'daily' | 'monthly' | undefined
}

async function fetchPnlChangeChart(params: {
  userAddresses: string[]
  period: PnlPeriodType
  timezone: string
  sdkPrices: Record<string, number>
  sdkBlndPrice: number
  sdkLpPrice: number
  currentBalances: Record<string, number>
  currentBorrowBalances: Record<string, number>
  backstopPositions: Record<string, BackstopPositionData>
  useHistoricalBlndPrices: boolean
  blndApy: number
  backstopBlndApy: number
}): Promise<PnlChangeChartResponse> {
  const queryParams = new URLSearchParams({
    userAddresses: params.userAddresses.join(','),
    period: params.period,
    timezone: params.timezone,
    sdkPrices: JSON.stringify(params.sdkPrices),
    sdkBlndPrice: params.sdkBlndPrice.toString(),
    sdkLpPrice: params.sdkLpPrice.toString(),
    currentBalances: JSON.stringify(params.currentBalances),
    currentBorrowBalances: JSON.stringify(params.currentBorrowBalances),
    backstopPositions: JSON.stringify(params.backstopPositions),
    useHistoricalBlndPrices: params.useHistoricalBlndPrices.toString(),
    blndApy: params.blndApy.toString(),
    backstopBlndApy: params.backstopBlndApy.toString(),
  })

  const response = await fetchWithTimeout(`/api/pnl-change-chart?${queryParams}`)

  if (!response.ok) {
    throw new Error('Failed to fetch P&L change chart data')
  }

  return response.json()
}

/**
 * Shared P&L change chart query implementation.
 *
 * Aggregates SDK position data into request params and runs the API query.
 * Sums supply/borrow balances by (poolId, assetId), which is correct for
 * both single-wallet (positions are unique per key) and multi-wallet
 * (same key may appear from multiple wallets) cases.
 */
export function usePnlChangeChartCore(options: PnlChangeChartCoreOptions): PnlChangeChartCoreResult {
  const {
    publicKeys,
    period,
    enabled,
    blendPositions,
    backstopPositions: backstopPositionsData,
    blndPrice,
    lpTokenPrice,
    weightedBlndApy,
    queryKeyPrefix,
    sdkReady,
  } = options

  const { preferences } = useDisplayPreferences()

  const timezone = useMemo(() => {
    if (typeof window === 'undefined') return 'UTC'
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }, [])

  // SDK prices map: assetId -> usdPrice
  const sdkPrices = useMemo(() => {
    const prices: Record<string, number> = {}
    if (!blendPositions) return prices

    blendPositions.forEach(pos => {
      if (pos.assetId && pos.price?.usdPrice && pos.price.usdPrice > 0) {
        prices[pos.assetId] = pos.price.usdPrice
      }
    })

    return prices
  }, [blendPositions])

  // Current supply balances by (poolId, assetId)
  const currentBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    if (!blendPositions) return balances

    blendPositions.forEach(pos => {
      if (pos.supplyAmount > 0 && pos.assetId) {
        const compositeKey = `${pos.poolId}-${pos.assetId}`
        balances[compositeKey] = (balances[compositeKey] || 0) + pos.supplyAmount
      }
    })

    return balances
  }, [blendPositions])

  // Current borrow balances by (poolId, assetId)
  const currentBorrowBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    if (!blendPositions) return balances

    blendPositions.forEach(pos => {
      if (pos.borrowAmount > 0 && pos.assetId) {
        const compositeKey = `${pos.poolId}-${pos.assetId}`
        balances[compositeKey] = (balances[compositeKey] || 0) + pos.borrowAmount
      }
    })

    return balances
  }, [blendPositions])

  // Backstop positions: sum lpTokens & shares (incl. Q4W) per pool, summed across wallets.
  const backstopPositions = useMemo(() => {
    const positions: Record<string, BackstopPositionData> = {}
    if (!backstopPositionsData) return positions

    backstopPositionsData.forEach(bp => {
      const totalLpTokens = bp.lpTokens + (bp.q4wLpTokens || 0)
      const totalShares = Number(bp.shares + (bp.q4wShares || BigInt(0))) / 1e7

      if (totalLpTokens > 0 && totalShares > 0) {
        const existing = positions[bp.poolId]
        if (existing) {
          positions[bp.poolId] = {
            lpTokens: existing.lpTokens + totalLpTokens,
            shares: existing.shares + totalShares,
          }
        } else {
          positions[bp.poolId] = {
            lpTokens: totalLpTokens,
            shares: totalShares,
          }
        }
      }
    })

    return positions
  }, [backstopPositionsData])

  // Weighted backstop BLND APY across pools, weighted by USD value.
  const backstopBlndApy = useMemo(() => {
    if (!backstopPositionsData || backstopPositionsData.length === 0) return 0

    let totalValue = 0
    let weightedApy = 0

    backstopPositionsData.forEach(bp => {
      if (bp.lpTokensUsd && bp.lpTokensUsd > 0 && bp.emissionApy && bp.emissionApy > 0) {
        totalValue += bp.lpTokensUsd
        weightedApy += bp.lpTokensUsd * bp.emissionApy
      }
    })

    return totalValue > 0 ? weightedApy / totalValue : 0
  }, [backstopPositionsData])

  const publicKeysKey = useMemo(
    () => publicKeys.slice().sort().join(','),
    [publicKeys]
  )

  const query = useQuery({
    queryKey: [
      queryKeyPrefix,
      publicKeysKey,
      period,
      timezone,
      preferences.useHistoricalBlndPrices,
      Object.keys(currentBalances).sort().join(','),
      Object.keys(currentBorrowBalances).sort().join(','),
      Object.keys(backstopPositions).sort().join(','),
    ],
    queryFn: () =>
      fetchPnlChangeChart({
        userAddresses: publicKeys,
        period,
        timezone,
        sdkPrices,
        sdkBlndPrice: blndPrice ?? 0,
        sdkLpPrice: lpTokenPrice ?? 0,
        currentBalances,
        currentBorrowBalances,
        backstopPositions,
        useHistoricalBlndPrices: preferences.useHistoricalBlndPrices,
        blndApy: weightedBlndApy,
        backstopBlndApy,
      }),
    enabled: enabled && publicKeys.length > 0 && sdkReady,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    data: query.data?.data,
    isLoading: !sdkReady || query.isLoading,
    error: query.error as Error | null,
    granularity: query.data?.granularity,
  }
}
