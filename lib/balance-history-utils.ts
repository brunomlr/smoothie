/**
 * Balance History Utility Functions
 * Helper functions for processing and transforming balance history data
 */

import {
  BalanceHistoryRecord,
  ChartDataPoint,
  PositionChange,
  EarningsStats,
  POOL_NAMES,
} from '@/types/balance-history'
import { addDaysToDate } from '@/lib/date-utils'

// ============================================
// HISTORICAL YIELD BREAKDOWN TYPES
// ============================================

export interface DepositEvent {
  date: string
  tokens: number
  priceAtDeposit: number
  usdValue: number
  poolId?: string
  priceSource?: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
  // Share units (bTokens for lending, backstop shares for backstop).
  // Withdrawal amounts in underlying/LP tokens include accrued yield; shares don't,
  // so cost basis must be reduced by share fraction, not token fraction.
  shares?: number
}

// ============================================
// SHARE-AWARE COST BASIS CORE
// ============================================

export interface ShareAwareEvent {
  date: string
  tokens: number // underlying tokens (or LP tokens for backstop) at event time
  shares?: number // bTokens/dTokens/backstop shares if known
  price: number // token price at event time
  usdValue: number // tokens × price
}

export interface ShareAwareCostBasisResult {
  costBasisUsd: number // remaining cost basis in USD (at deposit-time prices)
  principalTokens: number // remaining principal, in tokens-at-deposit terms
  realizedYieldTokens: number // tokens withdrawn in excess of principal removed
  realizedYieldUsd: number // realized yield valued at withdrawal-time prices
  realizedPriceChangeUsd: number // principal removed × withdrawal price − cost removed
}

/**
 * Share-aware running cost basis (mirrors the cb_calc SQL in events-repository).
 *
 * Withdrawal amounts are reported in underlying tokens, which INCLUDE accrued yield
 * (bTokens are burned at the withdrawal-time rate). Netting underlying amounts
 * therefore over-removes cost: closed positions land at a negative basis and
 * withdrawn yield is double-counted as still-unrealized.
 *
 * Instead, each withdrawal removes cost basis proportionally to the SHARE fraction
 * it burns. The excess tokens withdrawn above principal are realized yield, valued
 * at the withdrawal-time price. A fully-closed position lands at exactly 0.
 *
 * When share amounts are unavailable, falls back to a clamped token-proportional
 * reduction (slightly over-removes on partial withdrawals but can't go negative).
 */
export function computeShareAwareCostBasis(
  deposits: ShareAwareEvent[],
  withdrawals: ShareAwareEvent[],
): ShareAwareCostBasisResult {
  const EPSILON = 1e-9

  // Merge chronologically; on same-date ties process deposits first so a
  // same-day deposit+withdraw doesn't withdraw from an empty position.
  const merged = [
    ...deposits.map(e => ({ ...e, isDeposit: true })),
    ...withdrawals.map(e => ({ ...e, isDeposit: false })),
  ].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    return a.isDeposit === b.isDeposit ? 0 : a.isDeposit ? -1 : 1
  })

  let shares = 0
  let cost = 0
  let principal = 0
  let realizedYieldTokens = 0
  let realizedYieldUsd = 0
  let realizedPriceChangeUsd = 0

  for (const ev of merged) {
    if (ev.isDeposit) {
      shares += ev.shares ?? 0
      cost += ev.usdValue
      principal += ev.tokens
    } else {
      let fraction: number
      if (ev.shares && ev.shares > EPSILON && shares > EPSILON) {
        fraction = Math.min(1, ev.shares / shares)
      } else if (principal > EPSILON) {
        // Fallback without share data: token-proportional, clamped at full removal
        fraction = Math.min(1, ev.tokens / principal)
      } else {
        fraction = 1
      }

      const costRemoved = cost * fraction
      const principalRemoved = principal * fraction
      const yieldTokens = ev.tokens - principalRemoved

      realizedYieldTokens += yieldTokens
      realizedYieldUsd += yieldTokens * ev.price
      realizedPriceChangeUsd += principalRemoved * ev.price - costRemoved

      cost = Math.max(0, cost - costRemoved)
      principal = Math.max(0, principal - principalRemoved)
      shares = Math.max(0, shares - (ev.shares ?? 0))
    }
  }

  return {
    costBasisUsd: cost,
    principalTokens: principal,
    realizedYieldTokens,
    realizedYieldUsd,
    realizedPriceChangeUsd,
  }
}

