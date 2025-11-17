/**
 * Wallet Balance Types
 * Types for wallet balance display and chart data
 */

export interface BalanceData {
  balance: string;
  rawBalance: number;
  apyPercentage: number;
  interestEarned: string;
  annualYield: string;
  growthPercentage: number;
}

export interface ChartDataPoint {
  date: string;
  balance: number;
  deposit: number;
  yield: number;
  type: 'historical' | 'current' | 'projected';
}
