"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RotateCcw } from "lucide-react"
import type { Q4WFilterState, Q4WPool } from "@/types/backstop-q4w"

interface Q4WFiltersProps {
  pools: Q4WPool[]
  filters: Q4WFilterState
  onFiltersChange: (filters: Q4WFilterState) => void
  isLoading?: boolean
}

const DEFAULT_FILTERS: Q4WFilterState = {
  status: "all",
  orderBy: "unlock_time",
  orderDir: "asc",
}

export function Q4WFilters({ pools, filters, onFiltersChange, isLoading }: Q4WFiltersProps) {
  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "unlocked", label: "Unlocked" },
              { value: "locked", label: "Locked" },
            ].map((option) => (
              <Button
                key={option.value}
                variant={filters.status === option.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    status: option.value as Q4WFilterState["status"],
                  })
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Pool Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Pool</label>
          <Select
            value={filters.poolAddress || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                poolAddress: value === "all" ? undefined : value,
              })
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All pools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pools</SelectItem>
              {pools.map((pool) => (
                <SelectItem key={pool.poolAddress} value={pool.poolAddress}>
                  {pool.poolName || pool.poolAddress.slice(0, 8) + "..."}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Options */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Sort By</label>
          <Select
            value={filters.orderBy}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                orderBy: value as Q4WFilterState["orderBy"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unlock_time">Unlock Time</SelectItem>
              <SelectItem value="lp_tokens">LP Tokens</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Order Direction */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Order</label>
          <div className="flex gap-2">
            <Button
              variant={filters.orderDir === "asc" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onFiltersChange({ ...filters, orderDir: "asc" })}
            >
              {filters.orderBy === "unlock_time" ? "Soonest" : "Lowest"}
            </Button>
            <Button
              variant={filters.orderDir === "desc" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onFiltersChange({ ...filters, orderDir: "desc" })}
            >
              {filters.orderBy === "unlock_time" ? "Latest" : "Highest"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
