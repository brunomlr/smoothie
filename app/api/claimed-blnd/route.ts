import { NextRequest, NextResponse } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import { getAnalyticsUserIdFromRequest, captureServerEvent, hashWalletAddress } from '@/lib/analytics-server'

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userAddress = searchParams.get('user')
  const sdkBlndPrice = parseFloat(searchParams.get('sdkBlndPrice') || '0') || 0
  const analyticsUserId = getAnalyticsUserIdFromRequest(request)

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing user address parameter' },
      { status: 400 }
    )
  }

  try {
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

    // Capture server-side event with hashed wallet address for privacy
    const hashedAddress = hashWalletAddress(userAddress)
    captureServerEvent(analyticsUserId, {
      event: 'claimed_blnd_fetched',
      properties: {
        wallet_address_hash: hashedAddress,
        pool_claims_count: poolClaims.length,
        backstop_claims_count: backstopClaims.length,
      },
      $set: {
        last_wallet_address_hash: hashedAddress,
      },
    })

    return NextResponse.json({
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
    } as ClaimedBlndResponse)
  } catch (error) {
    console.error('[API claimed-blnd] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claimed BLND data' },
      { status: 500 }
    )
  }
}
