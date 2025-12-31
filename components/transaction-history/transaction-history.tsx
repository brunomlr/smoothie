"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { useInfiniteUserActions } from "@/hooks/use-user-actions"
import type { UserAction, ActionType } from "@/lib/db/types"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import { useTokensOnly } from "@/hooks/use-metadata"
import type { HistoricalPricesResponse } from "@/app/api/historical-prices/route"
import type { TransactionHistoryProps, GroupedAction } from "./types"
import { LP_TOKEN_ADDRESS } from "./constants"
import { TransactionRow, MobileTransactionCard } from "./transaction-row"
import { Filters } from "./filters"

export function TransactionHistory({
  publicKey,
  assetAddress,
  poolId,
  limit = 50,
  defaultOpen = false,
  hideToggle = false,
}: TransactionHistoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || hideToggle)
  const [selectedActionTypes, setSelectedActionTypes] = useState<ActionType[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)
  const mobileLoadMoreRef = useRef<HTMLDivElement>(null)
  const desktopLoadMoreRef = useRef<HTMLDivElement>(null)

  // Currency preference and token metadata for currency conversion
  const { currency, format: formatCurrency } = useCurrencyPreference()
  const { tokens } = useTokensOnly()

  // Build tokens map for pegged currency lookup and find BLND token address
  const tokensMap = new Map<string, { pegged_currency: string | null }>()
  let blndTokenAddress: string | undefined
  tokens.forEach((t) => {
    tokensMap.set(t.asset_address, { pegged_currency: t.pegged_currency })
    if (t.symbol === 'BLND') {
      blndTokenAddress = t.asset_address
    }
  })

  // Convert filter values to API parameters
  const actionTypes = selectedActionTypes.length === 0 ? undefined : selectedActionTypes
  const startDateStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined
  const endDateStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined

  const { isLoading, isFetchingNextPage, error, actions, fetchNextPage, hasNextPage } = useInfiniteUserActions({
    publicKey,
    limit,
    assetAddress,
    poolId,
    actionTypes,
    startDate: startDateStr,
    endDate: endDateStr,
    enabled: (hideToggle || isOpen) && !!publicKey,
  })

  // Group actions by transaction_hash to merge related events (e.g., claim + deposit)
  const groupedActions = actions.reduce<GroupedAction[]>((acc, action) => {
    const lastGroup = acc[acc.length - 1]
    if (lastGroup && lastGroup.key === action.transaction_hash) {
      lastGroup.actions.push(action)
    } else {
      acc.push({ key: action.transaction_hash, actions: [action] })
    }
    return acc
  }, [])

  // Extract unique token addresses and dates from actions for historical price fetch
  const priceQueryParams = useMemo(() => {
    const tokenSet = new Set<string>()
    const dateSet = new Set<string>()

    actions.forEach((action) => {
      // Skip auction events (complex multi-token buy/sell)
      if (action.action_type === "fill_auction" || action.action_type === "new_auction") {
        return
      }

      const date = action.ledger_closed_at.split('T')[0]
      const isBackstopEvent = action.action_type.startsWith("backstop_")
      const isClaimEvent = action.action_type === "claim"

      if (isBackstopEvent) {
        // For backstop events, use the LP token address (BLND-USDC Comet LP)
        tokenSet.add(LP_TOKEN_ADDRESS)
        dateSet.add(date)
      } else if (isClaimEvent) {
        // For BLND claims, use the BLND token address
        if (blndTokenAddress) {
          tokenSet.add(blndTokenAddress)
          dateSet.add(date)
        }
      } else if (action.asset_address) {
        // Regular supply/withdraw/borrow events
        // Skip if token is pegged to user's currency
        const token = tokensMap.get(action.asset_address)
        if (token?.pegged_currency?.toUpperCase() !== currency.toUpperCase()) {
          tokenSet.add(action.asset_address)
          dateSet.add(date)
        }
      }
    })

    return {
      tokens: Array.from(tokenSet),
      dates: Array.from(dateSet),
    }
  }, [actions, tokensMap, currency, blndTokenAddress])

  // Fetch historical prices for visible actions
  const { data: historicalPricesData } = useQuery({
    queryKey: ['historical-prices', priceQueryParams.tokens.join(','), priceQueryParams.dates.join(',')],
    queryFn: async () => {
      if (priceQueryParams.tokens.length === 0 || priceQueryParams.dates.length === 0) {
        return { prices: {} } as HistoricalPricesResponse
      }

      const params = new URLSearchParams({
        tokens: priceQueryParams.tokens.join(','),
        dates: priceQueryParams.dates.join(','),
      })

      const response = await fetch(`/api/historical-prices?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch historical prices')
      }
      return response.json() as Promise<HistoricalPricesResponse>
    },
    enabled: priceQueryParams.tokens.length > 0 && priceQueryParams.dates.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    })

    if (mobileLoadMoreRef.current) {
      observer.observe(mobileLoadMoreRef.current)
    }
    if (desktopLoadMoreRef.current) {
      observer.observe(desktopLoadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [handleObserver])

  if (!publicKey) {
    return null
  }

  const clearFilters = () => {
    setSelectedActionTypes([])
    setStartDate(undefined)
    setEndDate(undefined)
  }

  const toggleActionType = (type: ActionType) => {
    setSelectedActionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleExport = async () => {
    if (isExporting || !publicKey) return

    setIsExporting(true)
    try {
      const params = new URLSearchParams({ user: publicKey })
      if (startDateStr) params.set('startDate', startDateStr)
      if (endDateStr) params.set('endDate', endDateStr)
      if (actionTypes?.length) params.set('actionTypes', actionTypes.join(','))
      if (poolId) params.set('pool', poolId)
      if (assetAddress) params.set('asset', assetAddress)

      const response = await fetch(`/api/export/transactions?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Export failed')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `transactions_${publicKey.slice(0, 8)}.csv`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="py-2 gap-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
        <CardTitle className="flex items-center gap-2">Transaction History</CardTitle>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          {(hideToggle || isOpen) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExport}
                  disabled={isExporting || actions.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black text-white border-black" arrowClassName="bg-black fill-black">
                Download CSV
              </TooltipContent>
            </Tooltip>
          )}

          {/* Filter Button with Popover */}
          {(hideToggle || isOpen) && (
            <Filters
              selectedActionTypes={selectedActionTypes}
              onToggleActionType={toggleActionType}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={clearFilters}
            />
          )}

          {/* Toggle Button */}
          {!hideToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1"
            >
              {isOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      {(hideToggle || isOpen) && (
        <CardContent className="px-4 pt-0 pb-3">
          {error && (
            <div className="text-sm text-destructive mb-4">
              Error loading transactions: {error.message}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions found
            </p>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden">
                <div className="[&>*:last-child]:border-0">
                  {groupedActions.map((group) => (
                    <MobileTransactionCard
                      key={group.key}
                      actions={group.actions}
                      currentUserAddress={publicKey}
                      historicalPrices={historicalPricesData?.prices}
                      currency={currency}
                      formatCurrency={formatCurrency}
                      tokensMap={tokensMap}
                      blndTokenAddress={blndTokenAddress}
                    />
                  ))}
                </div>
                {/* Load more trigger */}
                <div ref={mobileLoadMoreRef} className="h-1" />
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableBody>
                      {groupedActions.map((group) => (
                        <TransactionRow
                          key={group.key}
                          actions={group.actions}
                          currentUserAddress={publicKey}
                          historicalPrices={historicalPricesData?.prices}
                          currency={currency}
                          formatCurrency={formatCurrency}
                          tokensMap={tokensMap}
                          blndTokenAddress={blndTokenAddress}
                        />
                      ))}
                    </TableBody>
                  </Table>
                  {/* Load more trigger */}
                  <div ref={desktopLoadMoreRef} className="h-1" />
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
