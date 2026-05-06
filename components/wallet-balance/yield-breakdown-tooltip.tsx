"use client"

import { Skeleton } from "@/components/ui/skeleton"
import type { TimePeriod, EarningsStats } from "@/types/balance-history"
import type { FormatCurrencyOptions } from "@/lib/currency/format"
import { formatPercentage } from "./helpers"

interface PeriodYieldBreakdownTotals {
  protocolYieldUsd: number
  priceChangeUsd: number
  totalEarnedUsd: number
  valueAtStart: number
  valueNow: number
}

interface PeriodYieldBreakdownAPIData {
  isFetching: boolean
  isLoading: boolean
  totals: PeriodYieldBreakdownTotals
  periodDays: number
  periodStartDate: string | null
}

interface YieldBreakdownData {
  totalCostBasisHistorical: number
  totalProtocolYieldUsd: number
  totalPriceChangeUsd: number
  totalEarnedUsd: number
}

interface BalanceHistoryDataLite {
  earningsStats?: EarningsStats
}

interface BackstopPositionLite {
  poolId: string
  poolName: string
  lpTokens: number
  lpTokensUsd: number
  interestApr: number
  emissionApy: number
  yieldPercent?: number
}

export interface YieldBreakdownTooltipProps {
  selectedPeriod: TimePeriod
  periodYieldBreakdownAPI: PeriodYieldBreakdownAPIData
  yieldBreakdown?: YieldBreakdownData
  balanceHistoryData?: BalanceHistoryDataLite
  actualPeriodDays: number
  backstopPositions?: BackstopPositionLite[]
  formatInCurrency: (amount: number, options?: FormatCurrencyOptions) => string
}

/**
 * Body content for the wallet-balance growth tooltip.
 *
 * Renders a multi-branch breakdown depending on which data sources are available:
 * 1. Period yield breakdown API (preferred — has period-specific data)
 * 2. All-time `yieldBreakdown` prop (fallback)
 * 3. Backstop-only summary (when only backstop positions are present)
 * 4. Plain APY note (fallback for legacy data)
 */
