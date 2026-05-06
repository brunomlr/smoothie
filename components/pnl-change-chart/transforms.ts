import type { PnlChangeDataPoint } from "@/hooks/use-pnl-change-chart"

export interface YieldChartDatum {
  period: string
  supplyApyBar: number
  supplyBlndApyBar: number
  backstopYieldPositiveBar: number
  backstopBlndApyBar: number
  borrowBlndApyBar: number
  backstopYieldNegativeBar: number
  borrowInterestCostBar: number
  supplyApy: number
  supplyBlndApy: number
  backstopYield: number
  backstopBlndApy: number
  borrowInterestCost: number
  borrowBlndApy: number
  priceChange: number
  isLive: boolean
  yieldTotal: number
  positiveTotal: number
  negativeTotal: number
  topPositiveBar: string | null
}

export interface PriceChartDatum {
  period: string
  priceChangePositive: number
  priceChangeNegative: number
  priceChange: number
  isLive: boolean
}

export function transformDataForYieldChart(data: PnlChangeDataPoint[]): YieldChartDatum[] {
  return data.map(d => {
    // Include borrow data in yield total (cost is negative, BLND is positive)
    const borrowInterestCost = d.borrowInterestCost ?? 0
    const borrowBlndApy = d.borrowBlndApy ?? 0
    const yieldTotal = d.supplyApy + d.supplyBlndApy + d.backstopYield + d.backstopBlndApy + borrowInterestCost + borrowBlndApy

    const positiveTotal = d.supplyApy + d.supplyBlndApy + Math.max(0, d.backstopYield) + d.backstopBlndApy + borrowBlndApy
    const negativeTotal = Math.min(0, d.backstopYield) + borrowInterestCost

    // Stacking order: supplyApy → supplyBlndApy → backstopYield → backstopBlndApy → borrowBlndApy
    let topPositiveBar: string | null = null
    if (borrowBlndApy > 0) topPositiveBar = 'borrowBlndApyBar'
    else if (d.backstopBlndApy > 0) topPositiveBar = 'backstopBlndApyBar'
    else if (d.backstopYield > 0) topPositiveBar = 'backstopYieldPositiveBar'
    else if (d.supplyBlndApy > 0) topPositiveBar = 'supplyBlndApyBar'
    else if (d.supplyApy > 0) topPositiveBar = 'supplyApyBar'

    return {
      period: d.period,
      supplyApyBar: Math.max(0, d.supplyApy),
      supplyBlndApyBar: Math.max(0, d.supplyBlndApy),
      backstopYieldPositiveBar: Math.max(0, d.backstopYield),
      backstopBlndApyBar: Math.max(0, d.backstopBlndApy),
      borrowBlndApyBar: Math.max(0, borrowBlndApy),
      backstopYieldNegativeBar: d.backstopYield < 0 ? d.backstopYield : 0,
      borrowInterestCostBar: borrowInterestCost < 0 ? borrowInterestCost : 0,
      supplyApy: d.supplyApy,
      supplyBlndApy: d.supplyBlndApy,
      backstopYield: d.backstopYield,
      backstopBlndApy: d.backstopBlndApy,
      borrowInterestCost,
      borrowBlndApy,
      priceChange: d.priceChange,
      isLive: d.isLive,
      yieldTotal,
      positiveTotal,
      negativeTotal,
      topPositiveBar,
    }
  })
}

export function transformDataForPriceChart(data: PnlChangeDataPoint[]): PriceChartDatum[] {
  return data.map(d => ({
    period: d.period,
    priceChangePositive: d.priceChange > 0 ? d.priceChange : 0,
    priceChangeNegative: d.priceChange < 0 ? d.priceChange : 0,
    priceChange: d.priceChange,
    isLive: d.isLive,
  }))
}
