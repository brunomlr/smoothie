/**
 * Backstop Events with Prices API Route
 * Returns backstop deposit/withdrawal events with historical LP prices
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  optionalString,
  CACHE_CONFIGS,
  resolveWalletAddress,
} from '@/lib/api'
import { cacheKey, CACHE_TTL } from '@/lib/redis'

export interface BackstopEventWithPrice {
  date: string
  lpTokens: number
  shares: number // backstop shares burned/minted; LP amounts include share appreciation, shares don't
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

  redisCache: {
    ttl: CACHE_TTL.MEDIUM, // 5 minutes
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      // Support both single and multi-wallet cache keys
      const userKey = params.get('userAddresses') || params.get('userAddress') || ''
      return cacheKey(
        'backstop-events-prices',
        userKey,
        params.get('poolAddress') || 'all'
      )
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    // Support both single address and multiple addresses
    const userAddress = searchParams.get('userAddress')
    const userAddressesParam = searchParams.get('userAddresses')

    let userAddresses: string[] = []
    if (userAddressesParam) {
      userAddresses = userAddressesParam.split(',').map(a => a.trim()).filter(a => a.length > 0)
    } else if (userAddress) {
      userAddresses = [userAddress]
    }

    if (userAddresses.length === 0) {
      throw new Error('Missing required parameter: userAddress or userAddresses')
    }

    // Resolve demo wallet aliases to real addresses
    // Dedupe after alias resolution: the same wallet listed twice (or an alias
  // plus its resolved address) would double-count every event in the totals
  userAddresses = [...new Set(userAddresses.map(addr => resolveWalletAddress(addr)))]

    const sdkLpPrice = parseFloat(searchParams.get('sdkLpPrice') || '0') || 0
    const poolAddress = optionalString(searchParams, 'poolAddress')

    // Fetch backstop events for all addresses and combine
    const allEventsPromises = userAddresses.map(addr =>
      eventsRepository.getBackstopEventsWithPrices(addr, poolAddress, sdkLpPrice)
    )
    const allEventsArrays = await Promise.all(allEventsPromises)

    // Combine deposits and withdrawals from all wallets
    const combinedDeposits = allEventsArrays.flatMap(e => e.deposits)
    const combinedWithdrawals = allEventsArrays.flatMap(e => e.withdrawals)

    // Map to response format
    return {
      deposits: combinedDeposits.map(d => ({
        date: d.date,
        lpTokens: d.lpTokens,
        shares: d.shares,
        priceAtEvent: d.priceAtDeposit,
        usdValue: d.usdValue,
        poolAddress: d.poolAddress,
        priceSource: d.priceSource,
      })),
      withdrawals: combinedWithdrawals.map(w => ({
        date: w.date,
        lpTokens: w.lpTokens,
        shares: w.shares,
        priceAtEvent: w.priceAtWithdrawal,
        usdValue: w.usdValue,
        poolAddress: w.poolAddress,
        priceSource: w.priceSource,
      })),
    }
  },
})