export function YieldBreakdownTooltip({
  selectedPeriod,
  periodYieldBreakdownAPI,
  yieldBreakdown,
  balanceHistoryData,
  actualPeriodDays,
  backstopPositions,
  formatInCurrency,
}: YieldBreakdownTooltipProps) {
  if (periodYieldBreakdownAPI.isFetching) {
    return (
      <div className="space-y-2 w-40">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-2.5 w-14" />
          </div>
          <div className="flex justify-between gap-4">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-14" />
          </div>
          <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4">
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
      </div>
    )
  }

  if (!periodYieldBreakdownAPI.isLoading && periodYieldBreakdownAPI.totals.valueNow > 0) {
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="font-semibold text-xs text-zinc-200 mb-2">
          Breakdown ({selectedPeriod === "All" ? "All Time" : selectedPeriod})
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Yield:</span>
          <span className={periodYieldBreakdownAPI.totals.protocolYieldUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(periodYieldBreakdownAPI.totals.protocolYieldUsd, { showSign: true })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Price Change:</span>
          <span className={periodYieldBreakdownAPI.totals.priceChangeUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(periodYieldBreakdownAPI.totals.priceChangeUsd, { showSign: true })}
          </span>
        </div>
        <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4 font-medium">
          <span className="text-zinc-300">Total:</span>
          <span className={periodYieldBreakdownAPI.totals.totalEarnedUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(periodYieldBreakdownAPI.totals.totalEarnedUsd, { showSign: true })}
          </span>
        </div>
        {periodYieldBreakdownAPI.periodDays > 0 && (
          <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4">
            <span className="text-zinc-400">Yield APY:</span>
            <span className="text-zinc-300">
              {(() => {
                // 1. Use supply APY if available and > 0 (for "All" or "Projection")
                if ((selectedPeriod === "All" || selectedPeriod === "Projection") &&
                    balanceHistoryData?.earningsStats?.currentAPY &&
                    balanceHistoryData.earningsStats.currentAPY > 0) {
                  return formatPercentage(balanceHistoryData.earningsStats.currentAPY)
                }
                // 2. For other periods: if periodDays covers all user data, use pre-calculated APY for consistency
                const totalDays = balanceHistoryData?.earningsStats?.dayCount || 0
                if (totalDays > 0 && periodYieldBreakdownAPI.periodDays >= totalDays &&
                    balanceHistoryData?.earningsStats?.currentAPY &&
                    balanceHistoryData.earningsStats.currentAPY > 0) {
                  return formatPercentage(balanceHistoryData.earningsStats.currentAPY)
                }
                // 3. Calculate from API data using valueAtStart (balance at period start)
                const valueAtStart = periodYieldBreakdownAPI.totals.valueAtStart
                if (valueAtStart > 0 && periodYieldBreakdownAPI.totals.protocolYieldUsd !== 0) {
                  const apy = (periodYieldBreakdownAPI.totals.protocolYieldUsd / valueAtStart) * (365 / periodYieldBreakdownAPI.periodDays) * 100
                  return formatPercentage(apy)
                }
                // 4. Fallback: derive cost basis from current value
                const costBasis = periodYieldBreakdownAPI.totals.valueNow - periodYieldBreakdownAPI.totals.totalEarnedUsd
                if (costBasis > 0 && periodYieldBreakdownAPI.totals.protocolYieldUsd !== 0) {
                  const apy = (periodYieldBreakdownAPI.totals.protocolYieldUsd / costBasis) * (365 / periodYieldBreakdownAPI.periodDays) * 100
                  return formatPercentage(apy)
                }
                // 5. Use yieldBreakdown cost basis if available
                if (yieldBreakdown?.totalCostBasisHistorical && yieldBreakdown.totalCostBasisHistorical > 0) {
                  const apy = (periodYieldBreakdownAPI.totals.protocolYieldUsd / yieldBreakdown.totalCostBasisHistorical) * (365 / periodYieldBreakdownAPI.periodDays) * 100
                  return apy.toFixed(2)
                }
                return "0.00"
              })()}%
            </span>
          </div>
        )}
        <p className="text-[10px] text-zinc-500 pt-1">
          Over {periodYieldBreakdownAPI.periodDays} days{periodYieldBreakdownAPI.periodStartDate && ` (from ${periodYieldBreakdownAPI.periodStartDate})`}
        </p>
      </div>
    )
  }

  if (yieldBreakdown && yieldBreakdown.totalCostBasisHistorical > 0) {
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="font-semibold text-xs text-zinc-200 mb-2">Breakdown (All Time)</div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Yield:</span>
          <span className={yieldBreakdown.totalProtocolYieldUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(yieldBreakdown.totalProtocolYieldUsd, { showSign: true })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Price Change:</span>
          <span className={yieldBreakdown.totalPriceChangeUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(yieldBreakdown.totalPriceChangeUsd, { showSign: true })}
          </span>
        </div>
        <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4 font-medium">
          <span className="text-zinc-300">Total:</span>
          <span className={yieldBreakdown.totalEarnedUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatInCurrency(yieldBreakdown.totalEarnedUsd, { showSign: true })}
          </span>
        </div>
        {actualPeriodDays > 0 && (
          <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4">
            <span className="text-zinc-400">Yield APY:</span>
            <span className="text-zinc-300">
              {balanceHistoryData?.earningsStats?.currentAPY !== undefined
                ? formatPercentage(balanceHistoryData.earningsStats.currentAPY)
                : yieldBreakdown.totalCostBasisHistorical > 0
                  ? ((yieldBreakdown.totalProtocolYieldUsd / yieldBreakdown.totalCostBasisHistorical) * (365 / actualPeriodDays) * 100).toFixed(2)
                  : "0.00"}%
            </span>
          </div>
        )}
        <div className="border-t border-zinc-700 pt-1 text-zinc-500">
          <div className="flex justify-between gap-4">
            <span>Cost Basis:</span>
            <span className="text-zinc-300">{formatInCurrency(yieldBreakdown.totalCostBasisHistorical)}</span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 pt-1">
          Over {actualPeriodDays} days
        </p>
      </div>
    )
  }

  if (backstopPositions && backstopPositions.length > 0 && backstopPositions.some(bp => bp.lpTokens > 0)) {
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="font-medium text-zinc-400 border-b border-zinc-700 pb-1">Backstop Position</div>
        {backstopPositions.filter(bp => bp.lpTokens > 0).map(bp => (
          <div key={bp.poolId} className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">{bp.poolName}:</span>
              <span className="text-zinc-300">{formatInCurrency(bp.lpTokensUsd)}</span>
            </div>
            <div className="flex justify-between gap-4 pl-2">
              <span className="text-zinc-500">Interest APR:</span>
              <span className="text-emerald-400">{formatPercentage(bp.interestApr)}%</span>
            </div>
            <div className="flex justify-between gap-4 pl-2">
              <span className="text-zinc-500">BLND Emissions:</span>
              <span className="text-emerald-400">{formatPercentage(bp.emissionApy)}%</span>
            </div>
            {bp.yieldPercent !== undefined && bp.yieldPercent > 0 && (
              <div className="flex justify-between gap-4 pl-2">
                <span className="text-zinc-500">Total Yield:</span>
                <span className="text-emerald-400">+{formatPercentage(bp.yieldPercent)}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <p>Yield APY: {formatPercentage(balanceHistoryData?.earningsStats?.currentAPY ?? 0)}%</p>
      <p className="text-[10px] text-zinc-500">Over {actualPeriodDays} days</p>
    </>
  )
}