export interface HistoricalYieldBreakdown {
  // Cost basis (what you paid) - SHARE-AWARE: withdrawals reduce basis
  // proportionally to shares removed, so closed positions land at 0
  costBasisHistorical: number      // Cost of remaining principal at deposit prices
  weightedAvgDepositPrice: number  // Remaining cost basis / remaining principal tokens
  netDepositedTokens: number       // Remaining principal tokens (deposit-time terms)

  // Protocol yield (what you earned from lending/backstop) - unrealized only
  protocolYieldTokens: number      // Tokens earned = balance - remaining principal
  protocolYieldUsd: number         // Yield tokens × current price

  // Price change (market performance on remaining deposits)
  priceChangeUsd: number           // Can be positive or negative
  priceChangePercent: number       // % change from deposit price to current

  // Combined totals (unrealized)
  currentValueUsd: number          // balance × current price
  totalEarnedUsd: number           // currentValue - costBasis = yield + priceChange
  totalEarnedPercent: number

  // Realized components (from withdrawals, valued at withdrawal-time prices)
  realizedYieldTokens?: number
  realizedYieldUsd?: number
  realizedPriceChangeUsd?: number
}

// ============================================
// BORROW COST BREAKDOWN TYPES
// ============================================

export interface BorrowEvent {
  date: string
  tokens: number
  priceAtBorrow: number
  usdValue: number
  poolId?: string
  priceSource?: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
  // dToken shares. Repay amounts in underlying include accrued interest;
  // dTokens don't, so principal must be reduced by share fraction.
  shares?: number
}

/**
 * Borrow Cost Breakdown - calculates how much the user owes and how much is interest
 *
 * Key concepts for borrowing (inverse of supply):
 * - Cost basis = net borrowed amount at original prices (what you borrowed)
 * - Interest accrued = current debt - cost basis (what you owe beyond principal)
 * - Price change on debt: if price goes UP, debt value goes UP = bad for borrower
 *
 * Formula:
 * - borrowCostBasis = (total borrowed - total repaid) at weighted avg borrow price
 * - interestAccruedTokens = currentDebt - netBorrowedTokens
 * - interestAccruedUsd = interestAccruedTokens × currentPrice
 * - priceChangeOnDebt = netBorrowedTokens × (currentPrice - avgBorrowPrice)
 *   (positive = price went up = BAD for borrower, debt is more expensive to repay)
 */
export interface HistoricalBorrowBreakdown {
  // Cost basis (what you borrowed) - uses AVERAGE COST METHOD
  borrowCostBasisUsd: number       // USD value of net borrowed amount at borrow-time prices
  weightedAvgBorrowPrice: number   // Actual average price when tokens were borrowed
  netBorrowedTokens: number        // Tokens borrowed - repaid (principal outstanding)

  // Interest accrued (protocol cost, unrealized - not yet repaid)
  interestAccruedTokens: number    // Tokens owed beyond principal = currentDebt - netBorrowed
  interestAccruedUsd: number       // Interest tokens × current price

  // Price change on debt (market impact)
  // Note: For borrowers, price increase is BAD (debt becomes more expensive)
  priceChangeOnDebtUsd: number     // netBorrowed × (currentPrice - avgBorrowPrice)
  priceChangePercent: number       // % change from borrow price to current

  // Current debt totals
  currentDebtTokens: number        // Current outstanding debt from SDK
  currentDebtUsd: number           // currentDebt × current price

  // Total cost (negative = cost to user)
  // totalCostUsd = interestAccruedUsd + priceChangeOnDebtUsd
  // (both positive values represent costs to borrower)
  totalCostUsd: number
  totalCostPercent: number

  // Realized components (interest already paid via repays, valued at repay-time prices)
  realizedInterestTokens?: number
  realizedInterestUsd?: number
  realizedPriceChangeOnDebtUsd?: number
}

