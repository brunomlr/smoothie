/**
 * CSV generator for the Gains & Losses report.
 * One flat table with a Category column; disposal columns are shaped so the
 * rows map directly onto capital-gain filing forms (date acquired, proceeds,
 * cost basis, gain/loss, holding period) without naming any jurisdiction.
 */

import type { WalletTransferRow, YearReport } from '@/lib/reports/types'

const HEADERS = [
  'Category',
  'Date (UTC)',
  'Asset',
  'Quantity',
  'Date Acquired',
  'Proceeds (USD)',
  'Cost Basis (USD)',
  'Gain/Loss (USD)',
  'Holding Period',
  'Income (USD)',
  'Pool',
  'Type',
  'Tx Hash',
  'Price Source',
  'Notes',
]

export type GainsLossesCsvSection =
  | 'all'
  | 'income'
  | 'disposals'
  | 'interest_paid'
  | 'holdings'
  | 'transfers'

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Prevent CSV formula injection in spreadsheet apps.
  // Plain negative numbers (e.g. -0.11 in the Gain/Loss column) are NOT formulas
  // and must stay numeric.
  const isFormulaLike =
    /^\s*[=+@]/.test(str) || (/^\s*-/.test(str) && !/^\s*-(\d|\.)/.test(str))
  const safe = isFormulaLike ? `'${str}` : str
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

function usd(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toFixed(2)
}

function qty(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toFixed(7)
}

const INCOME_SOURCE_LABELS: Record<string, string> = {
  interest: 'Interest',
  pool_emissions: 'Pool emissions (BLND)',
  backstop_emissions: 'Backstop emissions (LP)',
}

const HOLDING_TYPE_LABELS: Record<string, string> = {
  supply: 'Supplied',
  debt: 'Borrowed (debt)',
  backstop_lp: 'Backstop LP',
}

const DISPOSAL_KIND_LABELS: Record<string, string> = {
  lp_withdrawal: 'LP withdrawal',
  liquidation_collateral: 'Liquidation',
}

export function generateGainsLossesCSV(
  report: YearReport,
  transfers: WalletTransferRow[] | null,
  section: GainsLossesCsvSection = 'all'
): string {
  const rows: (string | number | null | undefined)[][] = []

  const include = (name: GainsLossesCsvSection) => section === 'all' || section === name

  if (include('income')) {
    for (const row of report.income) {
      rows.push([
        'Income',
        row.date,
        row.asset,
        qty(row.quantity),
        '',
        '',
        '',
        '',
        '',
        usd(row.valueUsd),
        row.poolName || row.poolId || '',
        INCOME_SOURCE_LABELS[row.source] || row.source,
        row.txHash,
        row.priceSource,
        '',
      ])
    }
  }

  if (include('disposals')) {
    for (const row of report.disposals) {
      rows.push([
        'Disposal',
        row.date,
        row.asset,
        qty(row.quantity),
        row.dateAcquired,
        usd(row.proceedsUsd),
        usd(row.costBasisUsd),
        usd(row.gainLossUsd),
        row.holdingPeriod === 'long' ? 'Long term' : 'Short term',
        '',
        row.poolName || row.poolId || '',
        DISPOSAL_KIND_LABELS[row.kind] || row.kind,
        row.txHash,
        row.priceSource,
        row.note || '',
      ])
    }
    for (const row of report.lossEvents) {
      rows.push([
        'Loss event',
        row.date,
        row.asset,
        qty(row.lossTokens),
        '',
        usd(row.receivedTokens * row.priceUsd),
        usd(row.principalTokens * row.priceUsd),
        usd(-row.lossUsd),
        '',
        '',
        row.poolName || row.poolId || '',
        'Bad-debt socialization on withdrawal',
        row.txHash,
        row.priceSource,
        `Principal ${qty(row.principalTokens)}, received ${qty(row.receivedTokens)}`,
      ])
    }
    for (const row of report.reimbursements) {
      rows.push([
        'Reimbursement',
        row.date,
        row.asset,
        qty(row.quantity),
        '',
        '',
        '',
        usd(row.valueUsd),
        '',
        '',
        '',
        row.label,
        row.txHash,
        row.priceSource,
        `Offsets incident loss events; from ${row.from}`,
      ])
    }
  }

  if (include('interest_paid')) {
    for (const row of report.interestPaid) {
      rows.push([
        'Interest paid',
        row.date,
        row.asset,
        qty(row.interestTokens),
        '',
        '',
        '',
        '',
        '',
        usd(-row.interestUsd),
        row.poolName || row.poolId || '',
        'Interest portion of repayment',
        row.txHash,
        row.priceSource,
        '',
      ])
    }
  }

  if (include('holdings')) {
    for (const row of report.yearEndHoldings) {
      rows.push([
        'Year-end holding',
        report.yearEndDate,
        row.asset,
        qty(row.quantity),
        '',
        '',
        row.costBasisUsd !== null ? usd(row.costBasisUsd) : '',
        '',
        '',
        '',
        row.poolName || row.poolId || '',
        HOLDING_TYPE_LABELS[row.type] || row.type,
        '',
        row.priceSource,
        `Value ${usd(row.valueUsd)} USD at ${usd(row.priceUsd)}/token`,
      ])
    }
  }

  if (include('transfers') && transfers) {
    for (const row of transfers) {
      rows.push([
        'Wallet transfer',
        row.date,
        row.asset,
        qty(row.quantity),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        row.direction === 'received'
          ? 'Received — classify as income, purchase or self-transfer'
          : 'Sent — potential disposal',
        row.txHash,
        row.priceSource,
        `Est. value ${usd(row.valueUsd)} USD; counterparty ${row.counterparty || 'unknown'}`,
      ])
    }
  }

  const csvRows = [HEADERS, ...rows].map((row) => row.map(escapeCSV).join(','))
  return csvRows.join('\n')
}

export function getGainsLossesExportFilename(userAddress: string, year: number): string {
  return `gains-losses_${userAddress.slice(0, 8)}_${year}.csv`
}
