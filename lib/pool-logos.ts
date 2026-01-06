/**
 * Pool logo resolution utilities
 */

export const POOL_LOGO_MAP: Record<string, string> = {
  "Orbit": "/pools/orbit.png",
  "YieldBlox": "/pools/yieldblox.png",
  "Fixed": "/pools/fixed.png",
  "Forex": "/pools/forex.png",
  "Etherfuse": "/pools/etherfuse.png",
}

/**
 * Resolves the logo URL for a given pool name.
 * First checks the explicit mapping, then falls back to a convention-based path.
 */
export function resolvePoolLogo(poolName: string): string {
  return POOL_LOGO_MAP[poolName] ?? `/pools/${poolName.toLowerCase()}.png`
}
