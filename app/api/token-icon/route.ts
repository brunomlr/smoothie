/**
 * Token Icon API Route
 *
 * Serves token icons with local-first approach:
 * Flow:
 * 1. Check if a local icon exists in /public/tokens/{code}.png
 * 2. If local icon exists, redirect to it
 * 3. Try Stellar Expert API (aggregated asset metadata)
 * 4. Fall back to stellar.toml lookup:
 *    a. Get issuer account from Horizon to find home_domain
 *    b. Fetch stellar.toml from home_domain
 *    c. Parse TOML to find the token's image URL
 *    d. Redirect to that image URL
 *
 * Caches results aggressively (1 week) since token logos rarely change.
 */

import { NextRequest, NextResponse } from "next/server"
import { getHorizonServer } from "@/lib/stellar/horizon"
import { existsSync } from "fs"
import { join } from "path"

// Cache for 1 week
const CACHE_MAX_AGE = 60 * 60 * 24 * 7

// In-memory cache for resolved icon URLs (persists across requests in same instance)
const iconUrlCache = new Map<string, { url: string | null; timestamp: number }>()
const MEMORY_CACHE_TTL = 60 * 60 * 1000 // 1 hour in ms

function getCacheKey(code: string, issuer: string): string {
  return `${code}-${issuer}`
}

function getFromMemoryCache(key: string): string | null | undefined {
  const cached = iconUrlCache.get(key)
  if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
    return cached.url
  }
  return undefined
}

function setMemoryCache(key: string, url: string | null): void {
  iconUrlCache.set(key, { url, timestamp: Date.now() })
}

// Check if a local icon exists for the given asset code
function getLocalIconPath(assetCode: string): string | null {
  const filename = `${assetCode.toLowerCase()}.png`
  const localPath = join(process.cwd(), "public", "tokens", filename)

  if (existsSync(localPath)) {
    return `/tokens/${filename}`
  }
  return null
}

// Try to get icon URL from Stellar Expert API
async function getIconFromStellarExpert(code: string, issuer: string): Promise<string | null> {
  try {
    // Stellar Expert uses type 1 for native-like assets and 2 for credit alphanumeric
    // Most assets are type 1, but we'll try type 1 first then type 2 if needed
    const assetId = `${code}-${issuer}-1`
    const url = `https://api.stellar.expert/explorer/public/asset/meta?asset[]=${encodeURIComponent(assetId)}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const records = data?._embedded?.records

    if (records && records.length > 0) {
      const record = records[0]
      const imageUrl = record?.toml_info?.image
      if (imageUrl) {
        return imageUrl
      }
    }

    return null
  } catch (error) {
    console.error("[Token Icon API] Stellar Expert lookup failed:", error)
    return null
  }
}

// Simple TOML parser for stellar.toml [[CURRENCIES]] section
function parseTomlForImage(tomlContent: string, assetCode: string, issuer: string): string | null {
  try {
    // Find all [[CURRENCIES]] blocks
    const currencyBlocks = tomlContent.split(/\[\[CURRENCIES\]\]/i).slice(1)

    for (const block of currencyBlocks) {
      // Extract until next section (starts with [ or end of string)
      const blockContent = block.split(/\n\[/)[0]

      // Parse key-value pairs
      const lines = blockContent.split("\n")
      let blockCode: string | null = null
      let blockIssuer: string | null = null
      let blockImage: string | null = null

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue

        // Match key = "value" or key = 'value'
        const match = trimmed.match(/^(\w+)\s*=\s*["'](.*)["']/)
        if (match) {
          const [, key, value] = match
          const keyLower = key.toLowerCase()
          if (keyLower === "code") blockCode = value
          if (keyLower === "issuer") blockIssuer = value
          if (keyLower === "image") blockImage = value
        }
      }

      // Check if this block matches our asset
      if (
        blockCode?.toUpperCase() === assetCode.toUpperCase() &&
        blockIssuer === issuer &&
        blockImage
      ) {
        return blockImage
      }
    }

    return null
  } catch (error) {
    console.error("[Token Icon API] Error parsing TOML:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const issuer = searchParams.get("issuer")

  if (!code || !issuer) {
    return NextResponse.json(
      { error: "Missing code or issuer parameter" },
      { status: 400 }
    )
  }

  // Step 1: Check for local icon first (highest priority)
  const localIconPath = getLocalIconPath(code)
  if (localIconPath) {
    // Build absolute URL for the local icon
    const baseUrl = request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}${localIconPath}`, {
      status: 302,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      },
    })
  }

  const cacheKey = getCacheKey(code, issuer)

  // Step 2: Check memory cache for TOML-resolved URLs
  const cachedUrl = getFromMemoryCache(cacheKey)
  if (cachedUrl !== undefined) {
    if (cachedUrl === null) {
      // Cached "not found" - return 404
      return NextResponse.json(
        { error: "No icon found for this asset" },
        {
          status: 404,
          headers: {
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        }
      )
    }
    // Redirect to cached URL
    return NextResponse.redirect(cachedUrl, {
      status: 302,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      },
    })
  }

  try {
    // Step 3: Try Stellar Expert API first (faster, aggregated data)
    const stellarExpertUrl = await getIconFromStellarExpert(code, issuer)
    if (stellarExpertUrl) {
      setMemoryCache(cacheKey, stellarExpertUrl)
      return NextResponse.redirect(stellarExpertUrl, {
        status: 302,
        headers: {
          "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
        },
      })
    }

    // Step 4a: Fall back to TOML lookup - Get issuer account to find home_domain
    const server = getHorizonServer()
    let homeDomain: string | undefined

    try {
      const account = await server.loadAccount(issuer)
      homeDomain = account.home_domain
    } catch (error) {
      console.error("[Token Icon API] Error loading issuer account:", error)
      setMemoryCache(cacheKey, null)
      return NextResponse.json(
        { error: "Could not load issuer account" },
        {
          status: 404,
          headers: {
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        }
      )
    }

    if (!homeDomain) {
      setMemoryCache(cacheKey, null)
      return NextResponse.json(
        { error: "Issuer has no home_domain set" },
        {
          status: 404,
          headers: {
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        }
      )
    }

    // Step 4b: Fetch stellar.toml from home_domain
    const tomlUrl = `https://${homeDomain}/.well-known/stellar.toml`
    let tomlContent: string

    try {
      const tomlResponse = await fetch(tomlUrl, {
        headers: {
          Accept: "text/plain, application/toml, */*",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!tomlResponse.ok) {
        throw new Error(`Failed to fetch stellar.toml: ${tomlResponse.status}`)
      }

      tomlContent = await tomlResponse.text()
    } catch (error) {
      console.error("[Token Icon API] Error fetching stellar.toml:", error)
      setMemoryCache(cacheKey, null)
      return NextResponse.json(
        { error: "Could not fetch stellar.toml" },
        {
          status: 404,
          headers: {
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        }
      )
    }

    // Step 4c: Parse TOML to find image URL
    const imageUrl = parseTomlForImage(tomlContent, code, issuer)

    if (!imageUrl) {
      setMemoryCache(cacheKey, null)
      return NextResponse.json(
        { error: "No icon found in stellar.toml" },
        {
          status: 404,
          headers: {
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        }
      )
    }

    // Cache and redirect to image URL
    setMemoryCache(cacheKey, imageUrl)
    return NextResponse.redirect(imageUrl, {
      status: 302,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      },
    })
  } catch (error) {
    console.error("[Token Icon API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
