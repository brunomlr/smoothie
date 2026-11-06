/**
 * Blockchain Configuration
 * Token addresses and blockchain-related constants
 */

// Stellar token addresses
export const TOKENS = {
  LP: {
    address: 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM',
    symbol: 'BLND-USDC LP',
    decimals: 7,
  },
  BLND: {
    address: 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY',
    symbol: 'BLND',
    decimals: 7,
  },
} as const

// Convenience exports for backwards compatibility
export const LP_TOKEN_ADDRESS = TOKENS.LP.address
export const BLND_TOKEN_ADDRESS = TOKENS.BLND.address

// Classic-asset form of BLND (its SAC wraps to BLND_TOKEN_ADDRESS)
export const BLND_CLASSIC_ISSUER = 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY'

// Native XLM Stellar Asset Contract address (used for price lookups)
export const XLM_TOKEN_ADDRESS = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'

// daily_token_prices coverage starts here (same day as the first indexed pool event)
export const PRICE_COVERAGE_START = '2025-04-15'

/**
 * Blend V2.1 backstop (Comet V1.1 BLND-USDC LP as backstop token). Pools whose
 * metadata points here are V2.1 pools.
 */
export const BACKSTOP_V2_1 = 'CCS4AZ5ORM6VLLPJTJUFRNXWBMHOO3L5WHHRPL2ZMILE35ZDMQFHOQMJ'

/**
 * Backstops whose BLND emissions are not claimable yet. The official Blend UI
 * hides V2.1 emission APRs and disables claiming "until V2.1 emissions are
 * enabled": the emitter still funds the V2 backstop, so V2.1 accruals are
 * unfunded. Remove the entry once the emitter migrates to V2.1.
 */
export const EMISSIONS_DISABLED_BACKSTOPS: ReadonlySet<string> = new Set([BACKSTOP_V2_1])

export function areEmissionsEnabled(backstopId: string | undefined | null): boolean {
  return !backstopId || !EMISSIONS_DISABLED_BACKSTOPS.has(backstopId)
}

/**
 * Comet V1.1 BLND-USDC LP: the V2.1 backstop token. The Comet V1 LP
 * (LP_TOKEN_ADDRESS) stays the backstop token of V1/V2 pools.
 */
export const LP_TOKEN_V1_1_ADDRESS = 'CASYAKK3SHDN6S2E6IUOBVRXT3KKPVQCVQO4GNBDTVE6XZQQMW4UMIHE'

/** Every backstop LP token, oldest first */
export const BACKSTOP_LP_TOKENS: readonly string[] = [LP_TOKEN_ADDRESS, LP_TOKEN_V1_1_ADDRESS]

/** Pools behind the V2.1 backstop. A pool's backstop is fixed at deployment. */
export const V2_1_POOL_IDS: readonly string[] = [
  'CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO', // Fixed v2.1
]

/** The backstop LP token a pool's backstop positions are denominated in */
export function lpTokenForPool(poolId: string | null | undefined): string {
  return poolId && V2_1_POOL_IDS.includes(poolId) ? LP_TOKEN_V1_1_ADDRESS : LP_TOKEN_ADDRESS
}

/** Display label of a backstop LP token */
export function lpTokenLabel(tokenAddress: string): string {
  return tokenAddress === LP_TOKEN_V1_1_ADDRESS ? 'BLND-USDC LP (V1.1)' : 'BLND-USDC LP'
}

export function isBackstopLpToken(tokenAddress: string | null | undefined): boolean {
  return !!tokenAddress && BACKSTOP_LP_TOKENS.includes(tokenAddress)
}

/**
 * SQL expression resolving a pool-address column to its backstop LP token.
 * Built only from the constants above, so it is safe to inline.
 */
export function lpTokenSqlCase(poolColumn: string): string {
  const v21 = V2_1_POOL_IDS.map((id) => `'${id}'`).join(', ')
  return `(CASE WHEN ${poolColumn} IN (${v21}) THEN '${LP_TOKEN_V1_1_ADDRESS}' ELSE '${LP_TOKEN_ADDRESS}' END)`
}

/**
 * Backstop tokens whose LP is broken (Comet V1 accounting bug, drained of
 * USDC). Interest owed to these backstops cannot be auctioned into the
 * backstop (the auction aborts), so depositors earn no interest and the spot
 * APR formula divides by ~$0. Treat their interest APR as 0.
 */
export const BROKEN_BACKSTOP_LP_TOKENS: readonly string[] = [LP_TOKEN_ADDRESS]

export function isBackstopInterestPayable(backstopTokenId: string | null | undefined): boolean {
  return !backstopTokenId || !BROKEN_BACKSTOP_LP_TOKENS.includes(backstopTokenId)
}

// Conversion constants
export const STROOPS_PER_UNIT = 1e7

// YieldBlox pool incident (2026-02-22 bad-debt socialization)
export const YIELDBLOX_POOL_ID = 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS'
export const YIELDBLOX_INCIDENT_LINK = 'https://x.com/script3official/status/2025403423840141450'

/**
 * Known incident-remediation distributions (reimbursements of protocol losses).
 * A payment counts only if BOTH the sender and the transaction memo match, so
 * spam payments carrying a copied memo can't spoof a reimbursement row.
 */
export interface RemediationDistribution {
  label: string
  sender: string
  memo: string
  assetCode: string
  assetIssuer: string
  /** SAC address of the paid asset, for daily_token_prices lookups */
  tokenAddress: string
  relatedPoolId: string
}

export const REMEDIATION_DISTRIBUTIONS: RemediationDistribution[] = [
  {
    label: 'YieldBlox pool remediation',
    sender: 'GCGWLP2YIOBV2RISNXBAXPD4E7QNQB2IOEHUFWICAQA2RLBTIKTUJXXD',
    memo: 'YieldBlox Pool Remediation',
    assetCode: 'USDC',
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    tokenAddress: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    relatedPoolId: YIELDBLOX_POOL_ID,
  },
]

// Storage keys
export const STORAGE_KEYS = {
  TRACKED_WALLETS: 'stellar-wallet-tracked-addresses',
  ACTIVE_WALLET: 'stellar-wallet-active-id',
  WALLET_CUSTOM_NAMES: 'stellar-wallet-custom-names',
  WALLET_AVATAR_CUSTOMIZATIONS: 'stellar-wallet-avatar-customizations',
} as const

// Backwards compatibility exports
export const WALLETS_STORAGE_KEY = STORAGE_KEYS.TRACKED_WALLETS
export const ACTIVE_WALLET_STORAGE_KEY = STORAGE_KEYS.ACTIVE_WALLET
export const WALLET_CUSTOM_NAMES_KEY = STORAGE_KEYS.WALLET_CUSTOM_NAMES
export const WALLET_AVATAR_CUSTOMIZATIONS_KEY = STORAGE_KEYS.WALLET_AVATAR_CUSTOMIZATIONS
