import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/config'

export interface HistoricalPriceResult {
  tokenAddress: string
  date: string
  price: number
  source: 'daily_token_prices' | 'forward_fill' | 'sdk_fallback'
}

export interface HistoricalPricesResponse {
  prices: Record<string, Record<string, HistoricalPriceResult>>  // tokenAddress -> date -> price
}

/**
 * GET /api/historical-prices
 *
 * Query params:
 * - tokens: comma-separated token addresses
 * - dates: comma-separated dates (YYYY-MM-DD)
 * - sdkPrices: comma-separated SDK prices (same order as tokens) for fallback
 *
 * Returns prices for each token/date combination.
 * Uses forward-fill for missing dates, SDK price as last resort.
 */
export async function GET(request: NextRequest) {
  if (!pool) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const tokensParam = searchParams.get('tokens')
  const datesParam = searchParams.get('dates')
  const sdkPricesParam = searchParams.get('sdkPrices')

  if (!tokensParam || !datesParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: tokens and dates' },
      { status: 400 }
    )
  }

  const tokens = tokensParam.split(',').filter(Boolean)
  const dates = datesParam.split(',').filter(Boolean)
  const sdkPrices = sdkPricesParam
    ? sdkPricesParam.split(',').map(p => parseFloat(p) || 0)
    : tokens.map(() => 0)

  // Build SDK price map for fallback
  const sdkPriceMap = new Map<string, number>()
  tokens.forEach((token, i) => {
    sdkPriceMap.set(token, sdkPrices[i] || 0)
  })

  try {
    // Query all available prices for these tokens up to maxDate (for forward-fill)
    const maxDate = dates.reduce((a, b) => a > b ? a : b)

    const result = await pool.query(
      `
      SELECT
        token_address,
        price_date::text,
        usd_price
      FROM daily_token_prices
      WHERE token_address = ANY($1)
        AND price_date <= $2::date
      ORDER BY token_address, price_date DESC
      `,
      [tokens, maxDate]
    )

    // Build a map of token -> date -> price from DB results
    const dbPrices = new Map<string, Map<string, number>>()
    for (const row of result.rows) {
      if (!dbPrices.has(row.token_address)) {
        dbPrices.set(row.token_address, new Map())
      }
      dbPrices.get(row.token_address)!.set(row.price_date, parseFloat(row.usd_price))
    }

    // Build response with forward-fill logic
    const prices: Record<string, Record<string, HistoricalPriceResult>> = {}

    for (const token of tokens) {
      prices[token] = {}
      const tokenPrices = dbPrices.get(token)

      for (const date of dates) {
        // Try exact match first
        if (tokenPrices?.has(date)) {
          prices[token][date] = {
            tokenAddress: token,
            date,
            price: tokenPrices.get(date)!,
            source: 'daily_token_prices',
          }
          continue
        }

        // Forward-fill: find most recent price before this date
        let forwardFillPrice: number | null = null

        if (tokenPrices) {
          // tokenPrices is ordered by date DESC, so first match <= date is our forward-fill
          for (const [priceDate, price] of tokenPrices) {
            if (priceDate <= date) {
              forwardFillPrice = price
              break
            }
          }
        }

        if (forwardFillPrice !== null) {
          prices[token][date] = {
            tokenAddress: token,
            date,
            price: forwardFillPrice,
            source: 'forward_fill',
          }
          continue
        }

        // Last resort: use SDK price
        const sdkPrice = sdkPriceMap.get(token) || 0
        prices[token][date] = {
          tokenAddress: token,
          date,
          price: sdkPrice,
          source: 'sdk_fallback',
        }
      }
    }

    return NextResponse.json({ prices } as HistoricalPricesResponse, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[Historical Prices API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch historical prices' },
      { status: 500 }
    )
  }
}