/**
 * Calculate yield breakdown separating protocol earnings from price changes.
 * Uses AVERAGE COST METHOD for accurate cost basis calculation.
 *
 * Key insight:
 * - Avg deposit price = total USD deposited / total tokens deposited
 * - Cost basis = remaining tokens × avg deposit price (withdrawals reduce at avg cost)
 * - Current value = current balance × current SDK price
 * - Protocol yield = tokens earned (balance - net deposits) × current price
 * - Price change = net deposited tokens × (current price - avg deposit price)
 *
 * This method ensures the "weighted average price" shown to users matches
 * the actual price they paid, rather than inflated values caused by
 * withdrawals at different market prices.
 *
 * Same-day deposits are treated specially: they use current SDK price for cost basis
 * to avoid showing misleading P&L from intraday price fluctuations (we only have
 * daily price data, so same-day P&L would be noise).
 *
 * @param currentBalance Current token balance from SDK
 * @param currentPrice Current token price from SDK (ALWAYS use SDK, not DB)
 * @param deposits All deposits with historical prices from daily_token_prices
 * @param withdrawals All withdrawals with historical prices
 */
export function calculateHistoricalYieldBreakdown(
  currentBalance: number,
  currentPrice: number,
  deposits: DepositEvent[],
  withdrawals: DepositEvent[],
): HistoricalYieldBreakdown {
  // Get today's date in YYYY-MM-DD format (same format as deposit dates)
  const today = new Date().toISOString().split('T')[0]

  // Separate same-day deposits from historical deposits
  // Same-day deposits use current price for cost basis to avoid misleading P&L
  const historicalDeposits = deposits.filter(d => d.date !== today)
  const sameDayDeposits = deposits.filter(d => d.date === today)

  // For same-day deposits, recalculate USD value using current price
  // This ensures cost basis = current value, resulting in $0 price change
  const sameDayDepositsAdjusted = sameDayDeposits.map(d => ({
    ...d,
    priceAtDeposit: currentPrice,
    usdValue: d.tokens * currentPrice,
  }))

  // Combine historical and adjusted same-day deposits
  const adjustedDeposits = [...historicalDeposits, ...sameDayDepositsAdjusted]

  // 1. Run the share-aware cost basis (withdrawals reduce cost proportionally to
  // shares removed, never below 0; excess withdrawn tokens are realized yield)
  const shareAware = computeShareAwareCostBasis(
    adjustedDeposits.map(d => ({
      date: d.date,
      tokens: d.tokens,
      shares: d.shares,
      price: d.priceAtDeposit,
      usdValue: d.usdValue,
    })),
    withdrawals.map(w => ({
      date: w.date,
      tokens: w.tokens,
      shares: w.shares,
      price: w.priceAtDeposit, // withdrawal events carry their price in this field
      usdValue: w.usdValue,
    })),
  )

  const costBasisHistorical = shareAware.costBasisUsd
  const netDepositedTokens = shareAware.principalTokens

  // 2. Weighted average deposit price of the REMAINING principal
  const weightedAvgDepositPrice = netDepositedTokens > 0
    ? costBasisHistorical / netDepositedTokens
    : currentPrice // Fallback to current if position closed / no deposits

  // 3. Calculate protocol yield (tokens earned from APY, unrealized)
  const protocolYieldTokens = currentBalance - netDepositedTokens
  const protocolYieldUsd = protocolYieldTokens * currentPrice

  // 4. Calculate price change on remaining deposited tokens
  const depositValueAtCurrentPrice = netDepositedTokens * currentPrice
  const priceChangeUsd = depositValueAtCurrentPrice - costBasisHistorical
  const priceChangePercent = costBasisHistorical > 0
    ? (priceChangeUsd / costBasisHistorical) * 100
    : 0

  // 5. Calculate totals
  const currentValueUsd = currentBalance * currentPrice
  const totalEarnedUsd = currentValueUsd - costBasisHistorical
  // Note: totalEarnedUsd = protocolYieldUsd + priceChangeUsd (they should sum up)

  return {
    // Cost basis
    costBasisHistorical,
    weightedAvgDepositPrice,
    netDepositedTokens,

    // Protocol yield (what you earned from lending)
    protocolYieldTokens,
    protocolYieldUsd,

    // Price change (market movement, can be negative)
    priceChangeUsd,
    priceChangePercent,

    // Totals
    currentValueUsd,
    totalEarnedUsd,
    totalEarnedPercent: costBasisHistorical > 0
      ? (totalEarnedUsd / costBasisHistorical) * 100
      : 0,

    // Realized components (withdrawn yield, valued at withdrawal-time prices)
    realizedYieldTokens: shareAware.realizedYieldTokens,
    realizedYieldUsd: shareAware.realizedYieldUsd,
    realizedPriceChangeUsd: shareAware.realizedPriceChangeUsd,
  }
}

