"use client"

import { useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import { fillMissingDates, detectPositionChanges, calculateEarningsStats } from "@/lib/balance-history-utils"
import type { AssetCardData } from "@/types/asset-card"
import type { BalanceHistoryPoint, ChartDataPoint, EarningsStats, PositionChange } from "@/types/balance-history"
import { decodeBalanceHistory } from "@/lib/balance-history-codec"
import { LP_TOKEN_ADDRESS } from "@/lib/constants"
import type { BalanceHistoryBatchResponse } from "@/app/api/balance-history-batch/route"

// localStorage cache for instant repeat loads
// v2: columnar wire format; the key is bumped so v1 blobs are ignored, not decoded.
const HISTORY_CACHE_KEY = "balance-history-cache-v2"
const HISTORY_CACHE_MAX_AGE = 4 * 60 * 60 * 1000 // 4 hours (historical data changes slowly)

interface HistoryCache {
  data: BalanceHistoryBatchResponse
  timestamp: number
  publicKey: string
}

function getCachedHistory(publicKey: string): BalanceHistoryBatchResponse | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const cached = localStorage.getItem(HISTORY_CACHE_KEY)
    if (!cached) return undefined
    const parsed: HistoryCache = JSON.parse(cached)
    // Validate cache: same wallet and not expired
    if (parsed.publicKey !== publicKey) return undefined
    if (Date.now() - parsed.timestamp > HISTORY_CACHE_MAX_AGE) {
      localStorage.removeItem(HISTORY_CACHE_KEY)
      return undefined
    }
    return parsed.data
  } catch {
    return undefined
  }
}

function setCachedHistory(publicKey: string, data: BalanceHistoryBatchResponse): void {
  if (typeof window === "undefined") return
  try {
    const cache: HistoryCache = { data, timestamp: Date.now(), publicKey }
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage full or unavailable - ignore
  }
}

interface BalanceHistoryQueryResult {
  data: { history: BalanceHistoryPoint[]; firstEventDate: string | null } | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
}

interface BalanceHistoryDataEntry {
  chartData: ChartDataPoint[]
  positionChanges: PositionChange[]
  earningsStats: EarningsStats
  rawData: BalanceHistoryPoint[]
  isLoading: boolean
  error: Error | null
}

interface BackstopHistoryPoint {
  date: string
  lp_tokens: number
}

interface BackstopBalanceHistoryData {
  history: BackstopHistoryPoint[]
}

export interface UseBalanceHistoryDataReturn {
  uniqueAssetAddresses: string[]
  /** Every asset the history response covers, plus the LP token. Superset of
   *  uniqueAssetAddresses, available without waiting for the wallet snapshot. */
  historyTokenAddresses: string[]
  /** Every date the chart can plot, from the earliest event (minus the baseline
   *  day fillMissingDates prepends) through today. Superset of the chart's own
   *  dates, available without waiting for the wallet snapshot. */
  historyDateRange: string[]
  balanceHistoryQueries: BalanceHistoryQueryResult[]
  backstopBalanceHistoryQuery: {
    data: BackstopBalanceHistoryData | undefined
    isLoading: boolean
    isError: boolean
    error: Error | null
  }
  poolAssetCostBasisMap: Map<string, number>
  poolAssetBorrowCostBasisMap: Map<string, number>
  balanceHistoryDataMap: Map<string, BalanceHistoryDataEntry>
}

