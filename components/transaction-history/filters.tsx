"use client"

import { Filter, CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import type { ActionType } from "@/lib/db/types"
import { ACTION_TYPE_OPTIONS } from "./constants"

interface FiltersProps {
  selectedActionTypes: ActionType[]
  onToggleActionType: (type: ActionType) => void
  startDate: Date | undefined
  endDate: Date | undefined
  onStartDateChange: (date: Date | undefined) => void
  onEndDateChange: (date: Date | undefined) => void
  onClear: () => void
}

export function Filters({
  selectedActionTypes,
  onToggleActionType,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: FiltersProps) {
  // Check if any filter is active
  const hasActiveFilters = selectedActionTypes.length > 0 || !!startDate || !!endDate
  const activeFilterCount = [
    selectedActionTypes.length > 0,
    !!startDate,
    !!endDate,
  ].filter(Boolean).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8">
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted-foreground">Event Type</label>
            {selectedActionTypes.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedActionTypes.length} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {ACTION_TYPE_OPTIONS.map((type) => (
              <label
                key={type.value}
                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1.5"
              >
                <Checkbox
                  checked={selectedActionTypes.includes(type.value)}
                  onCheckedChange={() => onToggleActionType(type.value)}
                />
                <span className="truncate">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="p-3">
          <label className="text-sm text-muted-foreground mb-2 block">Date Range</label>

          {/* Mobile: Native date inputs */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            <Button
              variant="outline"
              className="relative justify-start text-left font-normal h-9 px-3"
              asChild
            >
              <label>
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className={startDate ? "" : "text-muted-foreground"}>
                  {startDate ? format(startDate, "MMM d") : "From"}
                </span>
                <input
                  type="date"
                  value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      onStartDateChange(undefined)
                      return
                    }
                    const [year, month, day] = e.target.value.split("-").map(Number)
                    onStartDateChange(new Date(year, month - 1, day))
                  }}
                  max={endDate ? format(endDate, "yyyy-MM-dd") : undefined}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </Button>
            <Button
              variant="outline"
              className="relative justify-start text-left font-normal h-9 px-3"
              asChild
            >
              <label>
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className={endDate ? "" : "text-muted-foreground"}>
                  {endDate ? format(endDate, "MMM d") : "To"}
                </span>
                <input
                  type="date"
                  value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      onEndDateChange(undefined)
                      return
                    }
                    const [year, month, day] = e.target.value.split("-").map(Number)
                    onEndDateChange(new Date(year, month - 1, day))
                  }}
                  min={startDate ? format(startDate, "yyyy-MM-dd") : undefined}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </Button>
          </div>

          {/* Desktop: Calendar popovers side by side */}
          <div className="hidden md:flex gap-2">
            <Popover modal>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    format(startDate, "MMM d")
                  ) : (
                    <span className="text-muted-foreground">From</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={onStartDateChange}
                  disabled={(date) => (endDate ? date > endDate : false)}
                  fixedWeeks
                />
              </PopoverContent>
            </Popover>

            <Popover modal>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? (
                    format(endDate, "MMM d")
                  ) : (
                    <span className="text-muted-foreground">To</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" sideOffset={4}>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={onEndDateChange}
                  disabled={(date) => (startDate ? date < startDate : false)}
                  fixedWeeks
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
