/**
 * Incident-remediation payment detection for the Gains & Losses report.
 *
 * Scans the wallet's Horizon payment history for payments matching a known
 * remediation distribution (REMEDIATION_DISTRIBUTIONS): the sender AND the
 * transaction memo must both match, so spam payments carrying a copied memo
 * cannot spoof a reimbursement row.
 *
 * Returned rows are unpriced; the report builder prices them via
 * daily_token_prices like every other row.
 */

import { getHorizonServer } from '@/lib/stellar/horizon'
import {
  PRICE_COVERAGE_START,
  REMEDIATION_DISTRIBUTIONS,
} from '@/lib/config/blockchain'

const PAGE_SIZE = 200
const MAX_PAGES = 40

export interface RawRemediationPayment {
  date: string // ISO timestamp
  label: string
  relatedPoolId: string
  assetCode: string
  tokenAddress: string
  quantity: number
  txHash: string
  from: string
}

interface HorizonPaymentWithTx {
  type: string
  created_at: string
  transaction_hash: string
  paging_token: string
  from?: string
  to?: string
  amount?: string
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  transaction_attr?: { memo?: string; memo_type?: string }
}

export async function fetchRemediationPayments(
  userAddress: string
): Promise<{ payments: RawRemediationPayment[]; truncated: boolean }> {
  const floor = `${PRICE_COVERAGE_START}T00:00:00Z`
  const server = getHorizonServer()
  const payments: RawRemediationPayment[] = []
  let truncated = false
  let cursor: string | undefined
  let reachedFloor = false

  for (let page = 0; page < MAX_PAGES && !reachedFloor; page++) {
    let query = server
      .payments()
      .forAccount(userAddress)
      .join('transactions')
      .order('desc')
      .limit(PAGE_SIZE)
    if (cursor) query = query.cursor(cursor)

    let response
    try {
      response = await query.call()
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return { payments: [], truncated: false }
      }
      throw error
    }

    const records = response.records as unknown as HorizonPaymentWithTx[]
    if (records.length === 0) break

    for (const record of records) {
      if (record.created_at < floor) {
        reachedFloor = true
        break
      }
      if (record.type !== 'payment' || record.to !== userAddress || !record.amount) continue

      const distribution = REMEDIATION_DISTRIBUTIONS.find(
        (d) =>
          record.from === d.sender &&
          record.transaction_attr?.memo === d.memo &&
          record.asset_code === d.assetCode &&
          record.asset_issuer === d.assetIssuer
      )
      if (!distribution) continue

      payments.push({
        date: record.created_at,
        label: distribution.label,
        relatedPoolId: distribution.relatedPoolId,
        assetCode: distribution.assetCode,
        tokenAddress: distribution.tokenAddress,
        quantity: parseFloat(record.amount),
        txHash: record.transaction_hash,
        from: record.from!,
      })
    }

    cursor = records[records.length - 1].paging_token
    if (records.length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1 && !reachedFloor) truncated = true
  }

  return { payments, truncated }
}
