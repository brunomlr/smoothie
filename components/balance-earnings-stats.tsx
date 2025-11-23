"use client"

import { TrendingUp, DollarSign, Calendar, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBalanceHistory } from "@/hooks/use-balance-history"
import { formatCurrency, formatNumber } from "@/lib/balance-history-utils"

interface BalanceEarningsStatsProps {
  publicKey: string
  assetAddress: string
  days?: number
  totalYield?: number // Total yield: SDK Balance - Cost Basis
  perPoolYield?: Map<string, number> // Per-pool yield: SDK Balance - Cost Basis per pool
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  subtitle?: string
  trend?: "up" | "down" | "neutral"
}

function StatCard({ title, value, icon, subtitle, trend }: StatCardProps) {
  const trendColors = {
    up: "text-green-600 dark:text-green-400",
    down: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${trend ? trendColors[trend] : ""}`}
        >
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function BalanceEarningsStats({
  publicKey,
  assetAddress,
  days = 30,
  totalYield,
  perPoolYield,
}: BalanceEarningsStatsProps) {
  const { isLoading, error, earningsStats } = useBalanceHistory({
    publicKey,
    assetAddress,
    days,
  })

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Error loading earnings statistics
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Loading statistics...
          </p>
        </CardContent>
      </Card>
    )
  }

  const {
    avgDailyInterest,
    projectedAnnual,
    dayCount,
    avgPosition,
    perPool,
  } = earningsStats

  // Use totalYield prop if provided (SDK Balance - Cost Basis), otherwise fall back to historical data
  const totalInterest = totalYield !== undefined ? totalYield : earningsStats.totalInterest

  // Recalculate APY using the correct yield: (Yield / Average Position) * (365 / Days) * 100
  const currentAPY = totalYield !== undefined && avgPosition > 0
    ? (totalYield / avgPosition) * (365 / dayCount) * 100
    : earningsStats.currentAPY

  // Pool IDs
  const YIELDBLOX_POOL = 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS'
  const BLEND_POOL = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'

  const poolEntries = Object.entries(perPool)

  return (
    <div className="space-y-6">
      {/* Combined Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Combined Earnings</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Interest Earned"
            value={formatCurrency(totalInterest)}
            icon={<DollarSign className="h-4 w-4" />}
            subtitle={`Over ${dayCount} days`}
            trend={totalInterest > 0 ? "up" : "neutral"}
          />
          <StatCard
            title="Current APY"
            value={`${formatNumber(currentAPY, 2)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            subtitle="Based on actual yield"
            trend={currentAPY > 0 ? "up" : "neutral"}
          />
          <StatCard
            title="Avg Daily Interest"
            value={formatCurrency(avgDailyInterest)}
            icon={<Calendar className="h-4 w-4" />}
            subtitle="Average per day"
            trend={avgDailyInterest > 0 ? "up" : "neutral"}
          />
          <StatCard
            title="Projected Annual"
            value={formatCurrency(projectedAnnual)}
            icon={<Target className="h-4 w-4" />}
            subtitle="Based on current balance"
            trend={projectedAnnual > 0 ? "up" : "neutral"}
          />
        </div>
      </div>

      {/* Per-Pool Stats */}
      {poolEntries.map(([poolId, stats]) => {
        const poolName =
          poolId === YIELDBLOX_POOL
            ? "YieldBlox"
            : poolId === BLEND_POOL
              ? "Blend Pool"
              : poolId.slice(0, 8) + "..."

        // Use perPoolYield prop if provided (SDK Balance - Cost Basis), otherwise fall back to historical data
        const poolTotalInterest = perPoolYield?.get(poolId) ?? stats.totalInterest

        // Recalculate APY for this pool using the correct yield
        const poolAPY = perPoolYield?.get(poolId) !== undefined && stats.avgPosition > 0
          ? (perPoolYield.get(poolId)! / stats.avgPosition) * (365 / dayCount) * 100
          : stats.currentAPY

        return (
          <div key={poolId}>
            <h3 className="text-lg font-semibold mb-3">{poolName}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Interest Earned"
                value={formatCurrency(poolTotalInterest)}
                icon={<DollarSign className="h-4 w-4" />}
                subtitle="SDK Balance - Cost Basis"
                trend={poolTotalInterest > 0 ? "up" : "neutral"}
              />
              <StatCard
                title="Current APY"
                value={`${formatNumber(poolAPY, 2)}%`}
                icon={<TrendingUp className="h-4 w-4" />}
                subtitle="Based on actual yield"
                trend={poolAPY > 0 ? "up" : "neutral"}
              />
              <StatCard
                title="Avg Daily Interest"
                value={formatCurrency(stats.avgDailyInterest)}
                icon={<Calendar className="h-4 w-4" />}
                subtitle="Average per day"
                trend={stats.avgDailyInterest > 0 ? "up" : "neutral"}
              />
              <StatCard
                title="Projected Annual"
                value={formatCurrency(stats.projectedAnnual)}
                icon={<Target className="h-4 w-4" />}
                subtitle="Based on current balance"
                trend={stats.projectedAnnual > 0 ? "up" : "neutral"}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
