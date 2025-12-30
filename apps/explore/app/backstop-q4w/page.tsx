"use client"

import { useState, useCallback } from "react"
import { Clock } from "lucide-react"
import { useBackstopQ4W, useQ4WPools } from "@/hooks/use-backstop-q4w"
import { Q4WFilters } from "@/components/backstop-q4w/q4w-filters"
import { Q4WResults } from "@/components/backstop-q4w/q4w-results"
import { Q4WSummaryCards } from "@/components/backstop-q4w/q4w-summary-cards"
import type { Q4WFilterState } from "@/types/backstop-q4w"

const DEFAULT_FILTERS: Q4WFilterState = {
  status: "all",
  orderBy: "unlock_time",
  orderDir: "asc",
}

export default function BackstopQ4WPage() {
  const { pools, isLoading: isPoolsLoading } = useQ4WPools()
  const [offset, setOffset] = useState(0)
  const limit = 50

  const [filters, setFilters] = useState<Q4WFilterState>(DEFAULT_FILTERS)

  // LP token price - could be fetched from a pricing service
  // For now, leaving at 0 since we're showing LP token amounts
  const lpPrice = 0

  const { data, isLoading, isFetching, error } = useBackstopQ4W({
    ...filters,
    limit,
    offset,
    lpPrice,
    enabled: true,
  })

  const handleFiltersChange = useCallback((newFilters: Q4WFilterState) => {
    setFilters(newFilters)
    setOffset(0)
  }, [])

  const handlePageChange = useCallback((newOffset: number) => {
    setOffset(newOffset)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Backstop Q4W Monitor</h1>
              <p className="text-muted-foreground mt-1">Track queued withdrawals across all users and pools</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>21-day lock period</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8">
          <Q4WSummaryCards summary={data?.summary} isLoading={isLoading || isFetching} />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filters Sidebar */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Q4WFilters pools={pools} filters={filters} onFiltersChange={handleFiltersChange} isLoading={isPoolsLoading} />
          </div>

          {/* Results */}
          <div>
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive">Error loading data: {error.message}</div>
            )}
            <Q4WResults data={data} isLoading={isLoading || isFetching} onPageChange={handlePageChange} limit={limit} offset={offset} />
          </div>
        </div>
      </div>
    </div>
  )
}
