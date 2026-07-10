"use client"

import { useCallback } from "react"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"

/**
 * Currency-preference-aware formatters for Explore amounts.
 * Inputs are USD; output is converted to the user's selected currency.
 */
export function useUsdFormatters() {
  const { format } = useCurrencyPreference()

  const usdCompact = useCallback(
    (value: number | null): string => {
      if (value === null || !Number.isFinite(value)) return "—"
      return format(value, { compact: true, minimumFractionDigits: 0, maximumFractionDigits: 2 })
    },
    [format]
  )

  const usdFull = useCallback(
    (value: number | null): string => {
      if (value === null || !Number.isFinite(value)) return "—"
      return format(value)
    },
    [format]
  )

  /** Signed compact delta ("+$1.2K"); empty string for sub-cent changes */
  const usdChange = useCallback(
    (value: number): string => {
      if (!Number.isFinite(value) || Math.abs(value) < 0.01) return ""
      const formatted = format(Math.abs(value), {
        compact: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
      return `${value >= 0 ? "+" : "-"}${formatted}`
    },
    [format]
  )

  return { usdCompact, usdFull, usdChange }
}
