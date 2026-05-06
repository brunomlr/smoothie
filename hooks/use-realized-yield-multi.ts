"use client"

import { _useRealizedYieldQueryInternal } from "./use-realized-yield"
import type { UseRealizedYieldResult } from "./use-realized-yield"

export interface UseRealizedYieldMultiOptions {
  publicKeys: string[] | undefined
  sdkBlndPrice?: number
  sdkLpPrice?: number
  sdkPrices?: Record<string, number>
  enabled?: boolean
}

export type UseRealizedYieldMultiResult = UseRealizedYieldResult

/**
 * Hook to fetch aggregated realized yield data for multiple wallets.
 * Thin wrapper over the shared query implementation in use-realized-yield.ts.
 */
export function useRealizedYieldMulti({
  publicKeys,
  sdkBlndPrice = 0,
  sdkLpPrice = 0,
  sdkPrices = {},
  enabled = true,
}: UseRealizedYieldMultiOptions): UseRealizedYieldMultiResult {
  return _useRealizedYieldQueryInternal({
    publicKeys: publicKeys ?? [],
    sdkBlndPrice,
    sdkLpPrice,
    sdkPrices,
    enabled,
    queryKeyPrefix: "performance-multi",
  })
}
