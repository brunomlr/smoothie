"use client"

import { useState, useMemo } from "react"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { format, parseISO } from "date-fns"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartTooltipContainer } from "@/components/charts/tooltips/chart-tooltip"
import {
  usePoolTokenTvlHistory,
  type PoolTokenHistoryData,
  type TokenMeta,
} from "@/hooks/use-pool-token-tvl-history"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import { useTooltipDismiss } from "@/hooks/use-tooltip-dismiss"

// Pool display order (matches PoolTvlHistoryChart)
const POOL_ORDER = ['Fixed', 'YieldBlox', 'Orbit', 'Forex', 'Etherfuse']

const TOTAL_KEY = '__total__'

// Distinct colors for token series. Cycles if a pool has more tokens than colors.
const TOKEN_COLORS = [
  "#34d399", // emerald
  "#60a5fa", // blue
  "#fb923c", // orange
  "#a78bfa", // violet
  "#f472b6", // pink
  "#facc15", // yellow
  "#2dd4bf", // teal
  "#f87171", // red
  "#818cf8", // indigo
  "#4ade80", // green
  "#fbbf24", // amber
  "#c084fc", // purple
]

type Metric = "supplied" | "borrowed"
type Unit = "fiat" | "tokens"

function formatTokenCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  if (abs >= 1) return value.toFixed(2)
  if (abs === 0) return "0"
  return value.toPrecision(2)
}

// Pull the right numeric field for the active metric + unit out of an entry.
function entryField(metric: Metric, unit: Unit): keyof {
  suppliedUsd: number
  borrowedUsd: number
  suppliedTokens: number
  borrowedTokens: number
} {
  if (metric === "supplied") return unit === "fiat" ? "suppliedUsd" : "suppliedTokens"
  return unit === "fiat" ? "borrowedUsd" : "borrowedTokens"
}

interface TooltipEntry {
  assetAddress: string
  symbol: string
  color: string
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: Record<string, number | string> }>
  label?: string
  tokensByAddress: Map<string, TokenMeta>
  colorByAddress: Map<string, string>
  unit: Unit
  formatFiat: (usd: number) => string
}

function CustomTooltip({
  active,
  payload,
  tokensByAddress,
  colorByAddress,
  unit,
  formatFiat,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const date = payload[0]?.payload?.date as string | undefined

  const entries: TooltipEntry[] = payload
    .map((p) => ({
      assetAddress: p.dataKey,
      symbol: tokensByAddress.get(p.dataKey)?.symbol ?? p.dataKey.slice(0, 4),
      color: colorByAddress.get(p.dataKey) ?? "#a1a1aa",
      value: p.value ?? 0,
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)

  if (entries.length === 0) return null

  const total = entries.reduce((sum, e) => sum + e.value, 0)
  const fmt = (v: number) => (unit === "fiat" ? formatFiat(v) : formatTokenCompact(v))

  return (
    <ChartTooltipContainer className="px-3 py-2 min-w-[160px]">
      {date && (
        <p className="text-zinc-400 mb-1.5">
          {format(parseISO(date), "MMM d, yyyy")}
        </p>
      )}
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.assetAddress} className="flex justify-between gap-4 items-center">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: e.color }}
              />
              {e.symbol}
            </span>
            <span className="font-medium">{fmt(e.value)}</span>
          </div>
        ))}
      </div>
      {/* Total only meaningful in fiat mode (token units aren't additive across assets) */}
      {unit === "fiat" && entries.length > 1 && (
        <div className="flex justify-between gap-4 mt-1.5 pt-1.5 border-t border-zinc-800">
          <span className="text-zinc-400">Total</span>
          <span className="font-semibold">{fmt(total)}</span>
        </div>
      )}
    </ChartTooltipContainer>
  )
}

interface AssembledChart {
  tokens: Array<TokenMeta & { color: string }>
  chartData: Array<Record<string, number | string>>
}

/**
 * Assemble chart rows for the selected pool (or aggregated total) given the
 * active metric + unit. Each row is { date, [assetAddress]: number }.
 */
function assembleChart(
  data: PoolTokenHistoryData,
  selectedPoolId: string,
  metric: Metric,
  unit: Unit
): AssembledChart {
  const field = entryField(metric, unit)

  const sourcePools =
    selectedPoolId === TOTAL_KEY
      ? Object.values(data.pools)
      : data.pools[selectedPoolId]
        ? [data.pools[selectedPoolId]]
        : []

  // date -> assetAddress -> summed value
  const byDate = new Map<string, Map<string, number>>()
  // assetAddress -> meta + latest value (for ordering)
  const tokenMetaMap = new Map<string, TokenMeta>()
  const latestValue = new Map<string, number>()

  for (const pool of sourcePools) {
    for (const t of pool.tokens) {
      if (!tokenMetaMap.has(t.assetAddress)) tokenMetaMap.set(t.assetAddress, t)
    }
    for (const point of pool.history) {
      let row = byDate.get(point.date)
      if (!row) {
        row = new Map()
        byDate.set(point.date, row)
      }
      for (const [assetAddress, entry] of Object.entries(point.tokens)) {
        const value = entry[field]
        row.set(assetAddress, (row.get(assetAddress) ?? 0) + value)
      }
    }
  }

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b))

  // Order tokens by their value on the most recent date (desc) so the largest
  // stacks at the bottom and the legend reads largest-first.
  const lastDate = sortedDates[sortedDates.length - 1]
  const lastRow = lastDate ? byDate.get(lastDate) : undefined
  for (const assetAddress of tokenMetaMap.keys()) {
    latestValue.set(assetAddress, lastRow?.get(assetAddress) ?? 0)
  }

  const orderedTokens = Array.from(tokenMetaMap.values())
    .sort((a, b) => {
      const av = latestValue.get(a.assetAddress) ?? 0
      const bv = latestValue.get(b.assetAddress) ?? 0
      if (bv !== av) return bv - av
      return a.symbol.localeCompare(b.symbol)
    })
    .map((t, i) => ({ ...t, color: TOKEN_COLORS[i % TOKEN_COLORS.length] }))

  const chartData = sortedDates.map((date) => {
    const row = byDate.get(date)!
    const out: Record<string, number | string> = { date }
    for (const t of orderedTokens) {
      out[t.assetAddress] = row.get(t.assetAddress) ?? 0
    }
    return out
  })

  return { tokens: orderedTokens, chartData }
}

