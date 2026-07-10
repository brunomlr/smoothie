/**
 * Gains & Losses Export API Route
 * Generates the CSV download for the Activity "Gains & Losses" tab.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveWalletAddress, isDemoWalletParam, generatePlaceholderHash } from '@/lib/api'
import { buildGainsLossesReport } from '@/lib/reports/build-report'
import { fetchWalletTransfers } from '@/lib/reports/wallet-transfers'
import {
  generateGainsLossesCSV,
  getGainsLossesExportFilename,
  type GainsLossesCsvSection,
} from '@/lib/export/gains-losses-csv'
import type { WalletTransferRow } from '@/lib/reports/types'

const VALID_SECTIONS: GainsLossesCsvSection[] = ['all', 'income', 'disposals', 'interest_paid', 'holdings', 'transfers']

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user = searchParams.get('user')
    const yearParam = searchParams.get('year')
    const sectionParam = (searchParams.get('section') || 'all') as GainsLossesCsvSection

    if (!user) {
      return NextResponse.json(
        { error: 'Missing required parameter', message: 'user parameter is required' },
        { status: 400 },
      )
    }
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      return NextResponse.json(
        { error: 'Missing required parameter', message: 'year parameter is required (YYYY)' },
        { status: 400 },
      )
    }
    const section = VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'all'
    const year = parseInt(yearParam, 10)
    const isDemo = isDemoWalletParam(user)
    const resolvedUser = resolveWalletAddress(user)

    const needsTransfers = section === 'all' || section === 'transfers'
    const [ledger, transfersResult] = await Promise.all([
      buildGainsLossesReport(resolvedUser),
      needsTransfers
        ? fetchWalletTransfers(resolvedUser, year).catch((error) => {
            // Transfers are best-effort; the on-chain report must still export
            console.warn('[Export Gains Losses] transfers fetch failed:', error)
            return null
          })
        : Promise.resolve(null),
    ])

    const report = ledger.reports.find((r) => r.year === year)
    if (!report) {
      return NextResponse.json(
        { error: 'No data', message: `No activity found for ${year}` },
        { status: 404 },
      )
    }

    let transfers: WalletTransferRow[] | null = transfersResult?.transfers ?? null

    if (isDemo) {
      const sanitize = <T extends { txHash: string }>(rows: T[]): T[] =>
        rows.map((row) => ({ ...row, txHash: generatePlaceholderHash(row.txHash) }))
      report.income = sanitize(report.income)
      report.disposals = sanitize(report.disposals)
      report.lossEvents = sanitize(report.lossEvents)
      report.reimbursements = sanitize(report.reimbursements)
      report.interestPaid = sanitize(report.interestPaid)
      transfers = transfers ? sanitize(transfers) : null
    }

    const csv = generateGainsLossesCSV(report, transfers, section)
    const filename = getGainsLossesExportFilename(user, year)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[Export Gains Losses API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