/**
 * Period-specific yield breakdown - calculates yield for a specific time period
 * rather than all-time.
 *
 * Key formulas:
 * - Protocol Yield (period) = (tokens_now - tokens_at_period_start) × price_now
 * - Price Change (period) = tokens_at_period_start × (price_now - price_at_period_start)
 * - Total Earned (period) = Protocol Yield + Price Change
 */
export interface PeriodYieldBreakdown {
  // What you started with at period start
  tokensAtStart: number
  valueAtStart: number  // tokens_at_start × price_at_start
  priceAtStart: number

  // What you have now
  tokensNow: number
  valueNow: number  // tokens_now × price_now
  priceNow: number

  // Period-specific earnings
  protocolYieldTokens: number  // tokens_now - tokens_at_start
  protocolYieldUsd: number     // protocol_yield_tokens × price_now
  priceChangeUsd: number       // tokens_at_start × (price_now - price_at_start)
  totalEarnedUsd: number       // protocol_yield + price_change
  totalEarnedPercent: number   // total_earned / value_at_start
}

/**
 * Calculate period-specific yield breakdown.
 *
 * @param tokensAtStart Token balance at period start (from history)
 * @param priceAtStart Token price at period start (from historical prices)
 * @param tokensNow Current token balance (from SDK)
 * @param priceNow Current token price (from SDK)
 */
export function calculatePeriodYieldBreakdown(
  tokensAtStart: number,
  priceAtStart: number,
  tokensNow: number,
  priceNow: number,
): PeriodYieldBreakdown {
  // Value at period start
  const valueAtStart = tokensAtStart * priceAtStart

  // Value now
  const valueNow = tokensNow * priceNow

  // Protocol yield: tokens earned during period × current price
  const protocolYieldTokens = tokensNow - tokensAtStart
  const protocolYieldUsd = protocolYieldTokens * priceNow

  // Price change: how much the starting tokens changed in value due to price movement
  const priceChangeUsd = tokensAtStart * (priceNow - priceAtStart)

  // Total earned for the period
  const totalEarnedUsd = protocolYieldUsd + priceChangeUsd
  // Note: totalEarnedUsd should equal (valueNow - valueAtStart)

  // Percentage gain
  const totalEarnedPercent = valueAtStart > 0
    ? (totalEarnedUsd / valueAtStart) * 100
    : 0

  return {
    tokensAtStart,
    valueAtStart,
    priceAtStart,
    tokensNow,
    valueNow,
    priceNow,
    protocolYieldTokens,
    protocolYieldUsd,
    priceChangeUsd,
    totalEarnedUsd,
    totalEarnedPercent,
  }
}

/**
 * Calculate borrow cost breakdown separating interest from price changes.
 * Uses AVERAGE COST METHOD for accurate cost basis calculation.
 *
 * Key insight for borrowing (inverse of supply):
 * - When you borrow, you take on debt at the borrow-time price
 * - Interest accrues in tokens, increasing your debt
 * - Price changes affect how expensive it is to repay:
 *   - If price goes UP: your debt is worth more → BAD for borrower
 *   - If price goes DOWN: your debt is cheaper to repay → GOOD for borrower
 *
 * This is the INVERSE of supply where price up = good.
 *
 * Same-day borrows are treated specially: they use current SDK price for cost basis
 * to avoid showing misleading P&L from intraday price fluctuations.
 *
 * @param currentDebt Current debt token balance from SDK
 * @param currentPrice Current token price from SDK (ALWAYS use SDK, not DB)
 * @param borrows All borrows with historical prices from daily_token_prices
 * @param repays All repays with historical prices
 */
