"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Lock, Unlock, Coins } from "lucide-react"
import type { Q4WSummary } from "@/types/backstop-q4w"

interface Q4WSummaryCardsProps {
  summary?: Q4WSummary
  isLoading?: boolean
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
  isLoading,
}: {
  title: string
  value: string
  subtitle?: string
  icon: typeof Users
  variant?: "default" | "success" | "warning"
  isLoading?: boolean
}) {
  const variantColors = {
    default: "",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ) : (
          <>
            <div className={`text-2xl font-bold ${variantColors[variant || "default"]}`}>{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function Q4WSummaryCards({ summary, isLoading }: Q4WSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Users with Q4W"
        value={formatNumber(summary?.totalUsers || 0)}
        subtitle="Unique addresses"
        icon={Users}
        isLoading={isLoading}
      />
      <StatCard
        title="Unlocked (Ready)"
        value={formatNumber(summary?.totalLpTokensUnlocked || 0)}
        subtitle={summary?.totalLpTokensUnlockedUsd ? formatCurrency(summary.totalLpTokensUnlockedUsd) : "LP Tokens"}
        icon={Unlock}
        variant="success"
        isLoading={isLoading}
      />
      <StatCard
        title="Locked"
        value={formatNumber(summary?.totalLpTokensLocked || 0)}
        subtitle={summary?.totalLpTokensLockedUsd ? formatCurrency(summary.totalLpTokensLockedUsd) : "LP Tokens"}
        icon={Lock}
        variant="warning"
        isLoading={isLoading}
      />
      <StatCard
        title="Total Q4W"
        value={formatNumber(summary?.totalLpTokens || 0)}
        subtitle={summary?.totalLpTokensUsd ? formatCurrency(summary.totalLpTokensUsd) : "LP Tokens"}
        icon={Coins}
        isLoading={isLoading}
      />
    </div>
  )
}
