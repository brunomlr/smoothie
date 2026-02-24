/**
 * Standard API Response Utilities
 */

import { NextResponse } from 'next/server'
import { isApiError } from './errors'

export interface ApiErrorResponse {
  error: string
  message: string
  code?: string
}

export interface CacheConfig {
  /** Cache duration in seconds */
  maxAge: number
  /** Stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number
}

// Common cache configurations
export const CACHE_CONFIGS = {
  /** No caching */
  NONE: null,
  /** 1 minute cache, 2 minute stale */
  SHORT: { maxAge: 60, staleWhileRevalidate: 120 },
  /** 5 minute cache, 10 minute stale */
  MEDIUM: { maxAge: 300, staleWhileRevalidate: 600 },
  /** 1 hour cache, 2 hour stale */
  LONG: { maxAge: 3600, staleWhileRevalidate: 7200 },
} as const

function getCacheHeaders(config: CacheConfig | null): HeadersInit {
  if (!config) return {}
  const { maxAge, staleWhileRevalidate } = config
  const swr = staleWhileRevalidate ?? maxAge * 2
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
  }
}

/**
 * Create a successful JSON response with optional caching
 */
export function jsonResponse<T>(
  data: T,
  cache: CacheConfig | null = null
): NextResponse<T> {
  return NextResponse.json(data, {
    headers: getCacheHeaders(cache),
  })
}

/**
 * Create an error response
 */
export function errorResponse(
  error: unknown,
  logPrefix: string = '[API]'
): NextResponse<ApiErrorResponse> {
  // Log the error
  console.error(`${logPrefix} Error:`, error)

  // Handle known API errors
  if (isApiError(error)) {
    return NextResponse.json(
      {
        error: error.name,
        message: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    )
  }

  // Handle unknown errors
  const isDev = process.env.NODE_ENV === 'development'
  const message = isDev && error instanceof Error
    ? error.message
    : 'An unexpected error occurred'
  return NextResponse.json(
    {
      error: 'Internal server error',
      message,
    },
    { status: 500 }
  )
}
