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
