/**
 * Gains & Losses engine
 *
 * Pure FIFO lot-ledger over the user's full Blend event stream.
 * Produces per-year income, disposals, loss events, interest paid and
 * year-end holdings. See plan/activity-gains-losses-tab.md §4.
 *
 * Accounting model (per the plan):
 * - supply/withdraw of the same asset is NOT a disposal. The interest portion
 *   of each withdrawal (tokens received beyond the FIFO-consumed principal)
 *   is income dated at withdrawal. A negative interest portion (bad-debt
 *   socialization, e.g. YieldBlox) is a loss event.
 * - Backstop LP is its own asset: deposits create lots, withdrawals are
 *   disposals with short/long-term classification.
 * - Emission claims (pool BLND, backstop LP) are income at FMV when received.
 *   Auto-restaked backstop claims create the LP lot from the claim itself;
 *   the sibling deposit event in the same transaction is deduped.
 * - Liquidations (fill_auction, auction_type 0) are disposals of the seized
 *   collateral: proceeds = debt relief, basis = consumed collateral lots.
 *   For a liquidator, the seized collateral becomes a new lot with basis =
 *   the debt they assumed.
 * - Borrows create debt lots; the interest portion of each repayment
 *   (FIFO over debt lots) is reported as interest paid.
 */

import type { UserAction } from '@/lib/db/types'
import {
  BLND_TOKEN_ADDRESS,
  LP_TOKEN_ADDRESS,
  YIELDBLOX_POOL_ID,
} from '@/lib/config/blockchain'
import type {
  DisposalRow,
  GainsLossesLedger,
  HoldingRow,
  IncomeRow,
  InterestPaidRow,
  LossEventRow,
  PriceSource,
  ReimbursementRow,
  YearReport,
  YearSummary,
} from './types'

export interface LiquidationFlow {
  pool_id: string
  ledger_closed_at: string
  role: 'liquidated' | 'liquidator'
  lot_asset: string | null
  lot_underlying: number
  bid_asset: string | null
  bid_underlying: number
}

export interface TokenMeta {
  symbol: string
  decimals: number
}

export type PriceLookup = (
  tokenAddress: string | null,
  date: string
) => { price: number; source: PriceSource }

export type RateLookup = (
  poolId: string,
  assetAddress: string,
  date: string
) => { bRate: number | null; dRate: number | null } | null

export interface EngineInput {
  userAddress: string
  /** Full event history, any order (sorted internally) */
  actions: UserAction[]
  liquidationFlows: LiquidationFlow[]
  /** Incident-remediation payments received (already priced by the builder) */
  reimbursements?: ReimbursementRow[]
  tokenMeta: Map<string, TokenMeta>
  priceAt: PriceLookup
  /** Used only to value year-end holdings */
  rateAt: RateLookup
  /** YYYY-MM-DD (UTC) — valuation date for the current year's holdings */
  todayDate: string
}

interface Lot {
  date: string // ISO timestamp of acquisition
  shares: number // bTokens / dTokens / LP tokens
  principalTokens: number // underlying tokens (LP tokens for backstop lots)
  usdBasis: number
}

interface Position {
  poolId: string
  poolName: string | null
  asset: string
  assetAddress: string | null
  lots: Lot[]
}

interface ConsumedSlice {
  lotDate: string
  shares: number
  principalTokens: number
  usdBasis: number
}

const DUST = 1e-7
const MIN_USD = 0.005 // drop sub-cent noise rows
const LONG_TERM_MS = 365 * 24 * 60 * 60 * 1000

