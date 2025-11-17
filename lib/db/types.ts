// Balance Calculation Types
export interface UserBalance {
  pool_id: string
  user_address: string
  asset_address: string
  snapshot_date: string
  snapshot_timestamp: string
  ledger_sequence: number
  supply_balance: number
  collateral_balance: number
  debt_balance: number
  net_balance: number
  supply_btokens: number
  collateral_btokens: number
  liabilities_dtokens: number
  entry_hash: string | null
  ledger_entry_change: number | null
  b_rate: number
  d_rate: number
  // Debug fields for rate comparison
  position_b_rate?: number | null
  position_d_rate?: number | null
  snapshot_b_rate?: number | null
  snapshot_d_rate?: number | null
  position_date?: string | null
}
