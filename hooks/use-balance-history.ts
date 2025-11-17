"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  BalanceHistoryResponse,
  ChartDataPoint,
  PositionChange,
  EarningsStats,
} from "@/types/balance-history"
import {
  fillMissingDates,
  detectPositionChanges,
  calculateEarningsStats,
} from "@/lib/balance-history-utils"

export interface UseBalanceHistoryOptions {
  publicKey: string
  assetAddress: string
  days?: number
  enabled?: boolean
  includeBaselineDay?: boolean
}

export interface UseBalanceHistoryResult {
  isLoading: boolean
  error: Error | null
  data: BalanceHistoryResponse | undefined
  chartData: ChartDataPoint[]
  positionChanges: PositionChange[]
  earningsStats: EarningsStats
  refetch: () => void
}

/**
 * Hook to fetch and transform balance history data
 *
 * Fetches historical balance data from the backfill backend API
 * and transforms it into chart-ready format with filled missing dates
 */
export function useBalanceHistory({
  publicKey,
  assetAddress,
  days = 30,
  enabled = true,
  includeBaselineDay = true,
}: UseBalanceHistoryOptions): UseBalanceHistoryResult {
  // Fetch balance history from API
  const query = useQuery({
    queryKey: ["balance-history", publicKey, assetAddress, days],
    queryFn: async () => {
      const params = new URLSearchParams({
        user: publicKey,
        asset: assetAddress,
        days: days.toString(),
      })

      const response = await fetch(
        `/api/balance-history?${params.toString()}`,
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(
          error.message || "Failed to fetch balance history",
        )
      }

      return response.json() as Promise<BalanceHistoryResponse>
    },
    enabled: enabled && !!publicKey && !!assetAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data doesn't change frequently)
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Transform data for charts
  const chartData = useMemo(() => {
    if (!query.data?.history || query.data.history.length === 0) {
      return []
    }

    return fillMissingDates(query.data.history, includeBaselineDay)
  }, [query.data, includeBaselineDay])

  // Detect position changes (deposits/withdrawals)
  const positionChanges = useMemo(() => {
    if (!query.data?.history || query.data.history.length === 0) {
      return []
    }

    return detectPositionChanges(query.data.history)
  }, [query.data])

  // Calculate earnings statistics
  const earningsStats = useMemo(() => {
    return calculateEarningsStats(chartData, positionChanges)
  }, [chartData, positionChanges])

  return {
    isLoading: query.isLoading,
    error: query.error as Error | null,
    data: query.data,
    chartData,
    positionChanges,
    earningsStats,
    refetch: query.refetch,
  }
}
