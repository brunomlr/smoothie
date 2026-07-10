/**
 * Gains & Losses report types
 *
 * These types shape the data for the Activity "Gains & Losses" tab.
 * See plan/activity-gains-losses-tab.md for the full design.
 */

export type PriceSource = 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'

export type IncomeSource = 'interest' | 'pool_emissions' | 'backstop_emissions'

export interface IncomeRow {
  date: string // ISO timestamp (UTC)
  source: IncomeSource
  poolId: string | null
  poolName: string | null
  asset: string
  assetAddress: string | null
  quantity: number
  priceUsd: number
  valueUsd: number
  priceSource: PriceSource
  txHash: string
}

export type DisposalKind = 'lp_withdrawal' | 'liquidation_collateral'

export type HoldingPeriod = 'short' | 'long'

export interface DisposalRow {
  date: string // ISO timestamp (UTC) of disposal
  kind: DisposalKind
  poolId: string | null
  poolName: string | null
  asset: string
  assetAddress: string | null
  quantity: number
  /** Single lot acquisition date, or 'VARIOUS' when multiple lots of the same holding period were consumed */
  dateAcquired: string
  holdingPeriod: HoldingPeriod
  proceedsUsd: number
  costBasisUsd: number
  gainLossUsd: number
  priceSource: PriceSource
  txHash: string
  note?: string
}

/**
 * A withdrawal that returned fewer tokens than the principal consumed
 * (bad-debt socialization, e.g. the YieldBlox incident).
 */
export interface LossEventRow {
  date: string // ISO timestamp (UTC)
  poolId: string
  poolName: string | null
  asset: string
  assetAddress: string | null
  principalTokens: number
  receivedTokens: number
  lossTokens: number
  priceUsd: number
  lossUsd: number
  priceSource: PriceSource
  txHash: string
}

/**
 * An incident-remediation payment received by the wallet (e.g. the YieldBlox
 * reimbursement). Offsets loss events: a reimbursed loss generally cannot be
 * claimed, and any excess over the loss may itself be reportable.
 */
export interface ReimbursementRow {
  date: string // ISO timestamp (UTC)
  label: string
  relatedPoolId: string
  asset: string
  assetAddress: string
  quantity: number
  priceUsd: number
  valueUsd: number
  priceSource: PriceSource
  txHash: string
  from: string
}

/** Interest embedded in repayments (potential deductible expense) */
export interface InterestPaidRow {
  date: string // ISO timestamp (UTC)
  poolId: string
  poolName: string | null
  asset: string
  assetAddress: string | null
  interestTokens: number
  priceUsd: number
  interestUsd: number
  priceSource: PriceSource
  txHash: string
}

export type HoldingType = 'supply' | 'debt' | 'backstop_lp'

export interface HoldingRow {
  type: HoldingType
  poolId: string
  poolName: string | null
  asset: string
  assetAddress: string | null
  quantity: number // underlying tokens (supply/debt) or LP tokens (backstop)
  priceUsd: number
  valueUsd: number
  priceSource: PriceSource
  /** Remaining USD cost basis of the open lots (supply/backstop only) */
  costBasisUsd: number | null
  /** Remaining principal in tokens of the open lots (supply only) */
  principalTokens: number | null
}

export interface YearSummary {
  incomeUsd: number
  incomeBySource: Record<IncomeSource, number>
  disposalProceedsUsd: number
  disposalCostBasisUsd: number
  disposalGainLossUsd: number
  shortTermGainLossUsd: number
  longTermGainLossUsd: number
  lossEventsUsd: number
  reimbursementsUsd: number
  interestPaidUsd: number
  /** income + disposal gain/loss - loss events + reimbursements */
  netUsd: number
}

export interface YearReport {
  year: number
  summary: YearSummary
  income: IncomeRow[]
  disposals: DisposalRow[]
  lossEvents: LossEventRow[]
  reimbursements: ReimbursementRow[]
  interestPaid: InterestPaidRow[]
  /** Positions as of Dec 31 of this year (or "now" for the current year) */
  yearEndHoldings: HoldingRow[]
  yearEndDate: string // YYYY-MM-DD the holdings were valued at
}

export interface GainsLossesLedger {
  /** All years with at least one event, ascending */
  years: number[]
  reports: YearReport[]
  /** Events the engine saw but does not model (kept for transparency) */
  notes: string[]
  /** True if any event or open position touches the YieldBlox pool */
  yieldBloxExposure: boolean
}

// ============ Wallet transfers (Horizon, display-only) ============

export interface WalletTransferRow {
  date: string // ISO timestamp
  direction: 'received' | 'sent'
  counterparty: string | null
  operationType: string
  asset: string
  assetAddress: string
  quantity: number
  priceUsd: number
  valueUsd: number
  priceSource: PriceSource
  txHash: string
}

export interface WalletTransfersResponse {
  year: number
  transfers: WalletTransferRow[]
  /** True if Horizon pagination hit the safety cap before reaching the year start */
  truncated: boolean
}
