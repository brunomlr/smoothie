/**
 * Gains & Losses Report API Route
 * Computes the FIFO lot-ledger report for the Activity "Gains & Losses" tab.
 * See plan/activity-gains-losses-tab.md.
 */

import { NextRequest } from 'next/server'
import {
  createApiHandler,
  requireString,
  optionalInt,
  CACHE_CONFIGS,
  resolveWalletAddress,
  isDemoWalletParam,
  generatePlaceholderHash,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'
import { buildGainsLossesReport } from '@/lib/reports/build-report'
import type { YearReport } from '@/lib/reports/types'

export interface GainsLossesResponse {
  user_address: string
  years: number[]
  report: YearReport | null
  notes: string[]
  yieldBloxExposure: boolean
}

export const GET = createApiHandler<GainsLossesResponse>({
  logPrefix: '[Gains Losses API]',
  cache: CACHE_CONFIGS.SHORT,

  redisCache: {
    ttl: CACHE_TTL.MEDIUM, // the full ledger recomputes on any request; 5 min matches user-actions
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'gains-losses',
        params.get('user') || '',
        params.get('year') || '',
        todayDate() // Rotate cache daily for new actions
      )
    },
  },

  analytics: {
    event: 'gains_losses_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result) => ({
      year: result.report?.year,
      income_rows: result.report?.income.length ?? 0,
      disposal_rows: result.report?.disposals.length ?? 0,
      loss_events: result.report?.lossEvents.length ?? 0,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const userParam = requireString(searchParams, 'user')
    const isDemo = isDemoWalletParam(userParam)
    const user = resolveWalletAddress(userParam)
    const requestedYear = optionalInt(searchParams, 'year', 0)

    const ledger = await buildGainsLossesReport(user)

    // Default to the most recent year with events (usually the current year)
    const year =
      requestedYear && ledger.years.includes(requestedYear)
        ? requestedYear
        : ledger.years[ledger.years.length - 1]

    let report = ledger.reports.find((r) => r.year === year) ?? null

    // For demo wallets, replace transaction hashes with deterministic placeholders
    if (report && isDemo) {
      const sanitize = <T extends { txHash: string }>(rows: T[]): T[] =>
        rows.map((row) => ({ ...row, txHash: generatePlaceholderHash(row.txHash) }))
      report = {
        ...report,
        income: sanitize(report.income),
        disposals: sanitize(report.disposals),
        lossEvents: sanitize(report.lossEvents),
        reimbursements: sanitize(report.reimbursements),
        interestPaid: sanitize(report.interestPaid),
      }
    }

    return {
      user_address: user,
      years: ledger.years,
      report,
      notes: ledger.notes,
      yieldBloxExposure: ledger.yieldBloxExposure,
    }
  },
})
