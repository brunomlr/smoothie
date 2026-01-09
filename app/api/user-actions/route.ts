/**
 * User Actions API Route
 * Fetches user action history from the database (parsed_events)
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
  optionalString,
  optionalInt,
  parseList,
  CACHE_CONFIGS,
  resolveWalletAddress,
  isDemoWalletParam,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'

/**
 * Generate a deterministic placeholder hash based on input
 * Uses the original hash to seed the output so the same action always gets the same placeholder
 */
function generatePlaceholderHash(seed: string): string {
  // Use multiple seed values from different parts of the input for better distribution
  const hexChars = '0123456789abcdef'
  let result = ''

  for (let i = 0; i < 64; i++) {
    // Combine seed character codes with position for variety
    const seedIndex = i % seed.length
    const charCode = seed.charCodeAt(seedIndex)
    const nextCharCode = seed.charCodeAt((seedIndex + 1) % seed.length)
    const prevCharCode = seed.charCodeAt((seedIndex + seed.length - 1) % seed.length)

    // Mix multiple values together
    const mixed = (charCode * 31 + nextCharCode * 17 + prevCharCode * 13 + i * 7) ^ (i * charCode)
    result += hexChars[Math.abs(mixed) % 16]
  }

  return result
}

interface UserActionsResponse {
  user_address: string
  count: number
  limit: number
  offset: number
  actions: unknown[]
}

export const GET = createApiHandler<UserActionsResponse>({
  logPrefix: '[User Actions API]',
  cache: CACHE_CONFIGS.SHORT,

  redisCache: {
    ttl: CACHE_TTL.MEDIUM, // 5 minutes - user actions don't change frequently
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      return cacheKey(
        'user-actions',
        params.get('user') || '',
        params.get('limit') || '50',
        params.get('offset') || '0',
        params.get('pool') || '',
        params.get('asset') || '',
        params.get('actionTypes') || '',
        params.get('startDate') || '',
        params.get('endDate') || '',
        todayDate() // Rotate cache daily for new actions
      )
    },
  },

  analytics: {
    event: 'user_actions_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result, userAddress) => ({
      action_count: result.count,
      has_filters: result.count !== result.actions.length,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const userParam = requireString(searchParams, 'user')
    const isDemo = isDemoWalletParam(userParam)
    const user = resolveWalletAddress(userParam)
    const limit = optionalInt(searchParams, 'limit', 50, { min: 1, max: 1000 })
    const offset = optionalInt(searchParams, 'offset', 0, { min: 0 })
    const poolId = optionalString(searchParams, 'pool')
    const assetAddress = optionalString(searchParams, 'asset')
    const actionTypes = parseList(searchParams, 'actionTypes')
    const startDate = optionalString(searchParams, 'startDate')
    const endDate = optionalString(searchParams, 'endDate')

    const actions = await eventsRepository.getUserActions(user, {
      limit,
      offset,
      actionTypes,
      poolId,
      assetAddress,
      startDate,
      endDate,
    })

    // For demo wallets, replace transaction hashes with placeholders
    const sanitizedActions = isDemo
      ? actions.map(action => ({
          ...action,
          transaction_hash: generatePlaceholderHash(action.transaction_hash),
        }))
      : actions

    return {
      user_address: user,
      count: sanitizedActions.length,
      limit,
      offset,
      actions: sanitizedActions,
    }
  },
})
