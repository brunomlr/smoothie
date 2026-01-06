/**
 * Prices API Route
 * Returns current USD prices for tokens
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  parseList,
  CACHE_CONFIGS,
} from '@/lib/api'
import { cacheKey, CACHE_TTL } from '@/lib/redis'

// Price data types
interface TokenPrice {
  assetAddress: string
  symbol: string
  usd: number
  source: 'coingecko' | 'mock'
  timestamp: number
}

interface PricesResponse {
  prices: Record<string, TokenPrice>
}

// Mock prices (same as pricing service)
const MOCK_PRICES: Record<string, number> = {
  USDC: 1,
  XLM: 0.12,
  AQUA: 0.004,
  BLND: 0.25,
}

export const GET = createApiHandler<PricesResponse>({
  logPrefix: '[Prices API]',
  cache: CACHE_CONFIGS.MEDIUM,

  redisCache: {
    ttl: CACHE_TTL.SHORT, // 1 minute - prices update frequently
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      const assets = params.get('assets') || 'all'
      return cacheKey('prices', assets)
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const requestedAssets = parseList(searchParams, 'assets')

    // Get all tokens from database
    const allTokens = await eventsRepository.getTokens()

    // Filter tokens if specific assets requested
    let tokens = allTokens
    if (requestedAssets) {
      tokens = allTokens.filter(
        (t) => requestedAssets.includes(t.asset_address) || requestedAssets.includes(t.symbol)
      )
    }

    const prices: Record<string, TokenPrice> = {}
    const timestamp = Date.now()

    for (const token of tokens) {
      const price = MOCK_PRICES[token.symbol.toUpperCase()] || 0
      prices[token.asset_address] = {
        assetAddress: token.asset_address,
        symbol: token.symbol,
        usd: price,
        source: 'mock',
        timestamp,
      }
    }

    return { prices }
  },
})