export function calculateHistoricalBorrowBreakdown(
  currentDebt: number,
  currentPrice: number,
  borrows: BorrowEvent[],
  repays: BorrowEvent[],
): HistoricalBorrowBreakdown {
  // Get today's date in YYYY-MM-DD format (same format as borrow dates)
  const today = new Date().toISOString().split('T')[0]

  // Separate same-day borrows from historical borrows
  // Same-day borrows use current price for cost basis to avoid misleading P&L
  const historicalBorrows = borrows.filter(b => b.date !== today)
  const sameDayBorrows = borrows.filter(b => b.date === today)

  // For same-day borrows, recalculate USD value using current price
  const sameDayBorrowsAdjusted = sameDayBorrows.map(b => ({
    ...b,
    priceAtBorrow: currentPrice,
    usdValue: b.tokens * currentPrice,
  }))

  // Combine historical and adjusted same-day borrows
  const adjustedBorrows = [...historicalBorrows, ...sameDayBorrowsAdjusted]

  // 1. Run the share-aware cost basis with dToken shares.
  // Repaid underlying includes interest paid, so principal is reduced by the
  // dToken share fraction each repay burns. A fully repaid loan lands at
  // principal 0 / basis 0 (no negative basis, no sign-flipped price impact);
  // interest paid shows up in the realized fields instead of vanishing.
  const shareAware = computeShareAwareCostBasis(
    adjustedBorrows.map(b => ({
      date: b.date,
      tokens: b.tokens,
      shares: b.shares,
      price: b.priceAtBorrow,
      usdValue: b.usdValue,
    })),
    repays.map(r => ({
      date: r.date,
      tokens: r.tokens,
      shares: r.shares,
      price: r.priceAtBorrow, // repay events carry their price in this field
      usdValue: r.usdValue,
    })),
  )

  const borrowCostBasisUsd = shareAware.costBasisUsd
  const netBorrowedTokens = shareAware.principalTokens

  // 2. Weighted average borrow price of the REMAINING principal
  const weightedAvgBorrowPrice = netBorrowedTokens > 0
    ? borrowCostBasisUsd / netBorrowedTokens
    : currentPrice // Fallback to current if loan closed / no borrows

  // 3. Calculate interest accrued (tokens owed beyond outstanding principal)
  const interestAccruedTokens = currentDebt - netBorrowedTokens
  const interestAccruedUsd = interestAccruedTokens * currentPrice

  // 4. Calculate price change on outstanding debt
  // IMPORTANT: For borrowers, price increase is BAD (debt is more expensive to repay)
  // This is the opposite of supply where price increase is good
  const debtValueAtCurrentPrice = netBorrowedTokens * currentPrice
  const priceChangeOnDebtUsd = debtValueAtCurrentPrice - borrowCostBasisUsd
  // positive = price went up = debt is more expensive = BAD for borrower
  const priceChangePercent = borrowCostBasisUsd > 0
    ? (priceChangeOnDebtUsd / borrowCostBasisUsd) * 100
    : 0

  // 6. Calculate current debt totals
  const currentDebtUsd = currentDebt * currentPrice

  // 7. Calculate total cost to borrower
  // Both interest and price increase are costs to the borrower
  const totalCostUsd = interestAccruedUsd + priceChangeOnDebtUsd
  const totalCostPercent = borrowCostBasisUsd > 0
    ? (totalCostUsd / borrowCostBasisUsd) * 100
    : 0

  return {
    // Cost basis
    borrowCostBasisUsd,
    weightedAvgBorrowPrice,
    netBorrowedTokens,

    // Interest accrued (protocol cost)
    interestAccruedTokens,
    interestAccruedUsd,

    // Price change on debt (market impact)
    priceChangeOnDebtUsd,
    priceChangePercent,

    // Current debt totals
    currentDebtTokens: currentDebt,
    currentDebtUsd,

    // Total cost
    totalCostUsd,
    totalCostPercent,

    // Realized components (interest already paid, valued at repay-time prices)
    realizedInterestTokens: shareAware.realizedYieldTokens,
    realizedInterestUsd: shareAware.realizedYieldUsd,
    realizedPriceChangeOnDebtUsd: shareAware.realizedPriceChangeUsd,
  }
}

/**
 * Calculate yield breakdown for backstop LP positions.
 * Same logic as regular assets but for LP tokens.
 */
