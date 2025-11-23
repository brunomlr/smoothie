/**
 * Transforms Dune query results to UserBalance format
 */

import { UserBalance } from '../db/types';

// Pool ID mapping based on Dune column prefixes
const POOL_MAPPING = {
  cajj: {
    id: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
    name: 'Blend Pool',
  },
  cccc: {
    id: 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
    name: 'YieldBlox',
  },
} as const;

export interface DuneRow {
  snapshot_date: string;

  // CAJJ (Blend Pool) fields
  cajj_snapshot_timestamp?: string;
  cajj_collateral_btokens?: number;
  cajj_supply_btokens?: number;
  cajj_liabilities_dtokens?: number;
  cajj_b_rate?: number;
  cajj_collateral_value?: number;
  cajj_supply_value?: number;
  cajj_liabilities_value?: number;
  cajj_total_cost_basis?: number;
  cajj_total_yield?: number;

  // CCCC (YieldBlox) fields
  cccc_snapshot_timestamp?: string;
  cccc_collateral_btokens?: number;
  cccc_supply_btokens?: number;
  cccc_liabilities_dtokens?: number;
  cccc_b_rate?: number;
  cccc_collateral_value?: number;
  cccc_supply_value?: number;
  cccc_liabilities_value?: number;
  cccc_total_cost_basis?: number;
  cccc_total_yield?: number;

  // Total fields (optional, for reference)
  total_collateral_btokens?: number;
  total_supply_btokens?: number;
  total_liabilities_dtokens?: number;
  total_collateral_value?: number;
  total_supply_value?: number;
  total_liabilities_value?: number;
  total_total_cost_basis?: number;
  total_total_yield?: number;
}

/**
 * Transforms a single Dune row into UserBalance records for each pool
 * @param row - Dune query result row
 * @param userAddress - User's wallet address
 * @param assetAddress - Asset address (e.g., USDC)
 * @returns Array of UserBalance records (one per pool with data)
 */
function transformDuneRow(
  row: DuneRow,
  userAddress: string,
  assetAddress: string
): UserBalance[] {
  const results: UserBalance[] = [];

  // Transform CAJJ pool data
  if (
    row.cajj_b_rate !== undefined &&
    row.cajj_b_rate !== null &&
    (row.cajj_collateral_btokens || row.cajj_supply_btokens || row.cajj_liabilities_dtokens)
  ) {
    const collateralBtokens = row.cajj_collateral_btokens || 0;
    const supplyBtokens = row.cajj_supply_btokens || 0;
    const liabilitiesDtokens = row.cajj_liabilities_dtokens || 0;
    const bRate = row.cajj_b_rate;

    // Calculate balances: btokens * b_rate
    const collateralBalance = collateralBtokens * bRate;
    const supplyBalance = supplyBtokens * bRate;
    // For debt, we'd need d_rate, but it's not in the data
    // Using b_rate as approximation (or set to 0 if no d_rate)
    const debtBalance = liabilitiesDtokens * (bRate || 1);
    const netBalance = collateralBalance + supplyBalance - debtBalance;

    results.push({
      pool_id: POOL_MAPPING.cajj.id,
      user_address: userAddress,
      asset_address: assetAddress,
      snapshot_date: row.snapshot_date,
      snapshot_timestamp: row.cajj_snapshot_timestamp || row.snapshot_date,
      ledger_sequence: 0, // Not available in Dune data
      supply_balance: supplyBalance,
      collateral_balance: collateralBalance,
      debt_balance: debtBalance,
      net_balance: netBalance,
      supply_btokens: supplyBtokens,
      collateral_btokens: collateralBtokens,
      liabilities_dtokens: liabilitiesDtokens,
      entry_hash: null,
      ledger_entry_change: null,
      b_rate: bRate,
      d_rate: bRate, // Using b_rate as d_rate approximation
      total_cost_basis: row.cajj_total_cost_basis || null,
      total_yield: row.cajj_total_yield || null,
    });
  }

  // Transform CCCC pool data
  if (
    row.cccc_b_rate !== undefined &&
    row.cccc_b_rate !== null &&
    (row.cccc_collateral_btokens || row.cccc_supply_btokens || row.cccc_liabilities_dtokens)
  ) {
    const collateralBtokens = row.cccc_collateral_btokens || 0;
    const supplyBtokens = row.cccc_supply_btokens || 0;
    const liabilitiesDtokens = row.cccc_liabilities_dtokens || 0;
    const bRate = row.cccc_b_rate;

    const collateralBalance = collateralBtokens * bRate;
    const supplyBalance = supplyBtokens * bRate;
    const debtBalance = liabilitiesDtokens * (bRate || 1);
    const netBalance = collateralBalance + supplyBalance - debtBalance;

    results.push({
      pool_id: POOL_MAPPING.cccc.id,
      user_address: userAddress,
      asset_address: assetAddress,
      snapshot_date: row.snapshot_date,
      snapshot_timestamp: row.cccc_snapshot_timestamp || row.snapshot_date,
      ledger_sequence: 0,
      supply_balance: supplyBalance,
      collateral_balance: collateralBalance,
      debt_balance: debtBalance,
      net_balance: netBalance,
      supply_btokens: supplyBtokens,
      collateral_btokens: collateralBtokens,
      liabilities_dtokens: liabilitiesDtokens,
      entry_hash: null,
      ledger_entry_change: null,
      b_rate: bRate,
      d_rate: bRate,
      total_cost_basis: row.cccc_total_cost_basis || null,
      total_yield: row.cccc_total_yield || null,
    });
  }

  return results;
}

/**
 * Transforms Dune query results into UserBalance array
 * @param duneRows - Array of rows from Dune query
 * @param userAddress - User's wallet address
 * @param assetAddress - Asset address (e.g., USDC)
 * @returns Array of UserBalance records sorted by date
 */
export function transformDuneResults(
  duneRows: DuneRow[],
  userAddress: string,
  assetAddress: string
): UserBalance[] {
  const results: UserBalance[] = [];

  for (const row of duneRows) {
    const balances = transformDuneRow(row, userAddress, assetAddress);
    results.push(...balances);
  }

  // Sort by snapshot_date descending (newest first)
  results.sort((a, b) => {
    const dateA = new Date(a.snapshot_date).getTime();
    const dateB = new Date(b.snapshot_date).getTime();
    return dateB - dateA;
  });

  return results;
}

/**
 * Filters Dune results by date range
 * @param balances - Array of UserBalance records
 * @param days - Number of days to include
 * @returns Filtered array
 */
export function filterByDays(balances: UserBalance[], days: number): UserBalance[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return balances.filter(balance => {
    const balanceDate = new Date(balance.snapshot_date);
    return balanceDate >= cutoffDate;
  });
}