function toUnits(raw: number | null, decimals: number | null): number {
  if (raw === null) return 0
  return raw / Math.pow(10, decimals ?? 7)
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function yearOf(timestamp: string): number {
  return parseInt(timestamp.slice(0, 4), 10)
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((sum, item) => sum + pick(item), 0)
}

/** Consume `shares` FIFO from lots; returns the consumed slices. */
function consumeLots(
  lots: Lot[],
  shares: number
): { slices: ConsumedSlice[]; unmatchedShares: number } {
  const slices: ConsumedSlice[] = []
  let remaining = shares

  while (remaining > DUST && lots.length > 0) {
    const lot = lots[0]
    if (lot.shares <= remaining + DUST) {
      slices.push({
        lotDate: lot.date,
        shares: lot.shares,
        principalTokens: lot.principalTokens,
        usdBasis: lot.usdBasis,
      })
      remaining -= lot.shares
      lots.shift()
    } else {
      const fraction = remaining / lot.shares
      slices.push({
        lotDate: lot.date,
        shares: remaining,
        principalTokens: lot.principalTokens * fraction,
        usdBasis: lot.usdBasis * fraction,
      })
      lot.principalTokens *= 1 - fraction
      lot.usdBasis *= 1 - fraction
      lot.shares -= remaining
      remaining = 0
    }
  }

  return { slices, unmatchedShares: Math.max(0, remaining) }
}

/** Group consumed slices by holding period relative to the disposal date. */
function splitByHoldingPeriod(
  slices: ConsumedSlice[],
  disposalDate: string
): Array<{ holdingPeriod: 'short' | 'long'; slices: ConsumedSlice[] }> {
  const disposalMs = new Date(disposalDate).getTime()
  const short: ConsumedSlice[] = []
  const long: ConsumedSlice[] = []

  for (const slice of slices) {
    const heldMs = disposalMs - new Date(slice.lotDate).getTime()
    if (heldMs > LONG_TERM_MS) {
      long.push(slice)
    } else {
      short.push(slice)
    }
  }

  const groups: Array<{ holdingPeriod: 'short' | 'long'; slices: ConsumedSlice[] }> = []
  if (short.length > 0) groups.push({ holdingPeriod: 'short', slices: short })
  if (long.length > 0) groups.push({ holdingPeriod: 'long', slices: long })
  return groups
}

function acquiredLabel(slices: ConsumedSlice[]): string {
  const dates = [...new Set(slices.map((s) => dayOf(s.lotDate)))]
  return dates.length === 1 ? dates[0] : 'VARIOUS'
}

function emptySummary(): YearSummary {
  return {
    incomeUsd: 0,
    incomeBySource: { interest: 0, pool_emissions: 0, backstop_emissions: 0 },
    disposalProceedsUsd: 0,
    disposalCostBasisUsd: 0,
    disposalGainLossUsd: 0,
    shortTermGainLossUsd: 0,
    longTermGainLossUsd: 0,
    lossEventsUsd: 0,
    reimbursementsUsd: 0,
    interestPaidUsd: 0,
    netUsd: 0,
  }
}

export function computeGainsLossesLedger(input: EngineInput): GainsLossesLedger {
  const { userAddress, tokenMeta, priceAt, rateAt, todayDate } = input

  // Ascending chronological order; ledger_sequence breaks same-timestamp ties
  const actions = [...input.actions].sort((a, b) => {
    if (a.ledger_closed_at !== b.ledger_closed_at) {
      return a.ledger_closed_at < b.ledger_closed_at ? -1 : 1
    }
    return (a.ledger_sequence || 0) - (b.ledger_sequence || 0)
  })

  // Liquidation flows matched by (pool, timestamp, role); shifted as consumed
  const flowQueues = new Map<string, LiquidationFlow[]>()
  for (const flow of input.liquidationFlows) {
    const key = `${flow.pool_id}|${flow.ledger_closed_at}|${flow.role}`
    if (!flowQueues.has(key)) flowQueues.set(key, [])
    flowQueues.get(key)!.push(flow)
  }

  // Restaked backstop claims: tx hash -> LP tokens already lotted by the claim,
  // so the sibling deposit in the same tx is skipped up to that amount.
  const restakeAllowance = new Map<string, number>()
  for (const action of actions) {
    if (action.action_type === 'backstop_claim' && action.lp_tokens) {
      const lp = toUnits(action.lp_tokens, 7)
      restakeAllowance.set(
        action.transaction_hash,
        (restakeAllowance.get(action.transaction_hash) || 0) + lp
      )
    }
  }

  const supplyPositions = new Map<string, Position>()
  const debtPositions = new Map<string, Position>()
  const backstopPositions = new Map<string, Position>()

  const incomeByYear = new Map<number, IncomeRow[]>()
  const disposalsByYear = new Map<number, DisposalRow[]>()
  const lossEventsByYear = new Map<number, LossEventRow[]>()
  const interestPaidByYear = new Map<number, InterestPaidRow[]>()
  const notes = new Set<string>()
  let yieldBloxExposure = false

  function positionFor(
    map: Map<string, Position>,
    action: UserAction,
    assetAddress: string | null,
    fallbackSymbol: string
  ): Position {
    const key = `${action.pool_id}|${assetAddress ?? fallbackSymbol}`
    let position = map.get(key)
    if (!position) {
      const meta = assetAddress ? tokenMeta.get(assetAddress) : undefined
      position = {
        poolId: action.pool_id,
        poolName: action.pool_name,
        asset: meta?.symbol || fallbackSymbol,
        assetAddress,
        lots: [],
      }
      map.set(key, position)
    }
    return position
  }

  function pushRow<T>(map: Map<number, T[]>, year: number, row: T): void {
    if (!map.has(year)) map.set(year, [])
    map.get(year)!.push(row)
  }

  function processAction(action: UserAction): void {
    const date = action.ledger_closed_at
    const year = yearOf(date)
    const day = dayOf(date)
    if (action.pool_id === YIELDBLOX_POOL_ID) yieldBloxExposure = true

    switch (action.action_type) {
      case 'supply':
      case 'supply_collateral': {
        const decimals = action.asset_decimals ?? 7
        const underlying = toUnits(action.amount_underlying, decimals)
        const shares = toUnits(action.amount_tokens, decimals)
        if (shares <= DUST && underlying <= DUST) break
        const { price } = priceAt(action.asset_address, day)
        const position = positionFor(
          supplyPositions,
          action,
          action.asset_address,
          action.asset_symbol || 'Unknown'
        )
        position.lots.push({
          date,
          shares: shares > DUST ? shares : underlying,
          principalTokens: underlying,
          usdBasis: underlying * price,
        })
        break
      }

      case 'withdraw':
      case 'withdraw_collateral': {
        const decimals = action.asset_decimals ?? 7
        const received = toUnits(action.amount_underlying, decimals)
        const shares = toUnits(action.amount_tokens, decimals)
        if (shares <= DUST && received <= DUST) break
        const position = positionFor(
          supplyPositions,
          action,
          action.asset_address,
          action.asset_symbol || 'Unknown'
        )
        const { slices, unmatchedShares } = consumeLots(
          position.lots,
          shares > DUST ? shares : received
        )
        if (slices.length === 0) {
          notes.add(
            `A withdrawal of ${position.asset} predates the indexed deposit history; its interest portion could not be computed.`
          )
          break
        }
        if (unmatchedShares > 0.005 * (shares || 1)) {
          notes.add(
            `A ${position.asset} withdrawal consumed more shares than the indexed deposits cover; interest for that withdrawal is approximate.`
          )
        }
        const principalOut = sumBy(slices, (s) => s.principalTokens)
        const interest = received - principalOut
        const { price, source } = priceAt(action.asset_address, day)

        if (interest > DUST && interest * price >= MIN_USD) {
          pushRow(incomeByYear, year, {
            date,
            source: 'interest',
            poolId: action.pool_id,
            poolName: action.pool_name,
            asset: position.asset,
            assetAddress: action.asset_address,
            quantity: interest,
            priceUsd: price,
            valueUsd: interest * price,
            priceSource: source,
            txHash: action.transaction_hash,
          } satisfies IncomeRow)
        } else if (interest < -DUST && -interest * price >= MIN_USD) {
          pushRow(lossEventsByYear, year, {
            date,
            poolId: action.pool_id,
            poolName: action.pool_name,
            asset: position.asset,
            assetAddress: action.asset_address,
            principalTokens: principalOut,
            receivedTokens: received,
            lossTokens: -interest,
            priceUsd: price,
            lossUsd: -interest * price,
            priceSource: source,
            txHash: action.transaction_hash,
          } satisfies LossEventRow)
        }
        break
      }

      case 'borrow': {
        const decimals = action.asset_decimals ?? 7
        const underlying = toUnits(action.amount_underlying, decimals)
        const shares = toUnits(action.amount_tokens, decimals)
        if (shares <= DUST && underlying <= DUST) break
        const position = positionFor(
          debtPositions,
          action,
          action.asset_address,
          action.asset_symbol || 'Unknown'
        )
        position.lots.push({
          date,
          shares: shares > DUST ? shares : underlying,
          principalTokens: underlying,
          usdBasis: 0, // not meaningful for debt
        })
        break
      }

      case 'repay': {
        const decimals = action.asset_decimals ?? 7
        const repaid = toUnits(action.amount_underlying, decimals)
        const shares = toUnits(action.amount_tokens, decimals)
        if (shares <= DUST && repaid <= DUST) break
        const position = positionFor(
          debtPositions,
          action,
          action.asset_address,
          action.asset_symbol || 'Unknown'
        )
        const { slices } = consumeLots(position.lots, shares > DUST ? shares : repaid)
        const principalRepaid = sumBy(slices, (s) => s.principalTokens)
        const interest = repaid - principalRepaid
        const { price, source } = priceAt(action.asset_address, day)
        if (interest > DUST && interest * price >= MIN_USD) {
          pushRow(interestPaidByYear, year, {
            date,
            poolId: action.pool_id,
            poolName: action.pool_name,
            asset: position.asset,
            assetAddress: action.asset_address,
            interestTokens: interest,
            priceUsd: price,
            interestUsd: interest * price,
            priceSource: source,
            txHash: action.transaction_hash,
          } satisfies InterestPaidRow)
        }
        break
      }

      case 'claim': {
        const blnd = toUnits(action.claim_amount ?? action.amount_underlying, 7)
        if (blnd <= DUST) break
        const { price, source } = priceAt(BLND_TOKEN_ADDRESS, day)
        pushRow(incomeByYear, year, {
          date,
          source: 'pool_emissions',
          poolId: action.pool_id,
          poolName: action.pool_name,
          asset: 'BLND',
          assetAddress: BLND_TOKEN_ADDRESS,
          quantity: blnd,
          priceUsd: price,
          valueUsd: blnd * price,
          priceSource: source,
          txHash: action.transaction_hash,
        } satisfies IncomeRow)
        break
      }

      case 'backstop_claim': {
        const lp = toUnits(action.lp_tokens, 7)
        if (lp <= DUST) break
        const { price, source } = priceAt(LP_TOKEN_ADDRESS, day)
        pushRow(incomeByYear, year, {
          date,
          source: 'backstop_emissions',
          poolId: action.pool_id,
          poolName: action.pool_name,
          asset: 'BLND-USDC LP',
          assetAddress: LP_TOKEN_ADDRESS,
          quantity: lp,
          priceUsd: price,
          valueUsd: lp * price,
          priceSource: source,
          txHash: action.transaction_hash,
        } satisfies IncomeRow)
        // The claimed LP starts a new lot with basis = FMV at receipt
        const position = positionFor(backstopPositions, action, LP_TOKEN_ADDRESS, 'BLND-USDC LP')
        position.lots.push({ date, shares: lp, principalTokens: lp, usdBasis: lp * price })
        break
      }

      case 'backstop_deposit': {
        let lp = toUnits(action.lp_tokens, 7)
        if (lp <= DUST) break
        // Skip the portion that is a restaked claim (lot already created by the claim)
        const allowance = restakeAllowance.get(action.transaction_hash) || 0
        if (allowance > 0) {
          const covered = Math.min(allowance, lp)
          restakeAllowance.set(action.transaction_hash, allowance - covered)
          lp -= covered
        }
        if (lp <= DUST) break
        const { price } = priceAt(LP_TOKEN_ADDRESS, day)
        const position = positionFor(backstopPositions, action, LP_TOKEN_ADDRESS, 'BLND-USDC LP')
        position.lots.push({ date, shares: lp, principalTokens: lp, usdBasis: lp * price })
        break
      }

      case 'backstop_withdraw': {
        const lp = toUnits(action.lp_tokens, 7)
        if (lp <= DUST) break
        const position = positionFor(backstopPositions, action, LP_TOKEN_ADDRESS, 'BLND-USDC LP')
        const { slices, unmatchedShares } = consumeLots(position.lots, lp)
        if (slices.length === 0) {
          notes.add(
            'A backstop withdrawal predates the indexed deposit history; it was skipped in the gain/loss math.'
          )
          break
        }
        if (unmatchedShares > 0.005 * lp) {
          notes.add(
            'A backstop withdrawal consumed more LP than the indexed deposits cover; its gain/loss is approximate.'
          )
        }
        const { price, source } = priceAt(LP_TOKEN_ADDRESS, day)
        for (const group of splitByHoldingPeriod(slices, date)) {
          const groupShares = sumBy(group.slices, (s) => s.shares)
          const proceeds = groupShares * price
          const basis = sumBy(group.slices, (s) => s.usdBasis)
          if (proceeds < MIN_USD && basis < MIN_USD) continue
          pushRow(disposalsByYear, year, {
            date,
            kind: 'lp_withdrawal',
            poolId: action.pool_id,
            poolName: action.pool_name,
            asset: 'BLND-USDC LP',
            assetAddress: LP_TOKEN_ADDRESS,
            quantity: groupShares,
            dateAcquired: acquiredLabel(group.slices),
            holdingPeriod: group.holdingPeriod,
            proceedsUsd: proceeds,
            costBasisUsd: basis,
            gainLossUsd: proceeds - basis,
            priceSource: source,
            txHash: action.transaction_hash,
          } satisfies DisposalRow)
        }
        break
      }

      case 'backstop_queue_withdrawal':
      case 'backstop_dequeue_withdrawal':
        // Queuing has no economic effect; the LP stays owned until withdrawn
        break

      case 'fill_auction': {
        if (action.auction_type !== 0) {
          // Bad-debt / interest auctions are not modeled; surface for transparency
          notes.add(
            'An auction event other than a user liquidation was found and is not included in the gain/loss math.'
          )
          break
        }
        if (!action.lot_asset) break
        const lotShares = toUnits(action.lot_amount, 7)
        const bidShares = toUnits(action.bid_amount, 7)
        if (lotShares <= DUST) break
        const role = action.user_address === userAddress ? 'liquidated' : 'liquidator'
        const flowKey = `${action.pool_id}|${action.ledger_closed_at}|${role}`
        const flow = flowQueues.get(flowKey)?.shift()
        const lotMeta = tokenMeta.get(action.lot_asset)
        const lotSymbol = action.lot_asset_symbol || lotMeta?.symbol || 'Unknown'
        const bidPrice = priceAt(action.bid_asset, day)
        const debtReliefUsd = (flow?.bid_underlying ?? 0) * bidPrice.price

        if (role === 'liquidated') {
          const position = positionFor(supplyPositions, action, action.lot_asset, lotSymbol)
          const { slices } = consumeLots(position.lots, lotShares)
          if (slices.length === 0) {
            notes.add(
              'A liquidation predates the indexed deposit history; it was skipped in the gain/loss math.'
            )
            break
          }
          const totalShares = sumBy(slices, (s) => s.shares)
          for (const group of splitByHoldingPeriod(slices, date)) {
            const groupShares = sumBy(group.slices, (s) => s.shares)
            const shareFraction = totalShares > 0 ? groupShares / totalShares : 0
            const groupProceeds = debtReliefUsd * shareFraction
            const basis = sumBy(group.slices, (s) => s.usdBasis)
            if (groupProceeds < MIN_USD && basis < MIN_USD) continue
            pushRow(disposalsByYear, year, {
              date,
              kind: 'liquidation_collateral',
              poolId: action.pool_id,
              poolName: action.pool_name,
              asset: position.asset,
              assetAddress: action.lot_asset,
              quantity: (flow?.lot_underlying ?? sumBy(slices, (s) => s.principalTokens)) * shareFraction,
              dateAcquired: acquiredLabel(group.slices),
              holdingPeriod: group.holdingPeriod,
              proceedsUsd: groupProceeds,
              costBasisUsd: basis,
              gainLossUsd: groupProceeds - basis,
              priceSource: bidPrice.source,
              txHash: action.transaction_hash,
              note: 'Collateral liquidated against outstanding debt',
            } satisfies DisposalRow)
          }
          // The extinguished debt: remove dToken lots without an interest row
          if (action.bid_asset && bidShares > DUST) {
            const debtPosition = positionFor(
              debtPositions,
              action,
              action.bid_asset,
              action.bid_asset_symbol || 'Unknown'
            )
            consumeLots(debtPosition.lots, bidShares)
          }
        } else {
          // Liquidator: acquires the collateral, basis = debt assumed
          const position = positionFor(supplyPositions, action, action.lot_asset, lotSymbol)
          position.lots.push({
            date,
            shares: lotShares,
            principalTokens: flow?.lot_underlying ?? lotShares,
            usdBasis: debtReliefUsd,
          })
          // And assumes the debt
          if (action.bid_asset && bidShares > DUST) {
            const debtPosition = positionFor(
              debtPositions,
              action,
              action.bid_asset,
              action.bid_asset_symbol || 'Unknown'
            )
            debtPosition.lots.push({
              date,
              shares: bidShares,
              principalTokens: flow?.bid_underlying ?? bidShares,
              usdBasis: 0,
            })
          }
        }
        break
      }

      case 'new_auction':
      case 'delete_auction':
      case 'liquidate':
        break

      default:
        notes.add(`Events of type "${action.action_type}" are not included in the gain/loss math.`)
        break
    }
  }

  /** Value the current lot state as holdings at the given date. */
  function snapshotHoldings(atDate: string): HoldingRow[] {
    const holdings: HoldingRow[] = []

    for (const position of supplyPositions.values()) {
      const shares = sumBy(position.lots, (l) => l.shares)
      if (shares <= DUST) continue
      const rate = position.assetAddress
        ? rateAt(position.poolId, position.assetAddress, atDate)
        : null
      const quantity = shares * (rate?.bRate ?? 1)
      const { price, source } = priceAt(position.assetAddress, atDate)
      holdings.push({
        type: 'supply',
        poolId: position.poolId,
        poolName: position.poolName,
        asset: position.asset,
        assetAddress: position.assetAddress,
        quantity,
        priceUsd: price,
        valueUsd: quantity * price,
        priceSource: source,
        costBasisUsd: sumBy(position.lots, (l) => l.usdBasis),
        principalTokens: sumBy(position.lots, (l) => l.principalTokens),
      })
    }

    for (const position of debtPositions.values()) {
      const shares = sumBy(position.lots, (l) => l.shares)
      if (shares <= DUST) continue
      const rate = position.assetAddress
        ? rateAt(position.poolId, position.assetAddress, atDate)
        : null
      const quantity = shares * (rate?.dRate ?? 1)
      const { price, source } = priceAt(position.assetAddress, atDate)
      holdings.push({
        type: 'debt',
        poolId: position.poolId,
        poolName: position.poolName,
        asset: position.asset,
        assetAddress: position.assetAddress,
        quantity,
        priceUsd: price,
        valueUsd: quantity * price,
        priceSource: source,
        costBasisUsd: null,
        principalTokens: sumBy(position.lots, (l) => l.principalTokens),
      })
    }

    for (const position of backstopPositions.values()) {
      const shares = sumBy(position.lots, (l) => l.shares)
      if (shares <= DUST) continue
      const { price, source } = priceAt(LP_TOKEN_ADDRESS, atDate)
      holdings.push({
        type: 'backstop_lp',
        poolId: position.poolId,
        poolName: position.poolName,
        asset: 'BLND-USDC LP',
        assetAddress: LP_TOKEN_ADDRESS,
        quantity: shares,
        priceUsd: price,
        valueUsd: shares * price,
        priceSource: source,
        costBasisUsd: sumBy(position.lots, (l) => l.usdBasis),
        principalTokens: null,
      })
    }

    holdings.sort((a, b) => b.valueUsd - a.valueUsd)
    return holdings
  }

  // ============ Reimbursements (already priced by the builder) ============

  const reimbursementsByYear = new Map<number, ReimbursementRow[]>()
  for (const row of input.reimbursements ?? []) {
    pushRow(reimbursementsByYear, yearOf(row.date), row)
    if (row.relatedPoolId === YIELDBLOX_POOL_ID) yieldBloxExposure = true
  }

  // ============ Main pass: process by year, snapshot at each boundary ============

  const years = [
    ...new Set([
      ...actions.map((a) => yearOf(a.ledger_closed_at)),
      ...[...reimbursementsByYear.keys()],
    ]),
  ].sort((a, b) => a - b)
  const currentYear = parseInt(todayDate.slice(0, 4), 10)
  const holdingsByYear = new Map<number, HoldingRow[]>()

  let actionIndex = 0
  for (const year of years) {
    const boundary = `${year + 1}-01-01T00:00:00Z`
    while (actionIndex < actions.length && actions[actionIndex].ledger_closed_at < boundary) {
      processAction(actions[actionIndex])
      actionIndex++
    }
    const yearEndDate = year === currentYear ? todayDate : `${year}-12-31`
    holdingsByYear.set(year, snapshotHoldings(yearEndDate))
  }

  // ============ Assemble reports ============

  const reports: YearReport[] = years.map((year) => {
    const income = incomeByYear.get(year) || []
    const disposals = disposalsByYear.get(year) || []
    const lossEvents = lossEventsByYear.get(year) || []
    const reimbursements = reimbursementsByYear.get(year) || []
    const interestPaid = interestPaidByYear.get(year) || []

    const summary = emptySummary()
    for (const row of income) {
      summary.incomeUsd += row.valueUsd
      summary.incomeBySource[row.source] += row.valueUsd
    }
    for (const row of disposals) {
      summary.disposalProceedsUsd += row.proceedsUsd
      summary.disposalCostBasisUsd += row.costBasisUsd
      summary.disposalGainLossUsd += row.gainLossUsd
      if (row.holdingPeriod === 'short') {
        summary.shortTermGainLossUsd += row.gainLossUsd
      } else {
        summary.longTermGainLossUsd += row.gainLossUsd
      }
    }
    for (const row of lossEvents) {
      summary.lossEventsUsd += row.lossUsd
    }
    for (const row of reimbursements) {
      summary.reimbursementsUsd += row.valueUsd
    }
    for (const row of interestPaid) {
      summary.interestPaidUsd += row.interestUsd
    }
    summary.netUsd =
      summary.incomeUsd +
      summary.disposalGainLossUsd -
      summary.lossEventsUsd +
      summary.reimbursementsUsd

    return {
      year,
      summary,
      income,
      disposals,
      lossEvents,
      reimbursements,
      interestPaid,
      yearEndHoldings: holdingsByYear.get(year) || [],
      yearEndDate: year === currentYear ? todayDate : `${year}-12-31`,
    }
  })

  if (!yieldBloxExposure) {
    yieldBloxExposure = reports.some((r) =>
      r.yearEndHoldings.some((h) => h.poolId === YIELDBLOX_POOL_ID)
    )
  }

  return {
    years,
    reports,
    notes: [...notes],
    yieldBloxExposure,
  }
}
