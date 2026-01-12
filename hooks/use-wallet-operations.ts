"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import type { WalletOperation, WalletOperationsResponse } from "@/app/api/wallet-operations/route"

export interface UseWalletOperationsOptions {
  publicKey: string
  limit?: number
  enabled?: boolean
}

export interface UseWalletOperationsResult {
  isLoading: boolean
  isFetchingNextPage: boolean
  error: Error | null
  operations: WalletOperation[]
  fetchNextPage: () => void
  hasNextPage: boolean
  refetch: () => void
}

/**
 * Hook to fetch wallet operations from Horizon with infinite scroll pagination
 *
 * Returns all wallet operations (payments, trustlines, account creations, etc.)
 */
export function useWalletOperations({
  publicKey,
  limit = 50,
  enabled = true,
}: UseWalletOperationsOptions): UseWalletOperationsResult {
  const query = useInfiniteQuery({
    queryKey: ["wallet-operations", publicKey, limit],
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        user: publicKey,
        limit: limit.toString(),
      })

      if (pageParam) {
        params.set("cursor", pageParam)
      }

      const response = await fetchWithTimeout(`/api/wallet-operations?${params.toString()}`, { signal })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to fetch wallet operations")
      }

      return response.json() as Promise<WalletOperationsResponse>
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // If we got fewer results than the limit, there are no more pages
      if (lastPage.operations.length < limit) {
        return undefined
      }
      return lastPage.nextCursor
    },
    enabled: enabled && !!publicKey,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Flatten all pages into a single array of operations
  const operations = query.data?.pages.flatMap((page) => page.operations) || []

  return {
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error as Error | null,
    operations,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refetch: query.refetch,
  }
}