export function calculateBackstopYieldBreakdown(
  currentLpTokens: number,
  currentLpPrice: number,  // From SDK
  deposits: Array<{ lpTokens: number; priceAtDeposit: number; usdValue: number }>,
  withdrawals: Array<{ lpTokens: number; priceAtWithdrawal: number; usdValue: number }>,
): HistoricalYieldBreakdown {
  // Convert to standard DepositEvent format
  const depositEvents: DepositEvent[] = deposits.map(d => ({
    date: '',
    tokens: d.lpTokens,
    priceAtDeposit: d.priceAtDeposit,
    usdValue: d.usdValue,
  }))

  const withdrawalEvents: DepositEvent[] = withdrawals.map(w => ({
    date: '',
    tokens: w.lpTokens,
    priceAtDeposit: w.priceAtWithdrawal,
    usdValue: w.usdValue,
  }))

  return calculateHistoricalYieldBreakdown(
    currentLpTokens,
    currentLpPrice,
    depositEvents,
    withdrawalEvents,
  )
}

/**
 * Transform balance history records into chart data
 * Backend now handles forward-fill with rate recalculation
 */
export function fillMissingDates(
  records: BalanceHistoryRecord[],
  includeBaselineDay: boolean = true,
  firstEventDate: string | null = null,
): ChartDataPoint[] {
  if (records.length === 0) {
    return []
  }

  // Group records by date and pool
  const datePoolMap = new Map<
    string,
    Map<string, BalanceHistoryRecord>
  >()

  records.forEach((record) => {
    if (!datePoolMap.has(record.snapshot_date)) {
      datePoolMap.set(record.snapshot_date, new Map())
    }
    datePoolMap
      .get(record.snapshot_date)!
      .set(record.pool_id, record)
  })

  // Get all dates and sort
  const allDates = Array.from(datePoolMap.keys()).sort()

  // Add a $0 baseline day before the first data point (only if this IS the first-ever event)
  // This ensures we only show $0 at the very beginning of the pool history, not at the start of filtered views
  let baselineInserted = false
  if (includeBaselineDay && allDates.length > 0 && firstEventDate) {
    const firstDateInRecords = allDates[0]

    // Only add baseline if the first date in our records matches the absolute first event date
    if (firstDateInRecords === firstEventDate) {
      // String-based day arithmetic: new Date('YYYY-MM-DD') parses as UTC
      // midnight, so local get/setDate in negative-UTC-offset timezones
      // landed the baseline TWO days before the first event
      const dayBeforeStr = addDaysToDate(allDates[0], -1)

      // Add empty pool map for the day before (will show $0)
      datePoolMap.set(dayBeforeStr, new Map())
      allDates.unshift(dayBeforeStr)
      baselineInserted = true
    }
  }

  // Calculate initial deposit amount from first data point (skip $0 baseline
  // ONLY if it was actually inserted - wallets older than the fetched window
  // don't get one, and skipping allDates[0] would seed from the second day)
  const firstRealDate = baselineInserted && allDates.length > 1 ? allDates[1] : allDates[0]
  const firstDateRecords = datePoolMap.get(firstRealDate)!

  // Track cumulative deposits per pool (bTokens and initial b_rate)
  const poolBTokens = new Map<string, number>()
  const poolInitialBRate = new Map<string, number>()
  // Track if we have Dune cost_basis data (to avoid recalculating)
  const poolHasCostBasis = new Map<string, boolean>()
  firstDateRecords.forEach((record, poolId) => {
    const totalBTokens = record.supply_btokens + record.collateral_btokens
    poolBTokens.set(poolId, totalBTokens)
    poolInitialBRate.set(poolId, record.b_rate)
    const hasCostBasis = record.total_cost_basis !== undefined && record.total_cost_basis !== null
    poolHasCostBasis.set(poolId, hasCostBasis)
  })

  // Build chart data - backend already filled missing dates with recalculated rates
  const chartData: ChartDataPoint[] = allDates.map((date) => {
    const dateRecords = datePoolMap.get(date)!
    const pools: ChartDataPoint['pools'] = []
    let total = 0
    let totalDeposit = 0
    let totalBorrow = 0

    dateRecords.forEach((record, poolId) => {
      // Use supply + collateral only (don't subtract debt for the chart)
      // This matches the SDK's totalSupplyUsd which doesn't deduct borrowed amounts
      const balance = record.supply_balance + record.collateral_balance
      const borrow = record.debt_balance

      // Update tracked bTokens if there's a change (deposit/withdrawal)
      const currentBTokens = record.supply_btokens + record.collateral_btokens
      const trackedBTokens = poolBTokens.get(poolId) || 0

      // If bTokens changed, update tracking (this is a deposit or withdrawal)
      if (Math.abs(currentBTokens - trackedBTokens) > 0.0001) {
        poolBTokens.set(poolId, currentBTokens)
        // Update initial b_rate for the new position
        poolInitialBRate.set(poolId, record.b_rate)
      }

      // Use Dune cost_basis if available, otherwise calculate from bTokens
      let depositAmount: number
      const useDuneCostBasis = poolHasCostBasis.get(poolId) && record.total_cost_basis !== undefined && record.total_cost_basis !== null

      if (useDuneCostBasis) {
        // Use Dune's pre-calculated cost basis
        depositAmount = record.total_cost_basis!
      } else {
        // Fallback: calculate deposit amount using INITIAL b_rate (at time of deposit)
        const initialRate = poolInitialBRate.get(poolId) || record.b_rate
        depositAmount = (poolBTokens.get(poolId) || 0) * initialRate
      }
      totalDeposit += depositAmount
      totalBorrow += borrow

      pools.push({
        poolId,
        poolName: getPoolName(poolId),
        balance,
        deposit: depositAmount,
        yield: record.total_yield || 0, // Use Dune's pre-calculated yield
        borrow,
      })
      total += balance
    })

    const yield_amount = total - totalDeposit

    return {
      date,
      formattedDate: formatChartDate(date),
      timestamp: parseLocalDate(date).getTime(),
      pool_yieldblox:
        pools.find(
          (p) =>
            p.poolId ===
            'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
        )?.balance || 0,
      pool_blend:
        pools.find(
          (p) =>
            p.poolId ===
            'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
        )?.balance || 0,
      total,
      deposit: totalDeposit,
      yield: yield_amount,
      borrow: totalBorrow,
      pools,
    }
  })

  return chartData
}

