/**
 * Hook for fetching per-token pool TVL history data
 */

import { useQuery } from '@tanstack/react-query'
import { fetchWithTimeout } from '@/lib/fetch-utils'

export interface TokenMeta {
  assetAddress: string
  symbol: string
  iconUrl: string | null
}

export interface TokenHistoryEntry {
  suppliedUsd: number
  borrowedUsd: number
  suppliedTokens: number
  borrowedTokens: number
}

export interface TokenHistoryPoint {
  date: string
  /** Per-token values, keyed by asset address */
  tokens: Record<string, TokenHistoryEntry>
}

export interface PoolTokenHistoryData {
  pools: Record<string, {
    name: string
    iconUrl: string | null
    tokens: TokenMeta[]
    history: TokenHistoryPoint[]
  }>
}

async function fetchPoolTokenHistory(): Promise<PoolTokenHistoryData> {
  const response = await fetchWithTimeout('/api/pool-token-history')
  if (!response.ok) {
    throw new Error('Failed to fetch pool token history')
  }
  return response.json()
}

export function usePoolTokenTvlHistory() {
  return useQuery({
    queryKey: ['pool-token-tvl-history'],
    queryFn: fetchPoolTokenHistory,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
  })
}
