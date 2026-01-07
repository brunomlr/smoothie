/**
 * Hook for fetching pool TVL history data
 */

import { useQuery } from '@tanstack/react-query'
import { fetchWithTimeout } from '@/lib/fetch-utils'

interface PoolHistoryPoint {
  date: string
  tvlUsd: number
  borrowedUsd: number
}

interface PoolHistoryData {
  pools: Record<string, {
    name: string
    iconUrl: string | null
    history: PoolHistoryPoint[]
  }>
}

async function fetchPoolHistory(): Promise<PoolHistoryData> {
  // Fetch all available data (no days param means all data)
  const response = await fetchWithTimeout('/api/pool-history')
  if (!response.ok) {
    throw new Error('Failed to fetch pool history')
  }
  return response.json()
}

export function usePoolTvlHistory() {
  return useQuery({
    queryKey: ['pool-tvl-history'],
    queryFn: fetchPoolHistory,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
  })
}
