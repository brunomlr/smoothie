"use client"

import {
  usePnlChangeChartCore,
  type PnlChangeChartCoreResult,
  type PnlChangeDataPoint,
  type PnlPeriodType,
  type PnlChartBlendPosition,
  type PnlChartBackstopPosition,
} from "./shared/pnl-change-chart-core"

export type { PnlChangeDataPoint, PnlPeriodType }

interface UsePnlChangeChartMultiOptions {
  publicKeys: string[] | undefined
  period: PnlPeriodType
  enabled?: boolean
  // Pre-aggregated SDK data from upstream multi-wallet hook
  blendPositions?: PnlChartBlendPosition[]
  backstopPositions?: PnlChartBackstopPosition[]
  blndPrice?: number | null
  lpTokenPrice?: number | null
  weightedBlndApy?: number
}

export type UsePnlChangeChartMultiResult = PnlChangeChartCoreResult

/**
 * Multi-wallet P&L change chart. SDK data is provided externally (already
 * aggregated by the caller).
 */
export function usePnlChangeChartMulti(
  options: UsePnlChangeChartMultiOptions
): UsePnlChangeChartMultiResult {
  const {
    publicKeys,
    period,
    enabled = true,
    blendPositions,
    backstopPositions,
    blndPrice,
    lpTokenPrice,
    weightedBlndApy,
  } = options

  return usePnlChangeChartCore({
    publicKeys: publicKeys ?? [],
    period,
    enabled,
    blendPositions,
    backstopPositions,
    blndPrice,
    lpTokenPrice,
    weightedBlndApy: weightedBlndApy ?? 0,
    queryKeyPrefix: 'pnl-change-chart-multi',
    sdkReady: blendPositions !== undefined,
  })
}
