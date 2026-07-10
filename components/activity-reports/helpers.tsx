"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PriceSource } from "@/lib/reports/types"

export function formatDay(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function formatQuantity(value: number): string {
  if (value === 0) return "0"
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 7 })
}

export function gainLossClass(value: number): string {
  if (value === 0) return "text-foreground"
  return value > 0 ? "text-positive" : "text-negative"
}

export function signedCurrency(value: number, format: (usd: number) => string): string {
  const formatted = format(Math.abs(value))
  return value < 0 ? `-${formatted}` : formatted
}

export function TxLink({ txHash, isDemoWallet }: { txHash: string; isDemoWallet?: boolean }) {
  if (isDemoWallet) {
    return <span className="text-xs text-muted-foreground font-mono">{txHash.slice(0, 8)}…</span>
  }
  return (
    <a
      href={`https://stellar.expert/explorer/public/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono"
    >
      {txHash.slice(0, 8)}…
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

/** Marks a row priced without historical data */
export function PriceSourceFlag({ source }: { source: PriceSource }) {
  if (source !== "sdk_fallback") return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-amber-500 cursor-help">*</span>
      </TooltipTrigger>
      <TooltipContent className="bg-black text-white border-black" arrowClassName="bg-black fill-black">
        No historical price data for this date — value may be inaccurate
      </TooltipContent>
    </Tooltip>
  )
}

export function SectionCard({
  title,
  subtitle,
  children,
  headerRight,
  collapsible = false,
  defaultOpen = true,
  onToggle,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  onToggle?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const heading = (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )

  if (!collapsible) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          {heading}
          {headerRight}
        </div>
        <Card className="py-0">
          <CardContent className="p-0">{children}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          onToggle?.(next)
        }}
        className="w-full flex items-center justify-between mb-2 px-1 text-left cursor-pointer"
      >
        {heading}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <Card className="py-0">
          <CardContent className="p-0">{children}</CardContent>
        </Card>
      )}
    </div>
  )
}

export function EmptySection({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{message}</p>
}

const DEFAULT_ROW_LIMIT = 50

/**
 * Caps a table at `limit` rows until the user opts into the full list, so a
 * heavy wallet doesn't mount thousands of DOM rows at once.
 */
export function useRowLimit<T>(rows: T[], limit = DEFAULT_ROW_LIMIT) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, limit)
  return {
    visible,
    hiddenCount: rows.length - visible.length,
    expand: () => setExpanded(true),
  }
}

export function ShowAllRows({ hiddenCount, onExpand }: { hiddenCount: number; onExpand: () => void }) {
  if (hiddenCount <= 0) return null
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground border-t border-border/50 cursor-pointer transition-colors"
    >
      Show {hiddenCount} more {hiddenCount === 1 ? "row" : "rows"}
    </button>
  )
}
