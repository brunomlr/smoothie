/**
 * Wallet Address Resolver
 *
 * Resolves wallet identifiers (including demo wallet aliases) to real Stellar addresses.
 * Used by API routes to handle both regular addresses and demo wallet aliases.
 */

import { getDemoWalletByAlias, isValidDemoAlias } from '@/lib/config/demo-wallet-server'
import { ValidationError } from './errors'

const STELLAR_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/

function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address)
}

/**
 * Resolve a wallet parameter to a real Stellar address
 *
 * @param walletParam - Either a real Stellar address (starting with G or C) or a demo alias (starting with "demo-")
 * @returns The resolved Stellar address
 * @throws ValidationError if the demo alias is invalid
 *
 * @example
 * // Real address passthrough
 * resolveWalletAddress("GAOLK...") // returns "GAOLK..."
 *
 * // Demo alias resolution
 * resolveWalletAddress("demo-1") // returns the mapped address like "GAOLK..."
 */
export function resolveWalletAddress(walletParam: string): string {
  const normalized = walletParam.trim()

  // Check if this is a demo wallet alias
  if (normalized.startsWith('demo-')) {
    const address = getDemoWalletByAlias(normalized)
    if (!address) {
      throw new ValidationError(`Invalid demo wallet alias: ${normalized}`)
    }
    return address
  }

  if (!isValidStellarAddress(normalized)) {
    throw new ValidationError('Invalid wallet address format', 'wallet')
  }

  // Regular address
  return normalized
}

/**
 * Resolve multiple wallet addresses (for multi-wallet endpoints)
 * Handles comma-separated lists of addresses/aliases
 *
 * @param addressesParam - Comma-separated list of addresses or aliases
 * @returns Comma-separated list of resolved addresses
 */
export function resolveWalletAddresses(addressesParam: string): string {
  return addressesParam
    .split(',')
    .map(addr => resolveWalletAddress(addr.trim()))
    .join(',')
}

/**
 * Check if a wallet parameter is a demo wallet alias
 */
export function isDemoWalletParam(walletParam: string): boolean {
  return walletParam.startsWith('demo-') && isValidDemoAlias(walletParam)
}
