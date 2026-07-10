"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import type { GainsLossesResponse } from "@/app/api/reports/gains-losses/route"
import type { WalletTransfersResponse } from "@/lib/reports/types"

export function useGainsLossesReport(publicKey: string, year?: number) {
  const query = useQuery({
    queryKey: ["gains-losses-report", publicKey, year ?? "latest"],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ user: publicKey })
      if (year) params.set("year", year.toString())

      const response = await fetchWithTimeout(`/api/reports/gains-losses?${params.toString()}`, {
        signal,
        timeout: 60000, // full-history ledger computation can take a few seconds
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Failed to fetch gains & losses report")
      }
      return response.json() as Promise<GainsLossesResponse>
    },
    enabled: !!publicKey,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    // Keep the previous year's report on screen while the next one computes,
    // so the controls stay mounted instead of flashing the skeleton
    placeholderData: keepPreviousData,
  })

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    data: query.data,
    refetch: query.refetch,
  }
}

export function useWalletTransfersReport(publicKey: string, year: number | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ["wallet-transfers-report", publicKey, year],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ user: publicKey, year: String(year) })
      const response = await fetchWithTimeout(`/api/reports/wallet-transfers?${params.toString()}`, {
        signal,
        timeout: 60000, // paginated Horizon fetch
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || "Failed to fetch wallet transfers")
      }
      return response.json() as Promise<WalletTransfersResponse>
    },
    enabled: enabled && !!publicKey && !!year,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  return {
    isLoading: query.isLoading,
    error: query.error as Error | null,
    data: query.data,
  }
}
