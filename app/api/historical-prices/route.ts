import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db/config'

export interface HistoricalPriceResult {
  price: number
  source: 'daily_token_prices' | 'forward_fill'
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
 *
 * Returns prices for each token/date combination, forward-filling missing
 * dates. Dates with no price at all are omitted rather than echoed back with a
 * caller-supplied fallback: callers already substitute their own current price
 * for a missing entry, and requiring those prices here put this request behind
 * the wallet snapshot that produces them.
 *
 * A token with no prices at all still gets an (empty) entry, so callers can
 * tell "request succeeded" from "no data".
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

  if (!tokensParam || !datesParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: tokens and dates' },
      { status: 400 }
    )
  }

  const tokens = tokensParam.split(',').filter(Boolean)
  const dates = datesParam.split(',').filter(Boolean)

  if (tokens.length === 0 || dates.length === 0) {
    return NextResponse.json({ prices: {} } as HistoricalPricesResponse)
  }

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
            price: forwardFillPrice,
            source: 'forward_fill',
          }
        }
        // No price for this date: omitted, the caller falls back on its own.
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
