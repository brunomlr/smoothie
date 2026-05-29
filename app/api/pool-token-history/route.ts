/**
 * Pool Token History API Route
 *
 * Returns historical supplied/borrowed amounts for each pool, broken down by
 * token (reserve). Each point carries both native token units and USD value so
 * the client can toggle between fiat and absolute-token views.
 *
 * Today's data point uses live SDK data for accuracy (mirrors /api/pool-history).
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

interface TokenMeta {
  assetAddress: string
  symbol: string
  iconUrl: string | null
}

interface TokenHistoryEntry {
  suppliedUsd: number
  borrowedUsd: number
  suppliedTokens: number
  borrowedTokens: number
}

interface TokenHistoryPoint {
  date: string
  /** Per-token values, keyed by asset address */
  tokens: Record<string, TokenHistoryEntry>
}

interface PoolTokenHistoryData {
  pools: Record<string, {
    name: string
    iconUrl: string | null
    /** Tokens present in this pool, ordered by most-recent supplied USD (desc) */
    tokens: TokenMeta[]
    history: TokenHistoryPoint[]
  }>
}

type LivePoolTokens = Record<string, TokenHistoryEntry>

/**
 * Get live per-token supplied/borrowed amounts from the SDK for all pools.
 * A pool is only included if it has at least one priced reserve (otherwise the
 * historical point is kept instead). Individual tokens missing a price are still
 * included with usd = 0 so the token-unit view stays complete.
 */
async function getLiveTokenData(): Promise<Record<string, LivePoolTokens>> {
  const network = getBlendNetwork()
  const dbPools = await metadataRepository.getPools()
  const trackedPools = toTrackedPools(dbPools)

  const poolResults = await Promise.all(
    trackedPools.map(async (tracked) => {
      try {
        const metadata = await PoolMetadata.load(network, tracked.id)
        const pool = await PoolV2.loadWithMetadata(network, tracked.id, metadata)

        let oracle: PoolOracle | null = null
        try {
          oracle = await pool.loadOracle()
        } catch {
          // Oracle load failed
        }

        const tokens: LivePoolTokens = {}
        let hasPricedReserve = false

        for (const [assetId, reserve] of pool.reserves) {
          try {
            const suppliedTokens = reserve.totalSupplyFloat()
            const borrowedTokens = reserve.totalLiabilitiesFloat()

            let priceFloat: number | null | undefined = null
            if (oracle) {
              priceFloat = oracle.getPriceFloat(assetId)
            }

            const price = priceFloat ?? 0
            if (price > 0) {
              hasPricedReserve = true
            }

            tokens[assetId] = {
              suppliedTokens,
              borrowedTokens,
              suppliedUsd: suppliedTokens * price,
              borrowedUsd: borrowedTokens * price,
            }
          } catch {
            // Skip this reserve
          }
        }

        if (!hasPricedReserve) {
          console.warn(`[Pool Token History API] Skipping live point for ${tracked.id}: no priced reserves`)
          return null
        }

        return { id: tracked.id, tokens }
      } catch (error) {
        console.error(`[Pool Token History API] Failed to load pool ${tracked.id}:`, error)
        return null
      }
    })
  )

  const result: Record<string, LivePoolTokens> = {}
  for (const r of poolResults) {
    if (r) result[r.id] = r.tokens
  }
  return result
}

export const GET = createApiHandler<PoolTokenHistoryData>({
  logPrefix: '[Pool Token History API]',
  cache: CACHE_CONFIGS.LONG,

  redisCache: {
    ttl: CACHE_TTL.LONG, // 15 minutes
    getKey: (request) => {
      const params = request.nextUrl.searchParams
      const days = params.get('days') || 'all'
      return cacheKey('pool-token-history', days, todayDate())
    },
  },

  async handler(_request: NextRequest, { searchParams }) {
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : undefined

    const [historyData, dbPools, dbTokens, liveTokenData] = await Promise.all([
      poolSnapshotsRepository.getPoolTokenTvlHistory(days),
      metadataRepository.getPools(),
      metadataRepository.getTokens(),
      getLiveTokenData(),
    ])

    const poolMeta = new Map(
      dbPools.map((p) => [p.pool_id, { name: p.name, iconUrl: p.icon_url }])
    )
    const tokenMeta = new Map(
      dbTokens.map((t) => [t.asset_address, { symbol: t.symbol, iconUrl: t.icon_url }])
    )

    const resolveToken = (assetAddress: string): TokenMeta => {
      const meta = tokenMeta.get(assetAddress)
      return {
        assetAddress,
        symbol: meta?.symbol ?? assetAddress.slice(0, 4),
        iconUrl: meta?.iconUrl ?? null,
      }
    }

    const poolsMap: Record<string, {
      name: string
      iconUrl: string | null
      tokens: TokenMeta[]
      history: TokenHistoryPoint[]
      // Internal: index points by date for live merge, and track assets seen
      _pointsByDate: Map<string, TokenHistoryPoint>
      _assets: Set<string>
    }> = {}

    const ensurePool = (poolId: string) => {
      if (!poolsMap[poolId]) {
        const meta = poolMeta.get(poolId)
        poolsMap[poolId] = {
          name: meta?.name ?? poolId.slice(0, 8),
          iconUrl: meta?.iconUrl ?? null,
          tokens: [],
          history: [],
          _pointsByDate: new Map(),
          _assets: new Set(),
        }
      }
      return poolsMap[poolId]
    }

    // Group historical data by pool -> date -> token
    for (const point of historyData) {
      const pool = ensurePool(point.poolId)
      pool._assets.add(point.assetAddress)

      let datePoint = pool._pointsByDate.get(point.date)
      if (!datePoint) {
        datePoint = { date: point.date, tokens: {} }
        pool._pointsByDate.set(point.date, datePoint)
        pool.history.push(datePoint)
      }

      datePoint.tokens[point.assetAddress] = {
        suppliedUsd: point.suppliedUsd,
        borrowedUsd: point.borrowedUsd,
        suppliedTokens: point.suppliedTokens,
        borrowedTokens: point.borrowedTokens,
      }
    }

    // Merge today's live data (replace the whole day's token map per pool)
    const today = new Date().toISOString().split('T')[0]
    for (const [poolId, liveTokens] of Object.entries(liveTokenData)) {
      const pool = ensurePool(poolId)

      const livePoint: TokenHistoryPoint = { date: today, tokens: liveTokens }
      for (const assetAddress of Object.keys(liveTokens)) {
        pool._assets.add(assetAddress)
      }

      const existing = pool._pointsByDate.get(today)
      if (existing) {
        existing.tokens = liveTokens
      } else {
        pool._pointsByDate.set(today, livePoint)
        pool.history.push(livePoint)
      }
    }

    // Finalize: sort history by date, build ordered token list (by latest supplied USD)
    const result: PoolTokenHistoryData = { pools: {} }
    for (const [poolId, pool] of Object.entries(poolsMap)) {
      pool.history.sort((a, b) => a.date.localeCompare(b.date))

      const latest = pool.history[pool.history.length - 1]
      const tokens = Array.from(pool._assets)
        .map(resolveToken)
        .sort((a, b) => {
          const aUsd = latest?.tokens[a.assetAddress]?.suppliedUsd ?? 0
          const bUsd = latest?.tokens[b.assetAddress]?.suppliedUsd ?? 0
          if (bUsd !== aUsd) return bUsd - aUsd
          return a.symbol.localeCompare(b.symbol)
        })

      result.pools[poolId] = {
        name: pool.name,
        iconUrl: pool.iconUrl,
        tokens,
        history: pool.history,
      }
    }

    return result
  },
})
