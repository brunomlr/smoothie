/**
 * Claimed BLND API Route
 * Fetches BLND claims with historical pricing data
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
} from '@/lib/api'

export interface BlndClaimWithPrice {
  date: string
  blndAmount: number
  priceAtClaim: number
  usdValueAtClaim: number
  poolId: string
  priceSource: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
}

export interface ClaimedBlndResponse {
  pool_claims: Array<{ pool_id: string; total_claimed_blnd: number }>
  backstop_claims: Array<{ pool_address: string; total_claimed_lp: number }>
  // Historical pricing data for pool claims
  pool_claims_with_prices?: BlndClaimWithPrice[]
  // Totals calculated with historical prices
  total_claimed_blnd_usd_historical?: number
}

export const GET = createApiHandler<ClaimedBlndResponse>({
  logPrefix: '[API claimed-blnd]',
  cache: null, // No caching for this endpoint

  analytics: {
    event: 'claimed_blnd_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result) => ({
      pool_claims_count: result.pool_claims.length,
      backstop_claims_count: result.backstop_claims.length,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const userAddress = requireString(searchParams, 'user')
    const sdkBlndPrice = parseFloat(searchParams.get('sdkBlndPrice') || '0') || 0

    // Fetch pool claims, backstop claims, and historical pricing in parallel
    const [poolClaims, backstopClaims, poolClaimsWithPrices] = await Promise.all([
      eventsRepository.getClaimedBlndFromPools(userAddress),
      eventsRepository.getClaimedEmissionsPerPool(userAddress),
      eventsRepository.getBlndClaimsWithPrices(userAddress, sdkBlndPrice),
    ])

    // Calculate total USD value at historical prices
    const totalClaimedBlndUsdHistorical = poolClaimsWithPrices.reduce(
      (sum, claim) => sum + claim.usdValueAtClaim,
      0
    )

    return {
      // BLND claimed from supply/borrow positions (actual BLND tokens)
      pool_claims: poolClaims,
      // LP tokens received from claiming backstop emissions
      // These auto-compound to LP, so we return the LP amount
      // To convert to BLND, multiply by blndPerLpToken from the SDK
      backstop_claims: backstopClaims,
      // Historical pricing data for pool claims
      pool_claims_with_prices: poolClaimsWithPrices,
      // Total USD value at historical prices
      total_claimed_blnd_usd_historical: totalClaimedBlndUsdHistorical,
    }
  },
})
