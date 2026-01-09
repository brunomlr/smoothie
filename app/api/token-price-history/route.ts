/**
 * Token Price History API Route
 * Fetches daily token prices from the database for any given token
 */

import { NextRequest } from 'next/server'
import { pool } from '@/lib/db/config'
import {
  createApiHandler,
  optionalInt,
  requireString,
  CACHE_CONFIGS,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'

export interface TokenPriceDataPoint {
  date: string
  price: number
}

interface TokenPriceHistoryResponse {
  token_address: string
  days: number
  count: number
  history: TokenPriceDataPoint[]
}

export const GET = createApiHandler<TokenPriceHistoryResponse>({
  logPrefix: '[Token Price History API]',
  cache: CACHE_CONFIGS.LONG,

  redisCache: {
    ttl: CACHE_TTL.VERY_LONG, // 1 hour - historical data only changes once per day
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'token-price-history',
        params.get('token') || '',
        params.get('days') || '180',
        todayDate()
      )
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const tokenAddress = requireString(searchParams, 'token')
    const days = optionalInt(searchParams, 'days', 180, { min: 1 })

    if (!pool) {
      throw new Error('Database not configured')
    }

    // Query daily token prices with forward-fill for missing dates
    const result = await pool.query(
      `
      WITH date_range AS (
        SELECT generate_series(
          CURRENT_DATE - $1::integer,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      available_prices AS (
        SELECT
          price_date,
          usd_price
        FROM daily_token_prices
        WHERE token_address = $2
          AND price_date >= CURRENT_DATE - $1::integer
        ORDER BY price_date DESC
      )
      SELECT
        d.date::text as price_date,
        COALESCE(
          ap.usd_price,
          -- Forward-fill: use most recent price before this date
          (
            SELECT usd_price
            FROM daily_token_prices
            WHERE token_address = $2
              AND price_date <= d.date
            ORDER BY price_date DESC
            LIMIT 1
          )
        ) as price
      FROM date_range d
      LEFT JOIN available_prices ap ON ap.price_date = d.date
      WHERE d.date <= CURRENT_DATE
      ORDER BY d.date ASC
      `,
      [days, tokenAddress]
    )

    const history: TokenPriceDataPoint[] = result.rows
      .filter((row) => row.price !== null)
      .map((row) => ({
        date: row.price_date,
        price: parseFloat(row.price) || 0,
      }))

    return {
      token_address: tokenAddress,
      days,
      count: history.length,
      history,
    }
  },
})
