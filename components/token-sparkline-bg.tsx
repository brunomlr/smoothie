"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface PriceDataPoint {
  date: string
  price: number
}

interface TokenSparklineProps {
  tokenAddress: string
  className?: string
}

async function fetchTokenPriceHistory(tokenAddress: string): Promise<PriceDataPoint[]> {
  const params = new URLSearchParams({
    token: tokenAddress,
    days: "30",
  })

  const response = await fetchWithTimeout(`/api/token-price-history?${params}`)
  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data.history || []
}

// Calculate 30d change percentage
function calculate30dChange(priceHistory: PriceDataPoint[]): { percentage: number; trend: "up" | "down" | "unchanged" } {
  if (!priceHistory?.length || priceHistory.length < 2) {
    return { percentage: 0, trend: "unchanged" }
  }
  const startPrice = priceHistory[0].price
  const endPrice = priceHistory[priceHistory.length - 1].price

  if (startPrice === 0) {
    return { percentage: 0, trend: "unchanged" }
  }

  const percentage = ((endPrice - startPrice) / startPrice) * 100

  // Consider changes less than 0.01% as unchanged
  if (Math.abs(percentage) < 0.01) {
    return { percentage: 0, trend: "unchanged" }
  }

  return {
    percentage,
    trend: percentage > 0 ? "up" : "down"
  }
}

// Inline sparkline component
export function TokenSparkline({
  tokenAddress,
  className = "",
}: TokenSparklineProps) {
  const { data: priceHistory } = useQuery({
    queryKey: ["token-sparkline", tokenAddress],
    queryFn: () => fetchTokenPriceHistory(tokenAddress),
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
  })

  const { trend } = useMemo(() => calculate30dChange(priceHistory || []), [priceHistory])

  if (!priceHistory?.length) {
    return null
  }

  const strokeColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#a1a1aa" // green-500, red-500, zinc-400

  return (
    <div className={`h-8 w-full max-w-48 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={priceHistory}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// 30d change indicator component
export function Token30dChange({
  tokenAddress,
}: {
  tokenAddress: string
}) {
  const { data: priceHistory } = useQuery({
    queryKey: ["token-sparkline", tokenAddress],
    queryFn: () => fetchTokenPriceHistory(tokenAddress),
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
  })

  const { percentage, trend } = useMemo(() => calculate30dChange(priceHistory || []), [priceHistory])

  if (!priceHistory?.length) {
    return null
  }

  const colorClass = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus

  return (
    <div className={`flex items-center gap-0.5 text-xs ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span>{Math.abs(percentage).toFixed(1)}%</span>
    </div>
  )
}

// Legacy export for backwards compatibility
export const TokenSparklineBg = TokenSparkline
