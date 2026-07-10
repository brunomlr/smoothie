/**
 * Wallet Transfers Report API Route
 * XLM/BLND payments in/out of the wallet for a calendar year, priced at
 * daily historical prices. Display-only section of the Gains & Losses tab.
 */

import { NextRequest } from 'next/server'
import {
  createApiHandler,
  requireString,
  requireInt,
  CACHE_CONFIGS,
  resolveWalletAddress,
  isDemoWalletParam,
  generatePlaceholderHash,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'
import { fetchWalletTransfers } from '@/lib/reports/wallet-transfers'
import type { WalletTransfersResponse } from '@/lib/reports/types'

export const GET = createApiHandler<WalletTransfersResponse>({
  logPrefix: '[Wallet Transfers Report API]',
  cache: CACHE_CONFIGS.SHORT,

  redisCache: {
    ttl: CACHE_TTL.MEDIUM,
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'wallet-transfers-report',
        params.get('user') || '',
        params.get('year') || '',
        todayDate()
      )
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const userParam = requireString(searchParams, 'user')
    const isDemo = isDemoWalletParam(userParam)
    const user = resolveWalletAddress(userParam)
    const year = requireInt(searchParams, 'year', { min: 2015, max: 2100 })

    const result = await fetchWalletTransfers(user, year)

    if (isDemo) {
      return {
        ...result,
        transfers: result.transfers.map((t) => ({
          ...t,
          txHash: generatePlaceholderHash(t.txHash),
          counterparty: t.counterparty ? `${t.counterparty.slice(0, 4)}…` : null,
        })),
      }
    }

    return result
  },
})
