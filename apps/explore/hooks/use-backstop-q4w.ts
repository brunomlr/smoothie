"use client"

import { useQuery } from "@tanstack/react-query"
import type { Q4WResponse, Q4WFilterState, Q4WPool } from "@/types/backstop-q4w"

interface UseBackstopQ4WParams extends Q4WFilterState {
  limit?: number
  offset?: number
  lpPrice?: number
  enabled?: boolean
}

/**
 * Build query string from params
 */
function buildQueryString(params: UseBackstopQ4WParams): string {
  const searchParams = new URLSearchParams()

  if (params.poolAddress) searchParams.set("pool", params.poolAddress)
  searchParams.set("status", params.status)
  searchParams.set("orderBy", params.orderBy)
  searchParams.set("orderDir", params.orderDir)
  if (params.limit) searchParams.set("limit", params.limit.toString())
  if (params.offset) searchParams.set("offset", params.offset.toString())
  if (params.lpPrice) searchParams.set("lpPrice", params.lpPrice.toString())

  return searchParams.toString()
}

/**
 * Hook to fetch backstop Q4W data
 */
export function useBackstopQ4W(params: UseBackstopQ4WParams) {
  const {
    poolAddress,
    status = "all",
    orderBy = "unlock_time",
    orderDir = "asc",
    limit = 50,
    offset = 0,
    lpPrice = 0,
    enabled = true,
  } = params

  const queryKey = [
    "backstop-q4w",
    poolAddress,
    status,
    orderBy,
    orderDir,
    limit,
    offset,
    lpPrice,
  ]

  const result = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const queryString = buildQueryString({
        poolAddress,
        status,
        orderBy,
        orderDir,
        limit,
        offset,
        lpPrice,
      })

      const response = await fetch(`/api/backstop-q4w?${queryString}`, { signal })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to fetch Q4W data")
      }

      return response.json() as Promise<Q4WResponse>
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds - Q4W status can change
    refetchInterval: 60 * 1000, // Refetch every minute to update time remaining
    refetchOnWindowFocus: true,
    retry: 2,
  })

  return {
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error as Error | null,
    data: result.data,
    refetch: result.refetch,
  }
}

/**
 * Hook to fetch pools that have Q4W activity
 */
export function useQ4WPools() {
  const result = useQuery({
    queryKey: ["backstop-q4w-pools"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/backstop-q4w/pools", { signal })

      if (!response.ok) {
        throw new Error("Failed to fetch Q4W pools")
      }

      return response.json() as Promise<{ pools: Q4WPool[] }>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  return {
    pools: result.data?.pools || [],
    isLoading: result.isLoading,
    error: result.error as Error | null,
  }
}
