"use client"

import { useBlendPositions } from "./use-blend-positions"
import {
  usePnlChangeChartCore,
  type PnlChangeChartCoreResult,
  type PnlChangeDataPoint,
  type PnlPeriodType,
} from "./shared/pnl-change-chart-core"

export type { PnlChangeDataPoint, PnlPeriodType }

interface UsePnlChangeChartOptions {
  publicKey: string | null | undefined
  period: PnlPeriodType
  enabled?: boolean
}

export type UsePnlChangeChartResult = PnlChangeChartCoreResult

/**
 * Single-wallet P&L change chart. Wraps `usePnlChangeChartCore` with SDK data
 * loaded internally via `useBlendPositions`.
 */
export function usePnlChangeChart(
  options: UsePnlChangeChartOptions
): UsePnlChangeChartResult {
  const { publicKey, period, enabled = true } = options

  const {
    data: blendSnapshot,
    blndPrice,
    lpTokenPrice,
    backstopPositions,
    isLoading: isLoadingPositions,
  } = useBlendPositions(publicKey ?? undefined)

  const result = usePnlChangeChartCore({
    publicKeys: publicKey ? [publicKey] : [],
    period,
    enabled,
    blendPositions: blendSnapshot?.positions,
    backstopPositions,
    blndPrice,
    lpTokenPrice,
    weightedBlndApy: blendSnapshot?.weightedBlndApy ?? 0,
    queryKeyPrefix: 'pnl-change-chart',
    sdkReady: !isLoadingPositions && blendSnapshot !== undefined,
  })

  return {
    ...result,
    // Surface the SDK-loading signal too, like the original hook did.
    isLoading: isLoadingPositions || result.isLoading,
  }
}
