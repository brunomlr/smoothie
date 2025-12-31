/**
 * Transaction History Helpers
 *
 * Formatting and utility functions.
 */

import { ASSET_LOGO_MAP } from "./constants"

export function resolveAssetLogo(symbol: string | undefined): string | null {
  if (!symbol) return null
  const normalized = symbol.toUpperCase()
  return ASSET_LOGO_MAP[normalized] ?? null
}

export function formatAmount(amount: number | null, decimals: number = 7): string {
  if (amount === null) return "-"
  const value = amount / Math.pow(10, decimals)
  const isWholeNumber = value % 1 === 0
  return value.toLocaleString('en-US', {
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
