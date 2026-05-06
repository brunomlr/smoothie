"use client"

import { memo, useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  LabelList,
} from "recharts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import { useTooltipDismiss } from "@/hooks/use-tooltip-dismiss"
import type { PnlChangeDataPoint, PnlPeriodType } from "@/hooks/use-pnl-change-chart"
import { transformDataForYieldChart, transformDataForPriceChart } from "./pnl-change-chart/transforms"
import { NegativeLabel, createPositiveLabelRenderer } from "./pnl-change-chart/labels"
import { RoundedBar } from "./pnl-change-chart/rounded-bar"
import { YieldTooltip, PriceChangeTooltip } from "./pnl-change-chart/tooltips"
import { formatCompact } from "./pnl-change-chart/format-utils"

interface PnlChangeChartProps {
  data: PnlChangeDataPoint[] | undefined
  period: PnlPeriodType
  onPeriodChange: (period: PnlPeriodType) => void
  showPriceChanges: boolean
  isLoading?: boolean
}

const TIME_PERIODS: { value: PnlPeriodType; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  // 6M temporarily disabled - historical emission APY data only available for ~30 days
  // { value: "6M", label: "6M" },
]

export const PnlChangeChart = memo(function PnlChangeChart({
  data,
  period,
  onPeriodChange,
  showPriceChanges,
  isLoading = false,
}: PnlChangeChartProps) {
  const { format: formatCurrency } = useCurrencyPreference()
  // Separate tooltip hooks for each chart to prevent interference
  const { containerRef: yieldContainerRef, shouldRenderTooltip: shouldRenderYieldTooltip } = useTooltipDismiss()
  const { containerRef: priceContainerRef, shouldRenderTooltip: shouldRenderPriceTooltip } = useTooltipDismiss()

  const yieldChartData = useMemo(() => {
    if (!data) return []
    return transformDataForYieldChart(data)
  }, [data])

  const positiveLabelRenderer = useMemo(
    () => createPositiveLabelRenderer(yieldChartData),
    [yieldChartData]
  )

  const priceChartData = useMemo(() => {
    if (!data) return []
    return transformDataForPriceChart(data)
  }, [data])

  const yieldDomain = useMemo(() => {
    if (yieldChartData.length === 0) return { min: 0, max: 1 }

    let min = 0
    let max = 0

    yieldChartData.forEach(d => {
      const positiveSum = d.supplyApyBar + d.supplyBlndApyBar + d.backstopYieldPositiveBar + d.backstopBlndApyBar + d.borrowBlndApyBar
      const negativeSum = d.backstopYieldNegativeBar + d.borrowInterestCostBar

      max = Math.max(max, positiveSum)
      min = Math.min(min, negativeSum)
    })

    const padding = Math.max(Math.abs(max), Math.abs(min)) * 0.1
    return { min: min - padding, max: max + padding }
  }, [yieldChartData])

  const priceDomain = useMemo(() => {
    if (priceChartData.length === 0) return { min: 0, max: 1 }

    let min = 0
    let max = 0

    priceChartData.forEach(d => {
      max = Math.max(max, d.priceChangePositive)
      min = Math.min(min, d.priceChangeNegative)
    })

    const padding = Math.max(Math.abs(max), Math.abs(min)) * 0.1
    return { min: min - padding, max: max + padding }
  }, [priceChartData])

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="aspect-[3/1] md:aspect-[4/1] w-full" />
        <Skeleton className="aspect-[5/1] md:aspect-[6/1] w-full" />
        <div className="flex justify-center">
          <Skeleton className="h-9 sm:h-10 w-40 rounded-md" />
        </div>
      </div>
    )
  }

  const hasYieldData = yieldChartData.some(
    d =>
      d.supplyApyBar !== 0 ||
      d.supplyBlndApyBar !== 0 ||
      d.backstopYieldPositiveBar !== 0 ||
      d.backstopYieldNegativeBar !== 0 ||
      d.backstopBlndApyBar !== 0 ||
      d.borrowBlndApyBar !== 0 ||
      d.borrowInterestCostBar !== 0
  )

  const hasPriceData = priceChartData.some(
    d => d.priceChangePositive !== 0 || d.priceChangeNegative !== 0
  )

  const barSize = period === "1M" ? 25 : period === "1W" ? 40 : 60
  const barGap = yieldChartData.length <= 7 ? "20%" : yieldChartData.length <= 14 ? "10%" : "5%"

  return (
    <div className="space-y-3">
      {/* Yield Chart */}
      {!hasYieldData ? (
        <div className="aspect-[3/1] md:aspect-[4/1] flex items-center justify-center text-muted-foreground text-sm">
          No yield data for this period
        </div>
      ) : (
        <div ref={yieldContainerRef}>
          <div className="text-[10px] text-muted-foreground font-medium tracking-wide px-1">
            Yield Earnings (Approx.)
          </div>
          <div className="aspect-[2/1] md:aspect-[4/1] w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yieldChartData}
                margin={{ top: 35, right: 10, left: 10, bottom: 20 }}
                stackOffset="sign"
                barCategoryGap={barGap}
              >
                <defs>
                  <linearGradient id="supplyApyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(217 91% 55%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="supplyBlndGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(199 89% 48%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(199 89% 43%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="backstopYieldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(263 70% 57%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(263 70% 52%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="backstopBlndGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(271 81% 66%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(271 81% 61%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="borrowBlndGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(43 96% 56%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(43 96% 51%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="negativeGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(0 84% 55%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="borrowCostGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="hsl(24 95% 53%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(24 95% 48%)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>

                <XAxis dataKey="period" hide />
                <YAxis hide domain={[yieldDomain.min, yieldDomain.max]} />
                {yieldDomain.min < 0 && (
                  <ReferenceLine y={0} stroke="white" strokeOpacity={0.05} />
                )}

                <Bar dataKey="supplyApyBar" stackId="yield" fill="url(#supplyApyGradient)" shape={(props: unknown) => <RoundedBar {...(props as Omit<Parameters<typeof RoundedBar>[0], "dataKey">)} dataKey="supplyApyBar" />} maxBarSize={barSize} isAnimationActive={false} />
                <Bar dataKey="supplyBlndApyBar" stackId="yield" fill="url(#supplyBlndGradient)" shape={(props: unknown) => <RoundedBar {...(props as Omit<Parameters<typeof RoundedBar>[0], "dataKey">)} dataKey="supplyBlndApyBar" />} maxBarSize={barSize} isAnimationActive={false} />
                <Bar dataKey="backstopYieldPositiveBar" stackId="yield" fill="url(#backstopYieldGradient)" shape={(props: unknown) => <RoundedBar {...(props as Omit<Parameters<typeof RoundedBar>[0], "dataKey">)} dataKey="backstopYieldPositiveBar" />} maxBarSize={barSize} isAnimationActive={false} />
                <Bar dataKey="backstopBlndApyBar" stackId="yield" fill="url(#backstopBlndGradient)" shape={(props: unknown) => <RoundedBar {...(props as Omit<Parameters<typeof RoundedBar>[0], "dataKey">)} dataKey="backstopBlndApyBar" />} maxBarSize={barSize} isAnimationActive={false} />
                <Bar dataKey="borrowBlndApyBar" stackId="yield" fill="url(#borrowBlndGradient)" shape={(props: unknown) => <RoundedBar {...(props as Omit<Parameters<typeof RoundedBar>[0], "dataKey">)} dataKey="borrowBlndApyBar" />} maxBarSize={barSize} isAnimationActive={false}>
                  {period !== "1M" && (
                    <LabelList
                      dataKey="positiveTotal"
                      content={positiveLabelRenderer}
                    />
                  )}
                </Bar>
                <Bar dataKey="backstopYieldNegativeBar" stackId="yield" fill="url(#negativeGradient)" radius={[4, 4, 2, 2]} maxBarSize={barSize} isAnimationActive={false} />
                <Bar dataKey="borrowInterestCostBar" stackId="yield" fill="url(#borrowCostGradient)" radius={[4, 4, 2, 2]} maxBarSize={barSize} isAnimationActive={false}>
                  {period !== "1M" && (
                    <LabelList
                      dataKey="negativeTotal"
                      content={<NegativeLabel />}
                    />
                  )}
                </Bar>

                {shouldRenderYieldTooltip && (
                  <Tooltip
                    content={<YieldTooltip formatCurrency={formatCurrency} />}
                    cursor={{ fill: "transparent" }}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Yield Legend - only show items with data */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground -mt-3">
            {yieldChartData.some(d => d.supplyApyBar > 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-500" />
                <span>Supply APY</span>
              </div>
            )}
            {yieldChartData.some(d => d.supplyBlndApyBar > 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-sky-500" />
                <span>Supply BLND</span>
              </div>
            )}
            {yieldChartData.some(d => d.backstopYieldPositiveBar > 0 || d.backstopYieldNegativeBar < 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-violet-500" />
                <span>Backstop Yield</span>
              </div>
            )}
            {yieldChartData.some(d => d.backstopBlndApyBar > 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-purple-400" />
                <span>Backstop BLND</span>
              </div>
            )}
            {yieldChartData.some(d => d.borrowInterestCostBar < 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-orange-500" />
                <span>Borrow Cost</span>
              </div>
            )}
            {yieldChartData.some(d => d.borrowBlndApyBar > 0) && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-amber-500" />
                <span>Borrow BLND</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showPriceChanges && (
        <div ref={priceContainerRef} className="space-y-1 mt-8">
          <div className="text-[10px] text-muted-foreground font-medium tracking-wide px-1">
            Price Changes
          </div>
          {!hasPriceData ? (
            <div className="aspect-[5/1] md:aspect-[6/1] flex items-center justify-center text-muted-foreground text-sm">
              No price changes in this period
            </div>
          ) : (
            <div className="aspect-[3/1] md:aspect-[5/1] w-full select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priceChartData}
                  margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                  stackOffset="sign"
                  barCategoryGap={barGap}
                >
                  <defs>
                    <linearGradient id="pricePositiveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142 76% 46%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(142 76% 40%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="priceNegativeGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(0 84% 55%)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>

                  <XAxis dataKey="period" hide />
                  <YAxis hide domain={[priceDomain.min, priceDomain.max]} />
                  {priceDomain.min < 0 && (
                    <ReferenceLine y={0} stroke="white" strokeOpacity={0.05} />
                  )}

                  <Bar dataKey="priceChangePositive" stackId="price" fill="url(#pricePositiveGradient)" radius={[4, 4, 2, 2]} maxBarSize={barSize} isAnimationActive={false}>
                    {period !== "1M" && (
                      <LabelList
                        dataKey="priceChange"
                        position="top"
                        formatter={(value: number) => value > 0 ? formatCompact(value) : ""}
                        style={{ fontSize: 9, fill: "white", fontWeight: 500 }}
                      />
                    )}
                  </Bar>
                  <Bar dataKey="priceChangeNegative" stackId="price" fill="url(#priceNegativeGradient)" radius={[4, 4, 2, 2]} maxBarSize={barSize} isAnimationActive={false}>
                    {period !== "1M" && (
                      <LabelList
                        dataKey="priceChange"
                        position="bottom"
                        formatter={(value: number) => value < 0 ? formatCompact(value) : ""}
                        style={{ fontSize: 9, fill: "white", fontWeight: 500 }}
                      />
                    )}
                  </Bar>

                  {shouldRenderPriceTooltip && (
                    <Tooltip
                      content={<PriceChangeTooltip formatCurrency={formatCurrency} />}
                      cursor={{ fill: "transparent" }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Time period tabs */}
      <div className="flex justify-center pt-1">
        <Tabs value={period} onValueChange={v => onPeriodChange(v as PnlPeriodType)}>
          <TabsList className="h-9 sm:h-10 bg-transparent gap-2">
            {TIME_PERIODS.map(p => (
              <TabsTrigger
                key={p.value}
                value={p.value}
                className="text-xs sm:text-sm px-3 sm:px-4"
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
})
