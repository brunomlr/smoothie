"use client"

import { Flame, Shield } from "lucide-react"
import { formatNumber } from "./helpers"

interface BackstopPositionLite {
  lpTokensUsd?: number
  emissionApy?: number
}

export interface YieldProjectionGridProps {
  blndPrice: number
  lpTokenPrice: number | null | undefined
  blndApy: number
  totalPositionUsd: number
  backstopPositions: BackstopPositionLite[]
  formatUsd: (value: number) => string
}

/**
 * Daily / Monthly / Annual projected yield breakdown.
 *
 * Aggregates BLND emissions yield from supply/borrow positions and LP yield
 * from backstop positions, then converts each to a USD column with token
 * sub-amounts underneath.
 */
export function YieldProjectionGrid({
  blndPrice,
  lpTokenPrice,
  blndApy,
  totalPositionUsd,
  backstopPositions,
  formatUsd,
}: YieldProjectionGridProps) {
  const hasLpPositions = backstopPositions.length > 0

  // Backstop totals weighted by position USD value
  let totalBackstopUsd = 0
  let weightedBackstopApy = 0
  backstopPositions.forEach(bp => {
    const posUsd = bp.lpTokensUsd || 0
    const posApy = bp.emissionApy || 0
    totalBackstopUsd += posUsd
    weightedBackstopApy += posUsd * posApy
  })
  const backstopApy = totalBackstopUsd > 0 ? weightedBackstopApy / totalBackstopUsd : 0

  // BLND projections: supply/borrow positions × their BLND APY.
  // blndApy and totalPositionUsd are both supply/borrow only (exclude backstop).
  const annualBlndUsd = totalPositionUsd * (blndApy / 100)
  const annualBlnd = blndPrice > 0 ? annualBlndUsd / blndPrice : 0
  const monthlyBlnd = annualBlnd / 12
  const dailyBlnd = annualBlnd / 365

  // LP yield: backstop position value × emission APY → USD → LP tokens
  const annualLpUsd = totalBackstopUsd * (backstopApy / 100)
  const annualLp = lpTokenPrice && lpTokenPrice > 0 ? annualLpUsd / lpTokenPrice : 0
  const monthlyLp = annualLp / 12
  const dailyLp = annualLp / 365

  // Combined USD totals
  const dailyBlndUsd = dailyBlnd * blndPrice
  const dailyLpUsd = dailyLp * (lpTokenPrice || 0)
  const dailyTotalUsd = dailyBlndUsd + dailyLpUsd
  const monthlyTotalUsd = dailyTotalUsd * 30
  const annualTotalUsd = dailyTotalUsd * 365

  const hasBlndPositions = blndApy > 0 && totalPositionUsd > 0

  return (
    <div className="grid grid-cols-3 gap-3 text-center mt-8">
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Daily</div>
        <div className="font-semibold tabular-nums text-sm">{formatUsd(dailyTotalUsd)}</div>
        {hasBlndPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Flame className="h-2.5 w-2.5" />
            {formatNumber(dailyBlnd, 2)}
          </div>
        )}
        {hasLpPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Shield className="h-2.5 w-2.5" />
            {dailyLp > 0 ? formatNumber(dailyLp, 2) : '-'}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Monthly</div>
        <div className="font-semibold tabular-nums text-sm">{formatUsd(monthlyTotalUsd)}</div>
        {hasBlndPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Flame className="h-2.5 w-2.5" />
            {formatNumber(monthlyBlnd, 2)}
          </div>
        )}
        {hasLpPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Shield className="h-2.5 w-2.5" />
            {monthlyLp > 0 ? formatNumber(monthlyLp, 2) : '-'}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Annual</div>
        <div className="font-semibold tabular-nums text-sm">{formatUsd(annualTotalUsd)}</div>
        {hasBlndPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Flame className="h-2.5 w-2.5" />
            {formatNumber(annualBlnd, 2)}
          </div>
        )}
        {hasLpPositions && (
          <div className="tabular-nums text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Shield className="h-2.5 w-2.5" />
            {annualLp > 0 ? formatNumber(annualLp, 2) : '-'}
          </div>
        )}
      </div>
    </div>
  )
}
