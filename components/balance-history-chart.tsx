"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Scatter,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency, formatNumber } from "@/lib/balance-history-utils"
import { POOL_COLORS, type ChartDataPoint, type PositionChange } from "@/types/balance-history"

interface BalanceHistoryChartProps {
  chartData: ChartDataPoint[]
  positionChanges: PositionChange[]
  isLoading?: boolean
  error?: Error | null
}

const chartConfig: ChartConfig = {
  pool_yieldblox: {
    label: "YieldBlox",
    color: POOL_COLORS['CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS'],
  },
  pool_blend: {
    label: "Blend Pool",
    color: POOL_COLORS['CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'],
  },
  deposits: {
    label: "Deposit/Withdrawal",
    color: "#ffd43b",
  },
} satisfies ChartConfig

export function BalanceHistoryChart({
  chartData,
  positionChanges,
  isLoading = false,
  error = null,
}: BalanceHistoryChartProps) {
  // Prepare deposit markers for scatter plot
  const depositMarkers = chartData.map((point) => {
    const hasChange = positionChanges.some(
      (change) => change.date === point.date,
    )
    return hasChange ? point.total : null
  })

  // Create enhanced chart data with marker field
  const chartDataWithMarkers = chartData.map((point, index) => ({
    ...point,
    depositMarker: depositMarkers[index],
  }))

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>Error loading balance history: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>Loading balance history...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>No balance history available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance History</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <AreaChart
            data={chartDataWithMarkers}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="fillYieldBlox"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-pool_yieldblox)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-pool_yieldblox)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBlend" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-pool_blend)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-pool_blend)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${formatNumber(value, 0)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[200px]"
                  nameKey="pools"
                  labelFormatter={(_, payload) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload
                      return data.date
                    }
                    return ""
                  }}
                  formatter={(value, name) => {
                    const numValue = value as number

                    // Check if this is a deposit marker
                    if (name === "deposits" && numValue !== null) {
                      const index = chartData.findIndex(
                        (point) => point.total === numValue,
                      )
                      const change = positionChanges.find(
                        (c) => c.index === index,
                      )
                      if (change) {
                        return [
                          `Position Change: ${formatCurrency(change.netChange)}`,
                          "Deposit/Withdrawal",
                        ]
                      }
                    }

                    return [formatCurrency(numValue), name]
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />

            {/* Pool areas */}
            <Area
              type="monotone"
              dataKey="pool_yieldblox"
              stroke="var(--color-pool_yieldblox)"
              fill="url(#fillYieldBlox)"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="pool_blend"
              stroke="var(--color-pool_blend)"
              fill="url(#fillBlend)"
              fillOpacity={0.4}
              strokeWidth={2}
            />

            {/* Deposit/withdrawal markers */}
            <Scatter
              dataKey="depositMarker"
              fill="var(--color-deposits)"
              shape="star"
              name="deposits"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
