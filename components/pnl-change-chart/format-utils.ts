/**
 * Compact currency formatter for bar labels.
 * Returns empty string for values that would round to 0.
 */
export function formatCompact(value: number): string {
  if (value === 0) return ""
  const absValue = Math.abs(value)
  if (absValue < 0.5) return ""
  const sign = value >= 0 ? "+" : "-"
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(1)}M`
  }
  if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(1)}K`
  }
  return `${sign}$${absValue.toFixed(0)}`
}

export function getNumericValue(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
