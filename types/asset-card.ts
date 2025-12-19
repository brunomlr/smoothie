/**
 * Asset Card Types
 * Types for individual asset/position cards
 */

export interface YieldBreakdown {
  // Cost basis (what you paid)
  costBasisHistorical: number;      // Sum of deposits - withdrawals at historical prices
  weightedAvgDepositPrice: number;  // Weighted average price of deposits
  netDepositedTokens: number;       // Tokens deposited - withdrawn

  // Protocol yield (what you earned from lending/backstop)
  protocolYieldTokens: number;      // Tokens earned = balance - netDeposited
  protocolYieldUsd: number;         // Yield tokens × current price

  // Price change (market performance on deposits)
  priceChangeUsd: number;           // Can be positive or negative
  priceChangePercent: number;       // % change from deposit price to current

  // Combined totals
  currentValueUsd: number;          // balance × current price
  totalEarnedUsd: number;           // currentValue - costBasis = yield + priceChange
  totalEarnedPercent: number;
}

export interface AssetCardData {
  id: string;
  protocolName: string;
  assetName: string;
  logoUrl: string;
  balance: string;
  rawBalance: number;
  apyPercentage: number;
  growthPercentage: number;
  earnedYield?: number; // Total yield earned: SDK Balance - Cost Basis
  yieldPercentage?: number; // Yield percentage: (Yield / Cost Basis) * 100

  // Historical yield breakdown (for tooltip)
  yieldBreakdown?: YieldBreakdown;

  // Raw token balance (not USD)
  rawTokenBalance?: number;
  // Current price from SDK
  currentPrice?: number;
  // Currency this token is pegged to (e.g., 'USD' for USDC)
  peggedCurrency?: string | null;
}

export type AssetAction = 'deposit' | 'withdraw' | 'view-details' | 'remove';
