/**
 * Reflector Oracle Client
 *
 * Queries the Reflector Stellar oracle for current token prices.
 * Oracle contract: CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M
 *
 * Supports 49 Stellar tokens including KALE, USDC, XLM, etc.
 * Prices are updated every 5 minutes with 14 decimal precision.
 */

import { Contract, xdr, scValToNative, TransactionBuilder, Account, Asset, Address, rpc } from "@stellar/stellar-sdk"

// Reflector Stellar tokens oracle (mainnet)
export const REFLECTOR_STELLAR_ORACLE = "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M"

// Oracle price precision (14 decimals)
const ORACLE_DECIMALS = 14

// Network config
const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || "https://mainnet.sorobanrpc.com"
const NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"

// Dummy account for simulation (no actual signing needed)
const DUMMY_ACCOUNT = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")

export interface OraclePriceResult {
  price: number
  timestamp: number
}

export interface OracleAsset {
  type: "Stellar" | "Other"
  id: string // Contract ID for Stellar, symbol for Other
}

/**
 * Get the Soroban RPC server instance
 */
function getServer(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL)
}

/**
 * Convert a Stellar asset (code + issuer) to its contract ID
 */
export function assetToContractId(code: string, issuer: string | null): string {
  if (!issuer) {
    // Native XLM
    const xlm = Asset.native()
    return xlm.contractId(NETWORK_PASSPHRASE)
  }
  const asset = new Asset(code, issuer)
  return asset.contractId(NETWORK_PASSPHRASE)
}

/**
 * Build the ScVal for a Stellar asset (for oracle calls)
 */
function buildStellarAssetScVal(contractId: string): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Stellar"),
    new Address(contractId).toScVal()
  ])
}

/**
 * Get the list of assets supported by the oracle
 */
export async function getOracleSupportedAssets(): Promise<OracleAsset[]> {
  const server = getServer()
  const contract = new Contract(REFLECTOR_STELLAR_ORACLE)

  const tx = new TransactionBuilder(DUMMY_ACCOUNT, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call("assets"))
    .setTimeout(30)
    .build()

  const result = await server.simulateTransaction(tx)

  if (rpc.Api.isSimulationSuccess(result) && result.result) {
    const assets = scValToNative(result.result.retval) as Array<[string, string]>
    return assets.map(([type, id]) => ({
      type: type as "Stellar" | "Other",
      id
    }))
  }

  throw new Error("Failed to get oracle supported assets")
}

/**
 * Get the current price for a single asset from the oracle
 */
export async function getOraclePrice(
  assetCode: string,
  assetIssuer: string | null
): Promise<OraclePriceResult | null> {
  try {
    const server = getServer()
    const contract = new Contract(REFLECTOR_STELLAR_ORACLE)
    const contractId = assetToContractId(assetCode, assetIssuer)
    const assetScVal = buildStellarAssetScVal(contractId)

    const tx = new TransactionBuilder(DUMMY_ACCOUNT, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(contract.call("lastprice", assetScVal))
      .setTimeout(30)
      .build()

    const result = await server.simulateTransaction(tx)

    if (rpc.Api.isSimulationSuccess(result) && result.result) {
      const data = scValToNative(result.result.retval) as { price: bigint; timestamp: bigint } | null

      if (data && data.price) {
        const usdPrice = Number(data.price) / Math.pow(10, ORACLE_DECIMALS)
        return {
          price: usdPrice,
          timestamp: Number(data.timestamp)
        }
      }
    }

    return null
  } catch (error) {
    console.error(`[Reflector Oracle] Failed to get price for ${assetCode}:`, error)
    return null
  }
}

/**
 * Get prices for multiple assets in parallel
 * Returns a map of contractId -> price
 */
export async function getOraclePrices(
  assets: Array<{ code: string; issuer: string | null }>
): Promise<Map<string, OraclePriceResult>> {
  const results = new Map<string, OraclePriceResult>()

  // Fetch all prices in parallel
  const pricePromises = assets.map(async ({ code, issuer }) => {
    const contractId = assetToContractId(code, issuer)
    const price = await getOraclePrice(code, issuer)
    return { contractId, code, issuer, price }
  })

  const priceResults = await Promise.allSettled(pricePromises)

  for (const result of priceResults) {
    if (result.status === "fulfilled" && result.value.price) {
      results.set(result.value.contractId, result.value.price)
    }
  }

  return results
}

/**
 * Check if an asset is supported by the oracle
 */
export async function isAssetSupported(
  assetCode: string,
  assetIssuer: string | null
): Promise<boolean> {
  try {
    const supportedAssets = await getOracleSupportedAssets()
    const contractId = assetToContractId(assetCode, assetIssuer)

    return supportedAssets.some(
      (asset) => asset.type === "Stellar" && asset.id === contractId
    )
  } catch {
    return false
  }
}
