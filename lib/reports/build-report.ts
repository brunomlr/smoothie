/**
 * Server-side builder for the Gains & Losses report.
 * Fetches the event stream, prices and rates, then runs the pure engine.
 * Shared by /api/reports/gains-losses and /api/export/gains-losses.
 */

import { eventsRepository } from '@/lib/db/events-repository'
import { BLND_TOKEN_ADDRESS, LP_TOKEN_ADDRESS } from '@/lib/config/blockchain'
import { getToday } from '@/lib/date-utils'
import type { UserAction } from '@/lib/db/types'
import { computeGainsLossesLedger, type TokenMeta } from './gains-losses-engine'
import { fetchRemediationPayments, type RawRemediationPayment } from './remediation'
import type { GainsLossesLedger, PriceSource, ReimbursementRow } from './types'

const EXPORT_EVENT_LIMIT = 10000

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10)
}

/** Token addresses whose price matters for a given action */
function tokensForAction(action: UserAction): string[] {
  switch (action.action_type) {
    case 'claim':
      return [BLND_TOKEN_ADDRESS]
    case 'backstop_claim':
    case 'backstop_deposit':
    case 'backstop_withdraw':
      return [LP_TOKEN_ADDRESS]
    case 'fill_auction':
      return [action.lot_asset, action.bid_asset].filter((a): a is string => !!a)
    default:
      return action.asset_address ? [action.asset_address] : []
  }
}

export async function buildGainsLossesReport(userAddress: string): Promise<GainsLossesLedger> {
  const todayDate = getToday('UTC')

  // Remediation detection is best-effort: a Horizon outage must not block the report
  let remediationFailed = false
  const [actions, liquidationFlows, tokens, remediation] = await Promise.all([
    eventsRepository.getUserActions(userAddress, { limit: EXPORT_EVENT_LIMIT }),
    eventsRepository.getLiquidationFlows(userAddress),
    eventsRepository.getTokens(),
    fetchRemediationPayments(userAddress).catch((error) => {
      console.warn('[Gains/Losses] remediation payment scan failed:', error)
      remediationFailed = true
      return { payments: [] as RawRemediationPayment[], truncated: false }
    }),
  ])

  if (actions.length >= EXPORT_EVENT_LIMIT) {
    console.warn(
      `[Gains/Losses] ${userAddress} hit the ${EXPORT_EVENT_LIMIT}-event limit; report may be incomplete`
    )
  }

  const tokenMeta = new Map<string, TokenMeta>(
    tokens.map((t) => [t.asset_address, { symbol: t.symbol, decimals: t.decimals }])
  )

  // ---- Collect every (token, date) pair the engine will ask for ----
  const priceRequests = new Set<string>() // `${token}|${date}`
  const allTokens = new Set<string>()
  const years = new Set<number>()

  for (const action of actions) {
    const day = dayOf(action.ledger_closed_at)
    years.add(parseInt(day.slice(0, 4), 10))
    for (const token of tokensForAction(action)) {
      priceRequests.add(`${token}|${day}`)
      allTokens.add(token)
    }
  }

  for (const payment of remediation.payments) {
    const day = dayOf(payment.date)
    years.add(parseInt(day.slice(0, 4), 10))
    priceRequests.add(`${payment.tokenAddress}|${day}`)
    allTokens.add(payment.tokenAddress)
  }

  // Year-end valuations: every seen token at every year boundary
  const currentYear = parseInt(todayDate.slice(0, 4), 10)
  const yearEndDates = [...years].map((year) =>
    year === currentYear ? todayDate : `${year}-12-31`
  )
  for (const token of allTokens) {
    for (const date of yearEndDates) {
      priceRequests.add(`${token}|${date}`)
    }
  }

  const priceMap = await eventsRepository.getHistoricalPricesForMultipleTokensAndDates(
    [...priceRequests].map((key) => {
      const [tokenAddress, targetDate] = key.split('|')
      return { tokenAddress, targetDate }
    }),
    new Map() // no SDK fallback server-side; missing prices are flagged instead
  )

  // Rates for year-end holdings valuation (supply and debt positions)
  const ratePairs: Array<{ poolId: string; assetAddress: string }> = []
  for (const action of actions) {
    if (
      ['supply', 'supply_collateral', 'withdraw', 'withdraw_collateral', 'borrow', 'repay'].includes(
        action.action_type
      ) &&
      action.asset_address
    ) {
      ratePairs.push({ poolId: action.pool_id, assetAddress: action.asset_address })
    }
    if (action.action_type === 'fill_auction') {
      if (action.lot_asset) ratePairs.push({ poolId: action.pool_id, assetAddress: action.lot_asset })
      if (action.bid_asset) ratePairs.push({ poolId: action.pool_id, assetAddress: action.bid_asset })
    }
  }
  const rateMap = await eventsRepository.getRatesAtDates(ratePairs, yearEndDates)

  const fallback: { price: number; source: PriceSource } = { price: 0, source: 'sdk_fallback' }
  const priceAt = (tokenAddress: string | null, date: string) => {
    if (!tokenAddress) return fallback
    return priceMap.get(tokenAddress)?.get(date) ?? fallback
  }

  const reimbursements: ReimbursementRow[] = remediation.payments.map((payment) => {
    const { price, source } = priceAt(payment.tokenAddress, dayOf(payment.date))
    return {
      date: payment.date,
      label: payment.label,
      relatedPoolId: payment.relatedPoolId,
      asset: payment.assetCode,
      assetAddress: payment.tokenAddress,
      quantity: payment.quantity,
      priceUsd: price,
      valueUsd: payment.quantity * price,
      priceSource: source,
      txHash: payment.txHash,
      from: payment.from,
    }
  })

  const ledger = computeGainsLossesLedger({
    userAddress,
    actions,
    liquidationFlows,
    reimbursements,
    tokenMeta,
    priceAt,
    rateAt: (poolId, assetAddress, date) =>
      rateMap.get(`${poolId}|${assetAddress}|${date}`) ?? null,
    todayDate,
  })

  if (remediationFailed) {
    ledger.notes.push(
      'Remediation payments could not be checked (wallet history unavailable); reimbursement rows may be missing.'
    )
  }
  if (remediation.truncated) {
    ledger.notes.push(
      'This wallet has a very large payment history; older remediation payments may be missing.'
    )
  }

  return ledger
}
