/**
 * Backstop Cost Basis API Route
 * Fetches backstop cost basis (deposited - withdrawn LP tokens) for a user
 */

import { NextRequest } from 'next/server'
import { eventsRepository } from '@/lib/db/events-repository'
import {
  createApiHandler,
  requireString,
  optionalString,
  CACHE_CONFIGS,
} from '@/lib/api'

interface BackstopCostBasisResponse {
  user_address: string
  cost_bases: unknown[]
}

export const GET = createApiHandler<BackstopCostBasisResponse>({
  logPrefix: '[Backstop Cost Basis API]',
  cache: CACHE_CONFIGS.SHORT,

  analytics: {
    event: 'backstop_cost_basis_fetched',
    getUserAddress: (request) => request.nextUrl.searchParams.get('user') || undefined,
    getProperties: (result, _userAddress) => ({
      pool_count: result.cost_bases.length,
      has_position: result.cost_bases.length > 0,
    }),
  },

  async handler(_request: NextRequest, { searchParams }) {
    const user = requireString(searchParams, 'user')
    const poolId = optionalString(searchParams, 'pool')

    // If pool is specified, get cost basis for that pool only
    // Otherwise, get cost basis for all pools
    if (poolId) {
      const costBasis = await eventsRepository.getBackstopCostBasis(user, poolId)
      return {
        user_address: user,
        cost_bases: costBasis ? [costBasis] : [],
      }
    }

    const costBases = await eventsRepository.getAllBackstopCostBases(user)
    return {
      user_address: user,
      cost_bases: costBases,
    }
  },
})
