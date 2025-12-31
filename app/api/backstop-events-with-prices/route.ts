/**
 * Backstop Events with Prices API Route
 * Returns backstop deposit/withdrawal events with historical LP prices
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
  optionalString,
  CACHE_CONFIGS,
} from '@/lib/api'

export interface BackstopEventWithPrice {
  date: string
  lpTokens: number
  priceAtEvent: number
  usdValue: number
  poolAddress: string
  priceSource: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
}

export interface BackstopEventsWithPricesResponse {
  deposits: BackstopEventWithPrice[]
  withdrawals: BackstopEventWithPrice[]
}

export const GET = createApiHandler<BackstopEventsWithPricesResponse>({
  logPrefix: '[API backstop-events-with-prices]',
  cache: CACHE_CONFIGS.SHORT,

  async handler(_request: NextRequest, { searchParams }) {
    const userAddress = requireString(searchParams, 'userAddress')
    const sdkLpPrice = parseFloat(searchParams.get('sdkLpPrice') || '0') || 0
    const poolAddress = optionalString(searchParams, 'poolAddress')

    const { deposits, withdrawals } = await eventsRepository.getBackstopEventsWithPrices(
      userAddress,
      poolAddress,
      sdkLpPrice
    )

    // Map to response format
    return {
      deposits: deposits.map(d => ({
        date: d.date,
        lpTokens: d.lpTokens,
        priceAtEvent: d.priceAtDeposit,
        usdValue: d.usdValue,
        poolAddress: d.poolAddress,
        priceSource: d.priceSource,
      })),
      withdrawals: withdrawals.map(w => ({
        date: w.date,
        lpTokens: w.lpTokens,
        priceAtEvent: w.priceAtWithdrawal,
        usdValue: w.usdValue,
        poolAddress: w.poolAddress,
        priceSource: w.priceSource,
      })),
    }
  },
})
