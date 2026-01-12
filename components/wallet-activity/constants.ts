/**
 * Wallet Activity Constants
 *
 * Configuration for Stellar operation types and display settings.
 */

import {
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  UserPlus,
  Link,
  Merge,
  Database,
  Hash,
  Code,
  Settings,
  HelpCircle,
} from "lucide-react"

export interface OperationConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}

// Operation type display configuration
export const OPERATION_CONFIG: Record<string, OperationConfig> = {
  payment: {
    label: "Payment",
    icon: CreditCard,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  create_account: {
    label: "Account Created",
    icon: UserPlus,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  change_trust: {
    label: "Trustline",
    icon: Link,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  path_payment_strict_send: {
    label: "Path Payment",
    icon: ArrowUpRight,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  path_payment_strict_receive: {
    label: "Path Payment",
    icon: ArrowDownRight,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  account_merge: {
    label: "Account Merge",
    icon: Merge,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  manage_data: {
    label: "Manage Data",
    icon: Database,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
  },
  bump_sequence: {
    label: "Bump Sequence",
    icon: Hash,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  invoke_host_function: {
    label: "Smart Contract",
    icon: Code,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  manage_sell_offer: {
    label: "Sell Offer",
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  manage_buy_offer: {
    label: "Buy Offer",
    icon: ArrowDownRight,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  create_passive_sell_offer: {
    label: "Passive Offer",
    icon: ArrowUpRight,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  set_options: {
    label: "Set Options",
    icon: Settings,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  allow_trust: {
    label: "Allow Trust",
    icon: Link,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  // Default fallback
  unknown: {
    label: "Operation",
    icon: HelpCircle,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
}

// Token logo map - reuse from transaction-history
export const ASSET_LOGO_MAP: Record<string, string> = {
  USDC: "/tokens/usdc.png",
  USDT: "/tokens/usdc.png",
  XLM: "/tokens/xlm.png",
  AQUA: "/tokens/aqua.png",
  EURC: "/tokens/eurc.png",
  CETES: "/tokens/cetes.png",
  USDGLO: "/tokens/usdglo.png",
  USTRY: "/tokens/ustry.png",
  BLND: "/tokens/blnd.png",
  EURX: "/tokens/eurx.png",
  GBPX: "/tokens/gbpx.png",
  OUSD: "/tokens/ousd.png",
  PYUSD: "/tokens/pyusd.png",
  USDX: "/tokens/usdx.png",
}
