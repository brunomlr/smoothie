"use client"

import { useMemo } from "react"
import type { UseQueryResult } from "@tanstack/react-query"

/**
 * Result type for query composition
 */
export interface ComposedQueryResult<T extends Record<string, unknown>> {
  /** True if any query is loading */
  isLoading: boolean
  /** True if any query has an error */
  isError: boolean
  /** First error found, or null */
  error: Error | null
  /** True if all queries have data */
  isReady: boolean
  /** True if all queries are either successful or have data */
  isSuccess: boolean
  /** Combined data from all queries */
  data: T
}

/**
 * Compose multiple React Query results into a single result.
 *
 * This utility combines the loading, error, and data states of multiple queries
 * into a single unified result that's easier to work with in components.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const positions = useBlendPositions(publicKey)
 *   const history = useBalanceHistory(publicKey)
 *   const prices = usePrices(tokenAddresses)
 *
 *   const { isLoading, isError, isReady, data } = useQueryComposition({
 *     positions,
 *     history,
 *     prices,
 *   })
 *
 *   if (isLoading) return <Skeleton />
 *   if (isError) return <Error />
 *
 *   // data.positions, data.history, data.prices are all available
 * }
 * ```
 */
export function useQueryComposition<
  T extends Record<string, UseQueryResult<unknown, Error>>
>(
  queries: T
): ComposedQueryResult<{ [K in keyof T]: T[K]["data"] }> {
  return useMemo(() => {
    const queryArray = Object.values(queries) as UseQueryResult<unknown, Error>[]

    const isLoading = queryArray.some((q) => q.isLoading)
    const isError = queryArray.some((q) => q.isError)
    const error = queryArray.find((q) => q.error)?.error ?? null
    const isReady = queryArray.every((q) => q.data !== undefined)
    const isSuccess = queryArray.every((q) => q.isSuccess || q.data !== undefined)

    const data = Object.fromEntries(
      Object.entries(queries).map(([key, query]) => [key, query.data])
    ) as { [K in keyof T]: T[K]["data"] }

    return {
      isLoading,
      isError,
      error,
      isReady,
      isSuccess,
      data,
    }
  }, [queries])
}

/**
 * Type helper for extracting data types from query results
 */
export type ExtractQueryData<T> = T extends UseQueryResult<infer D, unknown> ? D : never

/**
 * Create a derived query that depends on other queries.
 *
 * This hook combines the states of multiple queries and only executes
 * the derived computation when all dependencies are ready.
 *
 * @example
 * ```tsx
 * const derivedData = useDerivedQuery(
 *   { positions, prices },
 *   (deps) => {
 *     // This only runs when both positions and prices have data
 *     return deps.positions.map(p => ({
 *       ...p,
 *       usdValue: p.amount * deps.prices[p.tokenAddress]
 *     }))
 *   }
 * )
 * ```
 */
export function useDerivedQuery<
  T extends Record<string, UseQueryResult<unknown, Error>>,
  R
>(
  queries: T,
  derive: (data: { [K in keyof T]: NonNullable<T[K]["data"]> }) => R
): {
  isLoading: boolean
  isError: boolean
  error: Error | null
  isReady: boolean
  data: R | undefined
} {
  const composed = useQueryComposition(queries)

  const derivedData = useMemo(() => {
    if (!composed.isReady) return undefined
    return derive(composed.data as { [K in keyof T]: NonNullable<T[K]["data"]> })
  }, [composed.isReady, composed.data, derive])

  return {
    isLoading: composed.isLoading,
    isError: composed.isError,
    error: composed.error,
    isReady: composed.isReady,
    data: derivedData,
  }
}