export function PoolTokenTvlChart() {
  const { data, isLoading, error } = usePoolTokenTvlHistory()
  const { currency, format: formatInCurrency } = useCurrencyPreference()
  const { containerRef, shouldRenderTooltip } = useTooltipDismiss()

  const [selectedPoolId, setSelectedPoolId] = useState<string>(TOTAL_KEY)
  const [metric, setMetric] = useState<Metric>("supplied")
  const [unit, setUnit] = useState<Unit>("fiat")

  const poolList = useMemo(() => {
    if (!data?.pools) return []
    return Object.entries(data.pools)
      .map(([poolId, pool]) => ({ poolId, name: pool.name }))
      .sort((a, b) => {
        const aIndex = POOL_ORDER.indexOf(a.name)
        const bIndex = POOL_ORDER.indexOf(b.name)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.name.localeCompare(b.name)
      })
  }, [data])

  const { tokens, chartData } = useMemo(() => {
    if (!data?.pools) return { tokens: [], chartData: [] }
    return assembleChart(data, selectedPoolId, metric, unit)
  }, [data, selectedPoolId, metric, unit])

  const tokensByAddress = useMemo(
    () => new Map(tokens.map((t) => [t.assetAddress, t])),
    [tokens]
  )
  const colorByAddress = useMemo(
    () => new Map(tokens.map((t) => [t.assetAddress, t.color])),
    [tokens]
  )

  const formatFiat = (usd: number) =>
    formatInCurrency(usd, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const fiatCompact = (usd: number) =>
    formatInCurrency(usd, {
      compact: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">TVL by Token</h2>
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data || poolList.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold">TVL by Token</h2>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Supplied / Borrowed */}
          <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <TabsList className="h-8">
              <TabsTrigger value="supplied" className="text-xs px-2 sm:text-sm sm:px-3">
                Supplied
              </TabsTrigger>
              <TabsTrigger value="borrowed" className="text-xs px-2 sm:text-sm sm:px-3">
                Borrowed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Currency / Token units */}
          <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
            <TabsList className="h-8">
              <TabsTrigger value="fiat" className="text-xs px-2 sm:text-sm sm:px-3">
                {currency}
              </TabsTrigger>
              <TabsTrigger value="tokens" className="text-xs px-2 sm:text-sm sm:px-3">
                Tokens
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Pool selector — scrolls horizontally on narrow screens rather than
              overflowing the viewport */}
          <div className="-mx-1 max-w-full overflow-x-auto px-1">
            <Tabs value={selectedPoolId} onValueChange={(v) => setSelectedPoolId(v)}>
              <TabsList className="h-8">
                <TabsTrigger value={TOTAL_KEY} className="text-xs px-2 sm:text-sm sm:px-3">
                  Total
                </TabsTrigger>
                {poolList.map((pool) => (
                  <TabsTrigger
                    key={pool.poolId}
                    value={pool.poolId}
                    className="text-xs px-2 sm:text-sm sm:px-3"
                  >
                    {pool.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* In token-unit mode the y-axis mixes different assets' native units, which
          aren't additive — so we draw separate lines instead of a stack. */}
      {unit === "tokens" && tokens.length > 1 && (
        <p className="text-[11px] text-muted-foreground">
          Showing native token units — values are not summed across tokens.
        </p>
      )}

      {chartData.length === 0 || tokens.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {unit === "fiat" ? (
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
                  <defs>
                    {tokens.map((t) => (
                      <linearGradient
                        key={t.assetAddress}
                        id={`tokenFill-${t.assetAddress}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={t.color} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={t.color} stopOpacity={0.25} />
                      </linearGradient>
                    ))}
                  </defs>

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fiatCompact(v as number)}
                  />

                  {shouldRenderTooltip && (
                    <Tooltip
                      content={
                        <CustomTooltip
                          tokensByAddress={tokensByAddress}
                          colorByAddress={colorByAddress}
                          unit={unit}
                          formatFiat={formatFiat}
                        />
                      }
                      cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                  )}

                  {tokens.map((t) => (
                    <Area
                      key={t.assetAddress}
                      type="monotone"
                      dataKey={t.assetAddress}
                      name={t.symbol}
                      stackId="tvl"
                      stroke={t.color}
                      strokeWidth={1.5}
                      fill={`url(#tokenFill-${t.assetAddress})`}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              ) : (
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatTokenCompact(v as number)}
                  />

                  {shouldRenderTooltip && (
                    <Tooltip
                      content={
                        <CustomTooltip
                          tokensByAddress={tokensByAddress}
                          colorByAddress={colorByAddress}
                          unit={unit}
                          formatFiat={formatFiat}
                        />
                      }
                      cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                  )}

                  {tokens.map((t) => (
                    <Line
                      key={t.assetAddress}
                      type="monotone"
                      dataKey={t.assetAddress}
                      name={t.symbol}
                      stroke={t.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: t.color, stroke: t.color }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {tokens.map((t) => (
              <span
                key={t.assetAddress}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: t.color }}
                />
                {t.symbol}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
