/**
 * Pool History API Route
 *
 * Returns historical TVL and borrowed amounts for all pools.
 * Today's data point uses live SDK data for accuracy.
 */

import { NextRequest } from 'next/server'
import {
  PoolV2,
  PoolMetadata,
  PoolOracle,
} from '@blend-capital/blend-sdk'
import { poolSnapshotsRepository } from '@/lib/db/repositories/pool-snapshots-repository'
import { metadataRepository } from '@/lib/db/repositories/metadata-repository'
import { getBlendNetwork } from '@/lib/blend/network'
import { toTrackedPools } from '@/lib/blend/pools'
import {
  createApiHandler,
  CACHE_CONFIGS,
} from '@/lib/api'
import { cacheKey, todayDate, CACHE_TTL } from '@/lib/redis'

interface PoolHistoryPoint {
  date: string
  tvlUsd: number
  borrowedUsd: number
}

interface PoolHistoryData {
  pools: Record<string, {
    name: string
    iconUrl: string | null
    history: PoolHistoryPoint[]
  }>
}

/**
 * Get live TVL and borrowed amounts from SDK for all pools
 */
async function getLiveTvlData(): Promise<Record<string, { tvlUsd: number; borrowedUsd: number }>> {
  const network = getBlendNetwork()
  const dbPools = await metadataRepository.getPools()
  const trackedPools = toTrackedPools(dbPools)

  const result: Record<string, { tvlUsd: number; borrowedUsd: number }> = {}

  for (const tracked of trackedPools) {
    try {
      const metadata = await PoolMetadata.load(network, tracked.id)
      const pool = await PoolV2.loadWithMetadata(network, tracked.id, metadata)

      let oracle: PoolOracle | null = null
      try {
        oracle = await pool.loadOracle()
      } catch {
        // Oracle load failed
      }

      let tvlUsd = 0
      let borrowedUsd = 0
      let hasPricedReserve = false

      for (const [assetId, reserve] of pool.reserves) {
        try {
          const totalSuppliedTokens = reserve.totalSupplyFloat()
          const totalBorrowedTokens = reserve.totalLiabilitiesFloat()

          if (oracle) {
            const priceFloat = oracle.getPriceFloat(assetId)
            if (priceFloat === null || priceFloat === undefined) {
              continue
            }
            hasPricedReserve = true
            tvlUsd += totalSuppliedTokens * priceFloat
            borrowedUsd += totalBorrowedTokens * priceFloat
          }
        } catch {
          // Skip this reserve
        }
      }

      // Avoid publishing false zeroes when live oracle pricing is unavailable.
      if (!hasPricedReserve) {
        console.warn(`[Pool History API] Skipping live point for ${tracked.id}: no priced reserves`)
        continue
      }

      result[tracked.id] = { tvlUsd, borrowedUsd }
    } catch (error) {
      console.error(`[Pool History API] Failed to load pool ${tracked.id}:`, error)
    }
  }

  return result
}

export const GET = createApiHandler<PoolHistoryData>({
  logPrefix: '[Pool History API]',
  cache: CACHE_CONFIGS.LONG,

  redisCache: {
    ttl: CACHE_TTL.LONG, // 15 minutes
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      const days = params.get('days') || 'all'
      return cacheKey('pool-history', days, todayDate())
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    // If days is specified, limit the query; otherwise get all available data
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : undefined

    // Fetch historical data and pool metadata in parallel
    const [historyData, dbPools, liveTvlData] = await Promise.all([
      poolSnapshotsRepository.getPoolTvlHistory(days),
      metadataRepository.getPools(),
      getLiveTvlData(),
    ])

    // Create pool name and icon lookup
    const poolMeta = new Map(
      dbPools.map((p) => [p.pool_id, { name: p.name, iconUrl: p.icon_url }])
    )

    // Group history by pool
    const poolsMap: Record<string, {
      name: string
      iconUrl: string | null
      history: PoolHistoryPoint[]
    }> = {}

    // Get today's date string in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    for (const point of historyData) {
      if (!poolsMap[point.poolId]) {
        const meta = poolMeta.get(point.poolId)
        poolsMap[point.poolId] = {
          name: meta?.name ?? point.poolId.slice(0, 8),
          iconUrl: meta?.iconUrl ?? null,
          history: [],
        }
      }

      poolsMap[point.poolId].history.push({
        date: point.date,
        tvlUsd: point.tvlUsd,
        borrowedUsd: point.borrowedUsd,
      })
    }

    // Add today's live data for each pool
    for (const [poolId, liveData] of Object.entries(liveTvlData)) {
      if (!poolsMap[poolId]) {
        const meta = poolMeta.get(poolId)
        poolsMap[poolId] = {
          name: meta?.name ?? poolId.slice(0, 8),
          iconUrl: meta?.iconUrl ?? null,
          history: [],
        }
      }

      const todayIndex = poolsMap[poolId].history.findIndex((point) => point.date === today)
      const livePoint = {
        date: today,
        tvlUsd: liveData.tvlUsd,
        borrowedUsd: liveData.borrowedUsd,
      }
      if (todayIndex >= 0) {
        poolsMap[poolId].history[todayIndex] = livePoint
      } else {
        poolsMap[poolId].history.push(livePoint)
      }

      // Sort by date to ensure today is at the end
      poolsMap[poolId].history.sort((a, b) => a.date.localeCompare(b.date))
    }

    return {
      pools: poolsMap,
    }
  },
})
