"use client"

import { useState, useMemo } from "react"
import {
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
import { usePoolTvlHistory } from "@/hooks/use-pool-tvl-history"
import { useTooltipDismiss } from "@/hooks/use-tooltip-dismiss"

// Pool display order
const POOL_ORDER = ['Fixed', 'YieldBlox', 'Orbit', 'Forex', 'Etherfuse']

function formatUsdCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

interface ChartDataPoint {
  date: string
  tvlUsd: number
  borrowedUsd: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: ChartDataPoint }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0].payload

  return (
    <div className="bg-black text-white border border-zinc-800 rounded-md px-3 py-2 shadow-lg text-[11px] min-w-[140px]">
      <p className="text-zinc-400 mb-1.5">
        {format(parseISO(data.date), "MMM d, yyyy")}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Supply TVL:</span>
          <span className="font-medium text-emerald-400">
            {formatUsdCompact(data.tvlUsd)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Borrowed:</span>
          <span className="font-medium text-orange-400">
            {formatUsdCompact(data.borrowedUsd)}
          </span>
        </div>
      </div>
    </div>
  )
}

const TOTAL_KEY = '__total__'

export function PoolTvlHistoryChart() {
  const { data, isLoading, error } = usePoolTvlHistory()
  const { containerRef, shouldRenderTooltip } = useTooltipDismiss()

  // Get pool list from data, sorted by POOL_ORDER
  const poolList = useMemo(() => {
    if (!data?.pools) return []
    return Object.entries(data.pools)
      .map(([poolId, pool]) => ({
        poolId,
        name: pool.name,
        iconUrl: pool.iconUrl,
      }))
      .sort((a, b) => {
        const aIndex = POOL_ORDER.indexOf(a.name)
        const bIndex = POOL_ORDER.indexOf(b.name)
        // If both are in the order list, sort by that order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        // If only one is in the list, prioritize it
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        // Otherwise sort alphabetically
        return a.name.localeCompare(b.name)
      })
  }, [data])

  // Selected pool state - default to Total
  const [selectedPoolId, setSelectedPoolId] = useState<string>(TOTAL_KEY)

  // Calculate total (aggregated) data across all pools
  const totalData = useMemo(() => {
    if (!data?.pools) return []

    // Collect all dates and aggregate
    const dateMap = new Map<string, { tvlUsd: number; borrowedUsd: number }>()

    for (const pool of Object.values(data.pools)) {
      for (const point of pool.history) {
        const existing = dateMap.get(point.date)
        if (existing) {
          existing.tvlUsd += point.tvlUsd
          existing.borrowedUsd += point.borrowedUsd
        } else {
          dateMap.set(point.date, {
            tvlUsd: point.tvlUsd,
            borrowedUsd: point.borrowedUsd,
          })
        }
      }
    }

    // Convert to sorted array
    return Array.from(dateMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  // Get chart data for selected pool or total
  const chartData = useMemo(() => {
    if (!data?.pools) return []
    if (selectedPoolId === TOTAL_KEY) return totalData
    return data.pools[selectedPoolId]?.history ?? []
  }, [data, selectedPoolId, totalData])

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100]
    const maxTvl = Math.max(...chartData.map((d) => d.tvlUsd), 0)
    const maxBorrow = Math.max(...chartData.map((d) => d.borrowedUsd), 0)
    const max = Math.max(maxTvl, maxBorrow, 1)
    return [0, max * 1.1]
  }, [chartData])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">TVL History</h2>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">TVL History</h2>

        {/* Pool selector tabs */}
        <Tabs
          value={selectedPoolId}
          onValueChange={(value) => setSelectedPoolId(value)}
        >
          <TabsList className="h-8">
            <TabsTrigger
              value={TOTAL_KEY}
              className="text-xs px-2 sm:text-sm sm:px-3"
            >
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

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
            >
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="borrowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb923c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
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
                domain={yDomain}
                hide
              />

              {shouldRenderTooltip && (
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
                  wrapperStyle={{ zIndex: 50 }}
                />
              )}

              <Line
                type="monotone"
                dataKey="tvlUsd"
                name="tvlUsd"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#34d399",
                  stroke: "#34d399",
                }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="borrowedUsd"
                name="borrowedUsd"
                stroke="#fb923c"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#fb923c",
                  stroke: "#fb923c",
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
