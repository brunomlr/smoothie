/**
 * API Handler Factory
 *
 * Creates standardized API route handlers with:
 * - Consistent error handling
 * - Parameter validation
 * - Caching configuration (HTTP and Redis)
 * - Analytics integration (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { jsonResponse, errorResponse, CacheConfig } from './responses'
import {
  getAnalyticsUserIdFromRequest,
  captureServerEvent,
  hashWalletAddress,
} from '@/lib/analytics-server'
import { getOrSet } from '@/lib/redis'

export interface RedisCacheConfig {
  /** TTL in seconds */
  ttl: number
  /** Function to generate cache key from request */
  getKey: (request: NextRequest) => string
}

export interface ApiHandlerConfig<TResult> {
  /** Log prefix for error messages (e.g., '[User Actions API]') */
  logPrefix: string

  /** HTTP Cache configuration (Cache-Control headers) */
  cache?: CacheConfig | null

  /**
   * Redis cache configuration (optional)
   * If provided, results will be cached in Redis before handler execution
   */
  redisCache?: RedisCacheConfig

  /** The handler function that processes the request */
  handler: (
    request: NextRequest,
    context: HandlerContext
  ) => Promise<TResult>

  /**
   * Optional analytics configuration.
   * If provided, will capture an event after successful response.
   */
  analytics?: {
    /** Event name (e.g., 'user_actions_fetched') */
    event: string
    /** Function to build analytics properties from the result */
    getProperties?: (result: TResult, userAddress?: string) => Record<string, unknown>
    /** Function to get user address for hashing */
    getUserAddress?: (request: NextRequest) => string | undefined
  }
}

export interface HandlerContext {
  /** The request search params */
  searchParams: URLSearchParams
  /** Analytics user ID from request headers */
  analyticsUserId: string | null
}

/**
 * Create a GET API handler with standardized patterns
 *
 * @example
 * export const GET = createApiHandler({
 *   logPrefix: '[My API]',
 *   cache: CACHE_CONFIGS.MEDIUM,
 *   async handler(request, { searchParams }) {
 *     const user = requireString(searchParams, 'user')
 *     return await myService.getData(user)
 *   },
 * })
 */
export function createApiHandler<TResult>(
  config: ApiHandlerConfig<TResult>
): (request: NextRequest) => Promise<NextResponse> {
  const { logPrefix, cache = null, redisCache, handler, analytics } = config

  return async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams
      const analyticsUserId = getAnalyticsUserIdFromRequest(request)

      const context: HandlerContext = {
        searchParams,
        analyticsUserId,
      }

      // Execute handler with optional Redis caching
      let result: TResult
      if (redisCache) {
        const cacheKey = redisCache.getKey(request)
        result = await getOrSet(
          cacheKey,
          () => handler(request, context),
          { ttl: redisCache.ttl }
        )
      } else {
        result = await handler(request, context)
      }

      // Capture analytics if configured
      if (analytics) {
        const userAddress = analytics.getUserAddress?.(request)
        const hashedAddress = userAddress ? hashWalletAddress(userAddress) : undefined

        const properties = analytics.getProperties?.(result, userAddress) ?? {}

        captureServerEvent(analyticsUserId, {
          event: analytics.event,
          properties: {
            ...properties,
            ...(hashedAddress && { wallet_address_hash: hashedAddress }),
          },
          ...(hashedAddress && {
            $set: {
              last_wallet_address_hash: hashedAddress,
            },
          }),
        })
      }

      return jsonResponse(result, cache)
    } catch (error) {
      return errorResponse(error, logPrefix)
    }
  }
}

/**
 * Create a POST API handler with standardized patterns
 */
export function createPostApiHandler<TResult>(
  config: ApiHandlerConfig<TResult>
): (request: NextRequest) => Promise<NextResponse> {
  const { logPrefix, cache = null, handler, analytics } = config

  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams
      const analyticsUserId = getAnalyticsUserIdFromRequest(request)

      const context: HandlerContext = {
        searchParams,
        analyticsUserId,
      }

      const result = await handler(request, context)

      // Capture analytics if configured
      if (analytics) {
        const userAddress = analytics.getUserAddress?.(request)
        const hashedAddress = userAddress ? hashWalletAddress(userAddress) : undefined

        const properties = analytics.getProperties?.(result, userAddress) ?? {}

        captureServerEvent(analyticsUserId, {
          event: analytics.event,
          properties: {
            ...properties,
            ...(hashedAddress && { wallet_address_hash: hashedAddress }),
          },
          ...(hashedAddress && {
            $set: {
              last_wallet_address_hash: hashedAddress,
            },
          }),
        })
      }

      return jsonResponse(result, cache)
    } catch (error) {
      return errorResponse(error, logPrefix)
    }
  }
}
