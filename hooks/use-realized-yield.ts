"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import type { RealizedYieldResponse } from "@/app/api/performance/route"

export interface UseRealizedYieldOptions {
  publicKey: string | undefined
  sdkBlndPrice?: number
  sdkLpPrice?: number
  sdkPrices?: Record<string, number>
  enabled?: boolean
}

export interface UseRealizedYieldResult {
  data: RealizedYieldResponse | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

interface SharedQueryOptions {
  publicKeys: string[]
  sdkBlndPrice: number
  sdkLpPrice: number
  sdkPrices: Record<string, number>
  enabled: boolean
  queryKeyPrefix: string
}

/**
 * Shared query implementation for realized yield.
 *
 * Realized yield = Total withdrawn (at historical prices) - Total deposited (at historical prices)
 *
 * This is internal — call `useRealizedYield` (single wallet) or
 * `useRealizedYieldMulti` (aggregate across wallets) instead.
 */
function useRealizedYieldQuery({
  publicKeys,
  sdkBlndPrice,
  sdkLpPrice,
  sdkPrices,
  enabled,
  queryKeyPrefix,
}: SharedQueryOptions): UseRealizedYieldResult {
  const sdkPricesKey = Object.keys(sdkPrices)
    .sort()
    .map(k => `${k}:${sdkPrices[k]?.toFixed(6)}`)
    .join(',')

  const isQueryEnabled = enabled && publicKeys.length > 0

  const query = useQuery({
    queryKey: [queryKeyPrefix, publicKeys.slice().sort().join(','), sdkBlndPrice, sdkLpPrice, sdkPricesKey],
    queryFn: async ({ signal }) => {
      if (publicKeys.length === 0) {
        throw new Error("No public key(s) provided")
      }

      const params = new URLSearchParams({
        userAddresses: publicKeys.join(','),
      })

      if (sdkBlndPrice > 0) {
        params.set("sdkBlndPrice", sdkBlndPrice.toString())
      }

      if (sdkLpPrice > 0) {
        params.set("sdkLpPrice", sdkLpPrice.toString())
      }

      if (Object.keys(sdkPrices).length > 0) {
        params.set("sdkPrices", JSON.stringify(sdkPrices))
      }

      const response = await fetchWithTimeout(
        `/api/performance?${params.toString()}`,
        { signal }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to fetch realized yield data")
      }

      return response.json() as Promise<RealizedYieldResponse>
    },
    enabled: isQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - historical yield data changes slowly
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  })

  return {
    data: query.data,
    isLoading: !isQueryEnabled || query.isLoading || (!query.data && query.isPending),
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}

/**
 * Hook to fetch realized yield data for a single wallet.
 */
export function useRealizedYield({
  publicKey,
  sdkBlndPrice = 0,
  sdkLpPrice = 0,
  sdkPrices = {},
  enabled = true,
}: UseRealizedYieldOptions): UseRealizedYieldResult {
  return useRealizedYieldQuery({
    publicKeys: publicKey ? [publicKey] : [],
    sdkBlndPrice,
    sdkLpPrice,
    sdkPrices,
    enabled,
    queryKeyPrefix: "performance",
  })
}

// Internal export for the multi-wallet variant.
export { useRealizedYieldQuery as _useRealizedYieldQueryInternal }