/**
 * Detect position changes (deposits/withdrawals)
 * Compares btokens between consecutive days
 */
export function detectPositionChanges(
  records: BalanceHistoryRecord[],
  threshold: number = 0.01,
): PositionChange[] {
  if (records.length <= 1) {
    return []
  }

  const changes: PositionChange[] = []

  // Sort by date and ledger sequence
  const sorted = [...records].sort((a, b) => {
    const dateComp = a.snapshot_date.localeCompare(
      b.snapshot_date,
    )
    if (dateComp !== 0) return dateComp
    return a.ledger_sequence - b.ledger_sequence
  })

  // Group by date
  const byDate = new Map<string, BalanceHistoryRecord[]>()
  sorted.forEach((record) => {
    if (!byDate.has(record.snapshot_date)) {
      byDate.set(record.snapshot_date, [])
    }
    byDate.get(record.snapshot_date)!.push(record)
  })

  const dates = Array.from(byDate.keys()).sort()

  // Compare consecutive dates
  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1]
    const currDate = dates[i]

    const prevRecords = byDate.get(prevDate)!
    const currRecords = byDate.get(currDate)!

    // Sum up positions by pool
    const prevSums = {
      supply: prevRecords.reduce(
        (sum, r) => sum + r.supply_btokens,
        0,
      ),
      collateral: prevRecords.reduce(
        (sum, r) => sum + r.collateral_btokens,
        0,
      ),
      debt: prevRecords.reduce(
        (sum, r) => sum + r.liabilities_dtokens,
        0,
      ),
    }

    const currSums = {
      supply: currRecords.reduce(
        (sum, r) => sum + r.supply_btokens,
        0,
      ),
      collateral: currRecords.reduce(
        (sum, r) => sum + r.collateral_btokens,
        0,
      ),
      debt: currRecords.reduce(
        (sum, r) => sum + r.liabilities_dtokens,
        0,
      ),
    }

    const supplyChange = currSums.supply - prevSums.supply
    const collateralChange =
      currSums.collateral - prevSums.collateral
    const debtChange = currSums.debt - prevSums.debt

    // Check if changes are significant
    const isSignificant =
      Math.abs(supplyChange) > threshold ||
      Math.abs(collateralChange) > threshold ||
      Math.abs(debtChange) > threshold

    if (isSignificant) {
      const prevTotal = prevRecords.reduce(
        (sum, r) => sum + r.net_balance,
        0,
      )
      const currTotal = currRecords.reduce(
        (sum, r) => sum + r.net_balance,
        0,
      )

      changes.push({
        index: i,
        date: currDate,
        supplyChange,
        collateralChange,
        debtChange,
        netChange: currTotal - prevTotal,
        isSignificant,
      })
    }
  }

  return changes
}

