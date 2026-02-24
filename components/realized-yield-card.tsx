"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, ChevronDown, ArrowUpRight, ArrowDownLeft, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRealizedYield } from "@/hooks/use-realized-yield"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"

interface RealizedYieldCardProps {
  publicKey: string
  blndPrice?: number
  lpTokenPrice?: number
  sdkPrices?: Record<string, number>
  currentPositionUsd?: number
  unrealizedPnl?: number
  isLoading?: boolean
}

export function RealizedYieldCard({
  publicKey,
  blndPrice = 0,
  lpTokenPrice = 0,
  sdkPrices = {},
  currentPositionUsd = 0,
  unrealizedPnl = 0,
  isLoading: externalLoading = false,
}: RealizedYieldCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { format: formatInCurrency } = useCurrencyPreference()

  const { data, isLoading: dataLoading } = useRealizedYield({
    publicKey,
    sdkBlndPrice: blndPrice,
    sdkLpPrice: lpTokenPrice,
    sdkPrices,
    enabled: !!publicKey,
  })

  const isLoading = externalLoading || dataLoading

  const formatUsd = (value: number) => {
    if (!Number.isFinite(value)) return formatInCurrency(0)
    return formatInCurrency(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  if (isLoading) {
    return (
      <Card className="p-0 gap-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </Card>
    )
  }

  // Don't show if no data or no activity
  if (!data || (data.totalDepositedUsd === 0 && data.totalWithdrawnUsd === 0)) {
    return null
  }

  const isPositive = data.realizedPnl >= 0
  const totalPnl = data.realizedPnl + unrealizedPnl

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <div
        className="cursor-pointer select-none flex items-center justify-between px-4 py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-400" />
          )}
          <div>
            <div className="text-base font-semibold">
              <span className={isPositive ? "text-emerald-400" : "text-red-400"}>
                {isPositive ? "+" : ""}{formatUsd(data.realizedPnl)}
              </span>
              <span className="text-muted-foreground text-sm font-normal ml-1.5">realized</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatUsd(data.totalWithdrawnUsd)} withdrawn
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.roiPercent !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                  <Badge
                    variant="outline"
                    className={`text-xs ${isPositive ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-400/30"}`}
                  >
                    {isPositive ? "+" : ""}{data.roiPercent.toFixed(1)}% ROI
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Return on {formatUsd(data.totalDepositedUsd)} deposited</p>
                  {data.annualizedRoiPercent !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{data.annualizedRoiPercent.toFixed(1)}% annualized ({data.daysActive} days)
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ChevronDown
            className={`h-4 w-4 mx-2 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 pt-2 pb-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Deposited</div>
              <div className="font-semibold tabular-nums text-sm">{formatUsd(data.totalDepositedUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Withdrawn</div>
              <div className="font-semibold tabular-nums text-sm">{formatUsd(data.totalWithdrawnUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Net Realized</div>
              <div className={`font-semibold tabular-nums text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{formatUsd(data.realizedPnl)}
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Breakdown by source */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-2">Breakdown by Source</div>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-muted-foreground pb-1 border-b border-border/50">
              <div></div>
              <div className="w-20 text-right">Deposited</div>
              <div className="w-20 text-right">Withdrawn</div>
              <div className="w-20 text-right">Realized</div>
            </div>

            {/* Pools row */}
            {(data.pools.deposited > 0 || data.pools.withdrawn > 0) && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs py-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                  <span>Pools</span>
                </div>
                <div className="w-20 text-right tabular-nums">
                  {data.pools.deposited > 0 ? formatUsd(data.pools.deposited) : '-'}
                </div>
                <div className="w-20 text-right tabular-nums">
                  {data.pools.withdrawn > 0 ? formatUsd(data.pools.withdrawn) : '-'}
                </div>
                <div className={`w-20 text-right tabular-nums font-medium ${data.pools.realized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.pools.realized !== 0 ? (data.pools.realized >= 0 ? "+" : "") + formatUsd(data.pools.realized) : '-'}
                </div>
              </div>
            )}

            {/* Backstop row */}
            {(data.backstop.deposited > 0 || data.backstop.withdrawn > 0) && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs py-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-purple-500" />
                  <span>Backstop</span>
                </div>
                <div className="w-20 text-right tabular-nums">
                  {data.backstop.deposited > 0 ? formatUsd(data.backstop.deposited) : '-'}
                </div>
                <div className="w-20 text-right tabular-nums">
                  {data.backstop.withdrawn > 0 ? formatUsd(data.backstop.withdrawn) : '-'}
                </div>
                <div className={`w-20 text-right tabular-nums font-medium ${data.backstop.realized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.backstop.realized !== 0 ? (data.backstop.realized >= 0 ? "+" : "") + formatUsd(data.backstop.realized) : '-'}
                </div>
              </div>
            )}

            {/* Emissions row */}
            {data.emissions.usdValue > 0 && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs py-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  <span>Emissions</span>
                </div>
                <div className="w-20 text-right tabular-nums text-muted-foreground">-</div>
                <div className="w-20 text-right tabular-nums">
                  {formatUsd(data.emissions.usdValue)}
                </div>
                <div className="w-20 text-right tabular-nums font-medium text-emerald-400">
                  +{formatUsd(data.emissions.usdValue)}
                </div>
              </div>
            )}

            {/* Total row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-sm pt-2 border-t border-border/50 font-medium">
              <div>Total</div>
              <div className="w-20 text-right tabular-nums">{formatUsd(data.totalDepositedUsd)}</div>
              <div className="w-20 text-right tabular-nums">{formatUsd(data.totalWithdrawnUsd)}</div>
              <div className={`w-20 text-right tabular-nums ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{formatUsd(data.realizedPnl)}
              </div>
            </div>
          </div>

          {/* Total P&L summary including unrealized */}
          {(currentPositionUsd > 0 || unrealizedPnl !== 0) && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Realized P&L</span>
                  <span className={`font-semibold tabular-nums ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{formatUsd(data.realizedPnl)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Unrealized P&L</span>
                  <span className={`font-semibold tabular-nums ${unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {unrealizedPnl >= 0 ? "+" : ""}{formatUsd(unrealizedPnl)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                  <span className="font-medium">Total Lifetime P&L</span>
                  <span className={`font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {totalPnl >= 0 ? "+" : ""}{formatUsd(totalPnl)}
                  </span>
                </div>
                {currentPositionUsd > 0 && (
                  <div className="text-xs text-muted-foreground text-right">
                    Current position: {formatUsd(currentPositionUsd)}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Activity period */}
          {data.firstActivityDate && (
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Active since {new Date(data.firstActivityDate).toLocaleDateString()} ({data.daysActive} days)
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
