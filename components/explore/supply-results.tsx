"use client"

import { TrendingUp, Flame, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TokenLogo } from "@/components/token-logo"
import type { SupplyExploreItem, SortBy } from "@/types/explore"

interface SupplyResultsProps {
  items: SupplyExploreItem[]
  isLoading: boolean
  sortBy: SortBy
}

const ASSET_LOGO_MAP: Record<string, string> = {
  USDC: "/tokens/usdc.png",
  USDT: "/tokens/usdc.png",
  XLM: "/tokens/xlm.png",
  AQUA: "/tokens/aqua.png",
  EURC: "/tokens/eurc.png",
  CETES: "/tokens/cetes.png",
  USDGLO: "/tokens/usdglo.png",
  USTRY: "/tokens/ustry.png",
  BLND: "/tokens/blnd.png",
}

function resolveAssetLogo(symbol: string): string {
  const normalized = symbol.toUpperCase()
  return ASSET_LOGO_MAP[normalized] ?? `/tokens/${symbol.toLowerCase()}.png`
}

function formatApy(value: number | null): string {
  if (value === null) return "—"
  return `${value.toFixed(2)}%`
}

function formatUsdCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

function formatUsdFull(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getTotalApy(item: SupplyExploreItem): number {
  return (item.supplyApy ?? 0) + (item.blndApy ?? 0)
}

function sortItems(items: SupplyExploreItem[], sortBy: SortBy): SupplyExploreItem[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "apy":
        return (b.supplyApy ?? 0) - (a.supplyApy ?? 0)
      case "blnd":
        return (b.blndApy ?? 0) - (a.blndApy ?? 0)
      case "total":
      default:
        return getTotalApy(b) - getTotalApy(a)
    }
  })
}

function SupplyRow({ item, sortBy }: { item: SupplyExploreItem; sortBy: SortBy }) {
  const blendUrl = `https://mainnet.blend.capital/supply/?poolId=${item.poolId}&assetId=${item.assetAddress}`
  const logoUrl = resolveAssetLogo(item.tokenSymbol)

  return (
    <a
      href={blendUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0"
    >
      {/* Left side: Token info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <TokenLogo
          src={logoUrl}
          symbol={item.tokenSymbol}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.tokenSymbol}</p>
          <p className="text-sm text-muted-foreground truncate">
            {item.poolName}
          </p>
          {(item.totalSupplied !== null || item.totalBorrowed !== null) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {item.totalSupplied !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-help inline-flex items-center gap-0.5"
                      onClick={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                      {formatUsdCompact(item.totalSupplied)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-medium">Supplied</p>
                      <p>{formatUsdFull(item.totalSupplied)}</p>
                      <p className="text-muted-foreground">{formatTokens(item.totalSuppliedTokens)} {item.tokenSymbol}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {item.totalSupplied !== null && item.totalBorrowed !== null && item.totalBorrowed > 0 && " · "}
              {item.totalBorrowed !== null && item.totalBorrowed > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-help inline-flex items-center gap-0.5"
                      onClick={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <ArrowDownLeft className="h-3 w-3 text-orange-500" />
                      {formatUsdCompact(item.totalBorrowed)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-medium">Borrowed</p>
                      <p>{formatUsdFull(item.totalBorrowed)}</p>
                      <p className="text-muted-foreground">{formatTokens(item.totalBorrowedTokens)} {item.tokenSymbol}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Right side: APY badges - stacked vertically with equal width */}
      <div className="flex flex-col gap-1 items-end shrink-0">
        <Badge
          variant="secondary"
          className={`text-xs font-medium min-w-[90px] justify-center ${sortBy === "total" ? "bg-white/20" : ""}`}
        >
          {formatApy(getTotalApy(item))} Total
        </Badge>
        {item.supplyApy !== null && (
          <Badge
            variant="secondary"
            className={`text-xs min-w-[90px] justify-center ${sortBy === "apy" ? "bg-white/20" : ""}`}
          >
            <TrendingUp className="mr-1 h-3 w-3" />
            {formatApy(item.supplyApy)}
          </Badge>
        )}
        {item.blndApy !== null && item.blndApy > 0.005 && (
          <Badge
            variant="secondary"
            className={`text-xs min-w-[90px] justify-center ${sortBy === "blnd" ? "bg-white/20" : ""}`}
          >
            <Flame className="mr-1 h-3 w-3" />
            {formatApy(item.blndApy)}
          </Badge>
        )}
      </div>
    </a>
  )
}

function SupplyRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end">
        <Skeleton className="h-5 w-[90px]" />
        <Skeleton className="h-5 w-[90px]" />
        <Skeleton className="h-5 w-[90px]" />
      </div>
    </div>
  )
}

export function SupplyResults({ items, isLoading, sortBy }: SupplyResultsProps) {
  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">All Pools</h2>
        <Card className="py-0">
          <CardContent className="p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <SupplyRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">All Pools</h2>
        <div className="text-center py-12 text-muted-foreground">
          No supply positions found
        </div>
      </div>
    )
  }

  const sortedItems = sortItems(items, sortBy)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">All Pools</h2>
      <Card className="py-0">
        <CardContent className="p-0">
          {sortedItems.map((item) => (
            <SupplyRow
              key={`${item.poolId}-${item.assetAddress}`}
              item={item}
              sortBy={sortBy}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
