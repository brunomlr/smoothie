/**
 * Wallet Balance Constants
 *
 * Constants and dummy data for the wallet balance component.
 */

import type { ChartDataPoint as WalletChartDataPoint } from "@/types/wallet-balance"

export const SELECTED_PERIOD_KEY = "smoothie-selected-period"

// Dummy data for demo mode
export const DUMMY_DATA = {
  rawBalance: 12500.5432109,
  apyPercentage: 8.75,
  growthPercentage: 12.34,
  rawInterestEarned: 1250.45,
  annualYield: "1093.80",
  blndApy: 0.91,
}

export const DUMMY_CHART_DATA: WalletChartDataPoint[] = [
  { date: "2025-01-01", balance: 10000, deposit: 10000, yield: 0, type: 'historical' },
  { date: "2025-02-01", balance: 10250, deposit: 10000, yield: 250, type: 'historical' },
  { date: "2025-03-01", balance: 10520, deposit: 10000, yield: 520, type: 'historical' },
  { date: "2025-04-01", balance: 10800, deposit: 10000, yield: 800, type: 'historical' },
  { date: "2025-05-01", balance: 11090, deposit: 10000, yield: 1090, type: 'historical' },
  { date: "2025-06-01", balance: 11390, deposit: 10000, yield: 1390, type: 'historical' },
  { date: "2025-07-01", balance: 11700, deposit: 10000, yield: 1700, type: 'historical' },
  { date: "2025-08-01", balance: 12020, deposit: 10000, yield: 2020, type: 'historical' },
  { date: "2025-09-01", balance: 12350, deposit: 10000, yield: 2350, type: 'historical' },
  { date: "2025-10-01", balance: 12690, deposit: 10000, yield: 2690, type: 'historical' },
  { date: "2025-11-01", balance: 13040, deposit: 10000, yield: 3040, type: 'historical' },
]
