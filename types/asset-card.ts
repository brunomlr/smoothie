/**
 * Asset Card Types
 * Types for individual asset/position cards
 */

export interface AssetCardData {
  id: string;
  protocolName: string;
  assetName: string;
  logoUrl: string;
  balance: string;
  rawBalance: number;
  apyPercentage: number;
  growthPercentage: number;
  earnedYield?: number; // Total yield earned for this position
  earnedYieldDays?: number; // Number of days over which yield was earned
}

export type AssetAction = 'deposit' | 'withdraw' | 'view-details' | 'remove';