export function useBalanceHistoryData(
  publicKey: string | undefined,
  assetCards: AssetCardData[],
  blendSnapshot: { positions: Array<{ borrowAmount: number; assetId?: string; poolId: string }> } | null | undefined
): UseBalanceHistoryDataReturn {
  // Get user's timezone for correct date handling in balance history
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get unique asset addresses from both supply and borrow positions
  const uniqueAssetAddresses = useMemo(() => {
    const addresses = new Set<string>()
    // Include assets from supply positions (assetCards)
    assetCards.forEach((asset) => {
      const assetAddress = asset.id.includes('-') ? asset.id.split('-')[1] : asset.id
      addresses.add(assetAddress)
    })
    // Also include assets from borrow positions
    if (blendSnapshot?.positions) {
      blendSnapshot.positions.forEach((position) => {
        if (position.borrowAmount > 0 && position.assetId) {
          addresses.add(position.assetId)
        }
      })
    }
    return Array.from(addresses)
  }, [assetCards, blendSnapshot?.positions])

  // Get cached data for instant display on repeat visits
  const cachedData = useMemo(
    () => publicKey ? getCachedHistory(publicKey) : undefined,
    [publicKey]
  )

  // Batch fetch balance history for every asset this wallet has ever touched,
  // in a single request. The asset list is derived server-side, so this fires
  // as soon as the public key is known instead of queueing behind the SDK
  // wallet snapshot. Which of those assets end up on the chart is still decided
  // client-side by uniqueAssetAddresses below.
  const balanceHistoryBatchQuery = useQuery<BalanceHistoryBatchResponse, Error>({
    queryKey: ["balance-history-batch", publicKey || '', 365, userTimezone],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        user: publicKey || '',
        days: '365',
        timezone: userTimezone,
      })

      const response = await fetchWithTimeout(`/api/balance-history-batch?${params.toString()}`, { signal })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to fetch balance history")
      }

      return response.json() as Promise<BalanceHistoryBatchResponse>
    },
    enabled: !!publicKey,
    staleTime: 5 * 60 * 1000, // 5 minutes (historical data doesn't change frequently)
    refetchOnWindowFocus: false,
    retry: 2,
    placeholderData: cachedData, // Show cached data instantly while fetching
  })

  // Update localStorage cache when fresh data arrives
  useEffect(() => {
    if (publicKey && balanceHistoryBatchQuery.data && !balanceHistoryBatchQuery.isPlaceholderData) {
      setCachedHistory(publicKey, balanceHistoryBatchQuery.data)
    }
  }, [publicKey, balanceHistoryBatchQuery.data, balanceHistoryBatchQuery.isPlaceholderData])

  // Decode the columnar payload once per response, keyed by asset address.
  const decodedResults = useMemo(() => {
    const map = new Map<string, { history: BalanceHistoryPoint[]; firstEventDate: string | null; error: string | null }>()
    balanceHistoryBatchQuery.data?.results?.forEach((result) => {
      map.set(result.asset_address, {
        history: decodeBalanceHistory(result.columns),
        firstEventDate: result.firstEventDate,
        error: result.error,
      })
    })
    return map
  }, [balanceHistoryBatchQuery.data])

  // Check if we have fresh data (not placeholder/cached data)
  const hasFreshHistoryData = balanceHistoryBatchQuery.data && !balanceHistoryBatchQuery.isPlaceholderData

  // Transform batch results into the same format as the old useQueries result
  // This maintains compatibility with existing code that uses balanceHistoryQueries
  const balanceHistoryQueries = useMemo(() => {
    // Show loading until fresh data arrives (not just cached/placeholder data)
    const isStillLoading = balanceHistoryBatchQuery.isLoading || !hasFreshHistoryData

    if (decodedResults.size === 0) {
      return uniqueAssetAddresses.map(() => ({
        data: undefined,
        isLoading: isStillLoading,
        isError: balanceHistoryBatchQuery.isError,
        error: balanceHistoryBatchQuery.error,
      }))
    }

    return uniqueAssetAddresses.map((assetAddress) => {
      const result = decodedResults.get(assetAddress)
      if (!result) {
        return {
          data: { history: [], firstEventDate: null },
          isLoading: isStillLoading,
          isError: false,
          error: null,
        }
      }

      return {
        data: {
          history: result.history,
          firstEventDate: result.firstEventDate,
        },
        isLoading: isStillLoading,
        isError: !!result.error,
        error: result.error ? new Error(result.error) : null,
      }
    })
  }, [decodedResults, balanceHistoryBatchQuery.isLoading, balanceHistoryBatchQuery.isError, balanceHistoryBatchQuery.error, uniqueAssetAddresses, hasFreshHistoryData])

  // Fetch backstop balance history (LP tokens over time)
  const backstopBalanceHistoryQuery = useQuery({
    queryKey: ["backstop-balance-history", publicKey || '', userTimezone],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        user: publicKey || '',
        days: '365',
        timezone: userTimezone,
      })

      const response = await fetchWithTimeout(`/api/backstop-balance-history?${params.toString()}`, { signal })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to fetch backstop balance history")
      }

      return response.json()
    },
    enabled: !!publicKey,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Build a mapping from composite key (poolId-assetAddress) to cost basis (from database)
  const poolAssetCostBasisMap = useMemo(() => {
    const map = new Map<string, number>()

    balanceHistoryQueries.forEach((query, index) => {
      if (!query.data?.history || query.data.history.length === 0) return

      const assetAddress = uniqueAssetAddresses[index]

      // Get latest cost_basis for each pool from this asset's history
      const latestByPool = new Map<string, number>()
      query.data.history.forEach((record) => {
        if (record.total_cost_basis !== null && record.total_cost_basis !== undefined) {
          // Since records are sorted newest first, first occurrence is the latest
          if (!latestByPool.has(record.pool_id)) {
            latestByPool.set(record.pool_id, record.total_cost_basis)
          }
        }
      })

      // Add to the overall map using composite key: poolId-assetAddress
      latestByPool.forEach((costBasis, poolId) => {
        const compositeKey = `${poolId}-${assetAddress}`
        map.set(compositeKey, costBasis)
      })
    })

    return map
  }, [balanceHistoryQueries, uniqueAssetAddresses])

  // Build a mapping from composite key (poolId-assetAddress) to borrow cost basis (from database)
  const poolAssetBorrowCostBasisMap = useMemo(() => {
    const map = new Map<string, number>()

    balanceHistoryQueries.forEach((query, index) => {
      if (!query.data?.history || query.data.history.length === 0) return

      const assetAddress = uniqueAssetAddresses[index]

      // Get latest borrow_cost_basis for each pool from this asset's history
      const latestByPool = new Map<string, number>()
      query.data.history.forEach((record) => {
        if (record.borrow_cost_basis !== null && record.borrow_cost_basis !== undefined) {
          // Since records are sorted newest first, first occurrence is the latest
          if (!latestByPool.has(record.pool_id)) {
            latestByPool.set(record.pool_id, record.borrow_cost_basis)
          }
        }
      })

      // Add to the overall map using composite key: poolId-assetAddress
      latestByPool.forEach((borrowCostBasis, poolId) => {
        const compositeKey = `${poolId}-${assetAddress}`
        map.set(compositeKey, borrowCostBasis)
      })
    })

    return map
  }, [balanceHistoryQueries, uniqueAssetAddresses])

  // Build a mapping from assetAddress to balance history data
  // This prevents redundant fetches in child components
  const balanceHistoryDataMap = useMemo(() => {
    const map = new Map<string, BalanceHistoryDataEntry>()

    uniqueAssetAddresses.forEach((assetAddress, index) => {
      const query = balanceHistoryQueries[index]
      if (query?.data) {
        const historyData = query.data.history
        const chartData = fillMissingDates(historyData, true, query.data.firstEventDate)
        const positionChanges = detectPositionChanges(historyData)
        const earningsStats = calculateEarningsStats(chartData, positionChanges)

        map.set(assetAddress, {
          chartData,
          positionChanges,
          earningsStats,
          rawData: query.data.history,
          isLoading: query.isLoading,
          error: query.error,
        })
      }
    })

    return map
  }, [uniqueAssetAddresses, balanceHistoryQueries])

  // Token list and date span for the historical-price lookup. Both are derived
  // from the history response alone, so the price request no longer waits for
  // the wallet snapshot; both are supersets of what the chart plots, which
  // forward-filled prices tolerate.
  const historyTokenAddresses = useMemo(() => {
    const addresses = Array.from(decodedResults.keys())
    if (!addresses.includes(LP_TOKEN_ADDRESS)) {
      addresses.push(LP_TOKEN_ADDRESS)
    }
    return addresses
  }, [decodedResults])

  const backstopHistory = (backstopBalanceHistoryQuery.data as BackstopBalanceHistoryData | undefined)?.history

  const historyDateRange = useMemo(() => {
    let earliest: string | null = null
    decodedResults.forEach((result) => {
      for (const candidate of [result.firstEventDate, result.history[result.history.length - 1]?.snapshot_date]) {
        if (candidate && (earliest === null || candidate < earliest)) {
          earliest = candidate
        }
      }
    })
    backstopHistory?.forEach((point) => {
      if (point.date && (earliest === null || point.date < earliest)) {
        earliest = point.date
      }
    })
    if (!earliest) return []

    // One day before the first event: fillMissingDates prepends a baseline day.
    const cursor = new Date(`${(earliest as string).slice(0, 10)}T00:00:00Z`)
    cursor.setUTCDate(cursor.getUTCDate() - 1)

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const dates: string[] = []
    // Guard against a bad earliest date spinning forever.
    while (dates.length < 800) {
      const date = cursor.toISOString().slice(0, 10)
      dates.push(date)
      if (date >= today) break
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }, [decodedResults, backstopHistory])

  return {
    uniqueAssetAddresses,
    historyTokenAddresses,
    historyDateRange,
    balanceHistoryQueries,
    backstopBalanceHistoryQuery: {
      data: backstopBalanceHistoryQuery.data as BackstopBalanceHistoryData | undefined,
      isLoading: backstopBalanceHistoryQuery.isLoading,
      isError: backstopBalanceHistoryQuery.isError,
      error: backstopBalanceHistoryQuery.error,
    },
    poolAssetCostBasisMap,
    poolAssetBorrowCostBasisMap,
    balanceHistoryDataMap,
  }
}
