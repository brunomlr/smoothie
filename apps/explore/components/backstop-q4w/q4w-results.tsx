"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, ChevronLeft, ChevronRight, Copy, Check, Clock } from "lucide-react"
import type { Q4WResponse, AggregatedQ4WPosition } from "@/types/backstop-q4w"

interface Q4WResultsProps {
  data?: Q4WResponse
  isLoading?: boolean
  onPageChange?: (offset: number) => void
  limit?: number
  offset?: number
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ready"

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatUnlockDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatUsd(value: number): string {
  return `$${formatNumber(value)}`
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://stellar.expert/explorer/public/account/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1"
      >
        {truncateAddress(address)}
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Copy address"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

function StatusBadge({
  hasUnlocked,
  earliestUnlock,
  currentTimestamp,
}: {
  hasUnlocked: boolean
  earliestUnlock: number | null
  currentTimestamp: number
}) {
  if (hasUnlocked) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-600">
        Unlocked
      </Badge>
    )
  }

  if (earliestUnlock) {
    const timeRemaining = earliestUnlock - currentTimestamp
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatTimeRemaining(timeRemaining)}
      </Badge>
    )
  }

  return <Badge variant="outline">Locked</Badge>
}

function Q4WTable({ results, currentTimestamp }: { results: AggregatedQ4WPosition[]; currentTimestamp: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Pool</TableHead>
          <TableHead className="text-right">Unlocked LP</TableHead>
          <TableHead className="text-right">Locked LP</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Unlock Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((position) => (
          <TableRow key={`${position.userAddress}-${position.poolAddress}`}>
            <TableCell>
              <CopyableAddress address={position.userAddress} />
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {position.poolShortName || position.poolName || truncateAddress(position.poolAddress)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {position.unlockedLpTokens > 0.001 ? (
                <div className="text-green-600 dark:text-green-400">
                  <div className="font-mono">{formatNumber(position.unlockedLpTokens)}</div>
                  {position.unlockedLpTokensUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{formatUsd(position.unlockedLpTokensUsd)}</div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {position.lockedLpTokens > 0.001 ? (
                <div>
                  <div className="font-mono">{formatNumber(position.lockedLpTokens)}</div>
                  {position.lockedLpTokensUsd > 0 && (
                    <div className="text-xs text-muted-foreground">{formatUsd(position.lockedLpTokensUsd)}</div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge
                hasUnlocked={position.hasUnlocked}
                earliestUnlock={position.earliestUnlock}
                currentTimestamp={currentTimestamp}
              />
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {position.earliestUnlock && !position.hasUnlocked
                ? formatUnlockDate(position.earliestUnlock)
                : position.hasUnlocked
                  ? "Ready to withdraw"
                  : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      ))}
    </div>
  )
}

export function Q4WResults({ data, isLoading, onPageChange, limit = 50, offset = 0 }: Q4WResultsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Q4W Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Q4W Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No Q4W positions found matching the criteria</p>
        </CardContent>
      </Card>
    )
  }

  const totalCount = data.totalCount
  const showPagination = onPageChange && totalCount > limit

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Q4W Positions
          <span className="ml-2 text-sm font-normal text-muted-foreground">({totalCount.toLocaleString()} total)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-auto">
          <div className="max-h-[600px] overflow-y-auto">
            <Q4WTable results={data.results} currentTimestamp={data.currentTimestamp} />
          </div>
        </div>

        {showPagination && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1} - {Math.min(offset + limit, totalCount)} of {totalCount.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(offset + limit)}
                disabled={offset + limit >= totalCount}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
