/**
 * Oracle Prices API Route
 *
 * Fetches current token prices from the Reflector Stellar oracle.
 * Accepts a list of assets (code + issuer) and returns their USD prices.
 *
 * Query params:
 *   assets: JSON array of {code, issuer} objects
 *   Example: ?assets=[{"code":"KALE","issuer":"GBDVX4..."}]
 *
 * Or POST with body:
 *   { assets: [{code, issuer}, ...] }
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getOraclePrice,
  getOraclePrices,
  assetToContractId,
  getOracleSupportedAssets,
  type OraclePriceResult
} from "@/lib/stellar/reflector-oracle"

// Cache supported assets for 5 minutes
let supportedAssetsCache: Set<string> | null = null
let supportedAssetsCacheTime = 0
const SUPPORTED_ASSETS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getSupportedAssetsSet(): Promise<Set<string>> {
  const now = Date.now()
  if (supportedAssetsCache && now - supportedAssetsCacheTime < SUPPORTED_ASSETS_CACHE_TTL) {
    return supportedAssetsCache
  }

  try {
    const assets = await getOracleSupportedAssets()
    supportedAssetsCache = new Set(
      assets
        .filter((a) => a.type === "Stellar")
        .map((a) => a.id)
    )
    supportedAssetsCacheTime = now
    return supportedAssetsCache
  } catch (error) {
    console.error("[Oracle Prices API] Failed to fetch supported assets:", error)
    // Return cached version if available, even if stale
    return supportedAssetsCache || new Set()
  }
}

interface AssetRequest {
  code: string
  issuer: string | null
}

interface PriceResponse {
  [key: string]: {
    price: number
    timestamp: number
    contractId: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const assetsParam = searchParams.get("assets")

    if (!assetsParam) {
      return NextResponse.json(
        { error: "Missing assets parameter" },
        { status: 400 }
      )
    }

    let assets: AssetRequest[]
    try {
      assets = JSON.parse(assetsParam)
    } catch {
      return NextResponse.json(
        { error: "Invalid assets JSON" },
        { status: 400 }
      )
    }

    return await fetchPrices(assets)
  } catch (error) {
    console.error("[Oracle Prices API] GET error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const assets: AssetRequest[] = body.assets

    if (!assets || !Array.isArray(assets)) {
      return NextResponse.json(
        { error: "Missing or invalid assets array in body" },
        { status: 400 }
      )
    }

    return await fetchPrices(assets)
  } catch (error) {
    console.error("[Oracle Prices API] POST error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

async function fetchPrices(assets: AssetRequest[]): Promise<NextResponse> {
  // Get supported assets to filter requests
  const supportedAssets = await getSupportedAssetsSet()

  // Filter to only supported assets
  const supportedRequests = assets.filter((asset) => {
    const contractId = assetToContractId(asset.code, asset.issuer)
    return supportedAssets.has(contractId)
  })

  if (supportedRequests.length === 0) {
    return NextResponse.json(
      { prices: {}, unsupported: assets.map((a) => a.code) },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60", // 1 minute cache for empty results
        },
      }
    )
  }

  // Fetch prices in parallel
  const priceResults = await getOraclePrices(supportedRequests)

  // Build response keyed by asset code (for easy lookup)
  const prices: PriceResponse = {}
  const unsupported: string[] = []

  for (const asset of assets) {
    const contractId = assetToContractId(asset.code, asset.issuer)
    const priceResult = priceResults.get(contractId)

    if (priceResult) {
      prices[asset.code] = {
        price: priceResult.price,
        timestamp: priceResult.timestamp,
        contractId,
      }
    } else if (!supportedAssets.has(contractId)) {
      unsupported.push(asset.code)
    }
  }

  return NextResponse.json(
    { prices, unsupported },
    {
      status: 200,
      headers: {
        // Cache for 1 minute (prices update every 5 minutes)
        "Cache-Control": "public, max-age=60",
      },
    }
  )
}