/**
 * Calculate earnings statistics PER POOL
 * Interest is calculated from rate changes, not balance changes
 */
export function calculateEarningsStats(
  chartData: ChartDataPoint[],
  positionChanges: PositionChange[],
): EarningsStats {
  void positionChanges

  if (chartData.length <= 1) {
    return {
      totalInterest: 0,
      currentAPY: 0,
      avgDailyInterest: 0,
      projectedAnnual: 0,
      dayCount: 0,
      avgPosition: 0,
      perPool: {},
    }
  }

  const dayCount = chartData.length - 1
  const perPool: Record<string, {
    totalInterest: number
    currentAPY: number
    avgDailyInterest: number
    projectedAnnual: number
    avgPosition: number
  }> = {}

  // Get all unique pool IDs
  const poolIds = new Set<string>()
  chartData.forEach(point => {
    point.pools.forEach(pool => poolIds.add(pool.poolId))
  })

  // Calculate stats for each pool separately
  poolIds.forEach(poolId => {
    // Find latest yield from Dune and latest balance for this pool
    let totalInterest = 0 // This will be Dune's total_yield
    let latestBalance = 0
    let totalPosition = 0
    let dataPoints = 0

    for (let i = 0; i < chartData.length; i++) {
      const currPool = chartData[i].pools.find(p => p.poolId === poolId)
      if (currPool) {
        // Use Dune's pre-calculated yield (total_yield field)
        totalInterest = currPool.yield
        latestBalance = currPool.balance
        totalPosition += currPool.balance
        dataPoints++
      }
    }

    const avgPosition = dataPoints > 0 ? totalPosition / dataPoints : 0
    const avgDailyInterest = totalInterest / dayCount

    // Calculate APY
    const apy = avgPosition > 0
      ? (totalInterest / avgPosition) * (365 / dayCount) * 100
      : 0

    // Projected annual (using latestBalance from loop above)
    const projectedAnnual = (latestBalance * apy) / 100

    perPool[poolId] = {
      totalInterest,
      currentAPY: apy,
      avgDailyInterest,
      projectedAnnual,
      avgPosition,
    }
  })

  // Calculate combined stats
  const totalInterest = Object.values(perPool).reduce((sum, p) => sum + p.totalInterest, 0)
  const avgDailyInterest = totalInterest / dayCount

  const totalPosition = Object.values(perPool).reduce((sum, p) => sum + p.avgPosition, 0)
  const combinedAPY = totalPosition > 0
    ? (totalInterest / totalPosition) * (365 / dayCount) * 100
    : 0

  const latestBalance = chartData[chartData.length - 1].total
  const projectedAnnual = (latestBalance * combinedAPY) / 100

  return {
    totalInterest,
    currentAPY: combinedAPY,
    avgDailyInterest,
    projectedAnnual,
    dayCount,
    avgPosition: totalPosition,
    perPool,
  }
}

/**
 * Group balance records by date
 */
export function groupByDate(
  records: BalanceHistoryRecord[],
): Map<string, BalanceHistoryRecord[]> {
  const grouped = new Map<string, BalanceHistoryRecord[]>()

  records.forEach((record) => {
    if (!grouped.has(record.snapshot_date)) {
      grouped.set(record.snapshot_date, [])
    }
    grouped.get(record.snapshot_date)!.push(record)
  })

  return grouped
}

/**
 * Get human-readable pool name
 */
export function getPoolName(poolId: string): string {
  return POOL_NAMES[poolId] || poolId.slice(0, 8) + '...'
}

/**
 * Format date for chart display
 */
/**
 * Parse a YYYY-MM-DD string as LOCAL midnight. new Date('YYYY-MM-DD') parses
 * as UTC midnight, which renders as the PREVIOUS day for users west of UTC.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatChartDate(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}
