/**
 * Format Utilities
 * Centralized number and currency formatters
 *
 * These are singleton instances to avoid creating new Intl.NumberFormat objects
 * on every render, which improves performance.
 */

// Singleton formatter instances (created once, reused everywhere)
const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a number as USD (without $ symbol)
 * @example formatUsd(1234.567) => "1,234.57"
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00"
  }
  return usdFormatter.format(value)
}

/**
 * Format a number as USD with $ symbol
 * @example formatUsdWithSymbol(1234.567) => "$1,234.57"
 */
export function formatUsdWithSymbol(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0.00"
  }
  return `$${usdFormatter.format(value)}`
}

/**
 * Format a number as USD with configurable decimal places
 * @example formatUsdWithDecimals(1234.5678901, 7) => "$1,234.5678901"
 */
export function formatUsdWithDecimals(value: number, decimals = 7): string {
  if (!Number.isFinite(value)) {
    return "$0.00"
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Format a number as a compact USD value (no decimals)
 * @example formatUsdCompact(1234.567) => "1,235"
 */
export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "0"
  }
  return usdCompactFormatter.format(value)
}

/**
 * Format a number as a percentage
 * @example formatPercent(12.345) => "12.35%"
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00%"
  }
  return `${percentFormatter.format(value)}%`
}

/**
 * Format a number as a percentage with sign
 * @example formatPercentWithSign(12.345) => "+12.35%"
 * @example formatPercentWithSign(-5.67) => "-5.67%"
 */
export function formatPercentWithSign(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00%"
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${percentFormatter.format(value)}%`
}

/**
 * Format a token amount with appropriate precision
 * @example formatTokenAmount(1234.5678901234) => "1,234.567890"
 */
export function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0"
  }

  // Use more decimals for smaller amounts
  const decimals = Math.abs(value) < 1 ? 8 : 6

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format a token/asset price with magnitude-aware precision.
 * Prices >= $1 get 2 decimals, small prices get enough decimals to be meaningful.
 * @example formatPrice(1234.5) => "$1,234.50"; formatPrice(0.0042) => "$0.004200"
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "$0.00"
  if (Math.abs(value) >= 1) {
    return `$${usdFormatter.format(value)}`
  }
  if (Math.abs(value) >= 0.01) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toFixed(6)}`
}

/**
 * Format an allocation share as a whole percent, with "<1%" for tiny slices.
 * @example formatAllocationPercent(42.4) => "42%"; formatAllocationPercent(0.3) => "<1%"
 */
export function formatAllocationPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  if (value < 1) return "<1%"
  return `${Math.round(value)}%`
}

/**
 * Format a USD value compactly with a magnitude suffix.
 * @example formatUsdSuffixed(1_234_000) => "$1.23M"
 */
export function formatUsdSuffixed(value: number): string {
  if (!Number.isFinite(value)) return "$0"
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

// Legacy functions preserved for backwards compatibility
// (These were the original functions in this file)

/**
 * Format number with full decimals for dust amounts
 * @deprecated Use formatTokenAmount or formatUsd instead
 */
export function formatAmount(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0"
  // Show more decimals for dust amounts
  if (value > 0 && value < 0.01) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/**
 * Format USD with full decimals for dust amounts
 * @deprecated Use formatUsdWithSymbol instead
 */
export function formatUsdAmount(value: number): string {
  if (!Number.isFinite(value)) return "$0.00"
  // Show more decimals for dust amounts
  if (value > 0 && value < 0.01) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
