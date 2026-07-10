/**
 * Wallet transfers for the Gains & Losses tab.
 *
 * Lists XLM and BLND payments in/out of the wallet for a calendar year,
 * priced at daily historical prices. Display-only: these rows do NOT feed
 * the gain/loss math (an inbound payment could be income, a purchase or a
 * self-transfer — only the user can classify it).
 *
 * Scope (plan §2.4): XLM + BLND classic assets via Horizon. The backstop LP
 * token is a Soroban contract token and never appears in Horizon payment
 * operations; all meaningful LP flows are already covered by backstop events.
 * Transfers before PRICE_COVERAGE_START are omitted entirely.
 */

import { getHorizonServer } from '@/lib/stellar/horizon'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  BLND_CLASSIC_ISSUER,
  BLND_TOKEN_ADDRESS,
  PRICE_COVERAGE_START,
  XLM_TOKEN_ADDRESS,
} from '@/lib/config/blockchain'
import type { WalletTransferRow, WalletTransfersResponse } from './types'

const PAGE_SIZE = 200
const MAX_PAGES = 30
const XLM_DUST_THRESHOLD = 0.001 // matches the wallet-operations spam filter

interface RawTransfer {
  date: string
  direction: 'received' | 'sent'
  counterparty: string | null
  operationType: string
  assetAddress: string
  asset: string
  quantity: number
  txHash: string
}

interface HorizonPaymentRecord {
  type: string
  created_at: string
  transaction_hash: string
  // payment / path payment
  from?: string
  to?: string
  amount?: string
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  source_amount?: string
  source_asset_type?: string
  source_asset_code?: string
  source_asset_issuer?: string
  // create_account
  account?: string
  funder?: string
  starting_balance?: string
}

/** Resolve a classic asset to a tracked token address, or null if out of scope */
function trackedAsset(
  assetType?: string,
  assetCode?: string,
  assetIssuer?: string
): { address: string; symbol: string } | null {
  if (assetType === 'native') {
    return { address: XLM_TOKEN_ADDRESS, symbol: 'XLM' }
  }
  if (assetCode === 'BLND' && assetIssuer === BLND_CLASSIC_ISSUER) {
    return { address: BLND_TOKEN_ADDRESS, symbol: 'BLND' }
  }
  return null
}

function extractTransfers(record: HorizonPaymentRecord, userAddress: string): RawTransfer[] {
  const rows: RawTransfer[] = []

  switch (record.type) {
    case 'payment': {
      const asset = trackedAsset(record.asset_type, record.asset_code, record.asset_issuer)
      if (!asset || !record.amount) break
      const received = record.to === userAddress
      rows.push({
        date: record.created_at,
        direction: received ? 'received' : 'sent',
        counterparty: (received ? record.from : record.to) || null,
        operationType: 'payment',
        assetAddress: asset.address,
        asset: asset.symbol,
        quantity: parseFloat(record.amount),
        txHash: record.transaction_hash,
      })
      break
    }

    case 'path_payment_strict_send':
    case 'path_payment_strict_receive': {
      // The user may be on either leg (or both, for a self-swap)
      if (record.to === userAddress) {
        const asset = trackedAsset(record.asset_type, record.asset_code, record.asset_issuer)
        if (asset && record.amount) {
          rows.push({
            date: record.created_at,
            direction: 'received',
            counterparty: record.from || null,
            operationType: 'path payment',
            assetAddress: asset.address,
            asset: asset.symbol,
            quantity: parseFloat(record.amount),
            txHash: record.transaction_hash,
          })
        }
      }
      if (record.from === userAddress) {
        const asset = trackedAsset(
          record.source_asset_type,
          record.source_asset_code,
          record.source_asset_issuer
        )
        if (asset && record.source_amount) {
          rows.push({
            date: record.created_at,
            direction: 'sent',
            counterparty: record.to || null,
            operationType: 'path payment',
            assetAddress: asset.address,
            asset: asset.symbol,
            quantity: parseFloat(record.source_amount),
            txHash: record.transaction_hash,
          })
        }
      }
      break
    }

    case 'create_account': {
      if (!record.starting_balance) break
      const received = record.account === userAddress
      rows.push({
        date: record.created_at,
        direction: received ? 'received' : 'sent',
        counterparty: (received ? record.funder : record.account) || null,
        operationType: 'account funding',
        assetAddress: XLM_TOKEN_ADDRESS,
        asset: 'XLM',
        quantity: parseFloat(record.starting_balance),
        txHash: record.transaction_hash,
      })
      break
    }

    default:
      break
  }

  return rows.filter(
    (row) =>
      row.quantity > 0 && !(row.asset === 'XLM' && row.quantity < XLM_DUST_THRESHOLD)
  )
}

export async function fetchWalletTransfers(
  userAddress: string,
  year: number
): Promise<WalletTransfersResponse> {
  const yearStart = `${year}-01-01T00:00:00Z`
  const yearEnd = `${year + 1}-01-01T00:00:00Z`
  // Nothing is priced before coverage; older transfers are omitted (plan §2.4)
  const floor = `${PRICE_COVERAGE_START}T00:00:00Z`
  const effectiveStart = yearStart > floor ? yearStart : floor

  const server = getHorizonServer()
  const raw: RawTransfer[] = []
  let truncated = false
  let cursor: string | undefined
  let reachedStart = false

  for (let page = 0; page < MAX_PAGES && !reachedStart; page++) {
    let query = server.payments().forAccount(userAddress).order('desc').limit(PAGE_SIZE)
    if (cursor) query = query.cursor(cursor)

    let response
    try {
      response = await query.call()
    } catch (error) {
      // Unfunded/unknown accounts have no payment history
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return { year, transfers: [], truncated: false }
      }
      throw error
    }

    const records = response.records as unknown as (HorizonPaymentRecord & {
      paging_token: string
    })[]
    if (records.length === 0) break

    for (const record of records) {
      if (record.created_at < effectiveStart) {
        reachedStart = true
        break
      }
      if (record.created_at >= yearEnd) continue
      raw.push(...extractTransfers(record, userAddress))
    }

    cursor = records[records.length - 1].paging_token
    if (records.length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1 && !reachedStart) truncated = true
  }

  if (raw.length === 0) {
    return { year, transfers: [], truncated }
  }

  // Price all rows in one batch (coverage is complete for XLM/BLND from 2025-04-15)
  const priceMap = await eventsRepository.getHistoricalPricesForMultipleTokensAndDates(
    [...new Set(raw.map((r) => `${r.assetAddress}|${r.date.slice(0, 10)}`))].map((key) => {
      const [tokenAddress, targetDate] = key.split('|')
      return { tokenAddress, targetDate }
    }),
    new Map()
  )

  const transfers: WalletTransferRow[] = raw.map((row) => {
    const priced = priceMap.get(row.assetAddress)?.get(row.date.slice(0, 10))
    const price = priced?.price ?? 0
    return {
      date: row.date,
      direction: row.direction,
      counterparty: row.counterparty,
      operationType: row.operationType,
      asset: row.asset,
      assetAddress: row.assetAddress,
      quantity: row.quantity,
      priceUsd: price,
      valueUsd: row.quantity * price,
      priceSource: priced?.source ?? 'sdk_fallback',
      txHash: row.txHash,
    }
  })

  return { year, transfers, truncated }
}
