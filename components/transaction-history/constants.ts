/**
 * Transaction History Constants
 *
 * Configuration for action types and display settings.
 */

import {
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  RefreshCw,
  Gavel,
  AlertTriangle,
  Shield,
  Clock,
  XCircle,
} from "lucide-react"
import type { ActionType } from "@/lib/db/types"
import type { ActionTypeOption, ActionConfig } from "./types"

// LP token address for BLND-USDC Comet pool (used for backstop LP price lookup)
export const LP_TOKEN_ADDRESS = 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM'

// Token logo map - matches the one in use-blend-positions.ts
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
}

// All available action types for filtering
export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  { value: "supply", label: "Supply" },
  { value: "supply_collateral", label: "Add Collateral" },
  { value: "withdraw", label: "Withdraw" },
  { value: "withdraw_collateral", label: "Withdraw Collateral" },
  { value: "borrow", label: "Borrow" },
  { value: "repay", label: "Repay" },
  { value: "claim", label: "Claim BLND" },
  { value: "new_auction", label: "Liquidation Started" },
  { value: "fill_auction", label: "Liquidation" },
  { value: "delete_auction", label: "Liquidation Cancelled" },
  // Backstop actions
  { value: "backstop_deposit", label: "Backstop Deposit" },
  { value: "backstop_withdraw", label: "Backstop Withdraw" },
  { value: "backstop_queue_withdrawal", label: "Queue Withdrawal" },
  { value: "backstop_dequeue_withdrawal", label: "Cancel Queue" },
  { value: "backstop_claim", label: "Backstop Claim" },
]

// Action type display configuration
export const ACTION_CONFIG: Record<ActionType, ActionConfig> = {
  supply: {
    label: "Supplied",
    icon: ArrowDownRight,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  supply_collateral: {
    label: "Added Collateral",
    icon: ArrowDownRight,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  withdraw: {
    label: "Withdrew",
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  withdraw_collateral: {
    label: "Withdrew Collateral",
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  borrow: {
    label: "Borrowed",
    icon: ArrowUpRight,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  repay: {
    label: "Repaid",
    icon: ArrowDownRight,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  claim: {
    label: "Claimed BLND",
    icon: Flame,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  liquidate: {
    label: "Liquidated",
    icon: RefreshCw,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  new_auction: {
    label: "Liquidation Started",
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  fill_auction: {
    label: "Liquidation",
    icon: Gavel,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  delete_auction: {
    label: "Liquidation Cancelled",
    icon: RefreshCw,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  // Backstop actions
  backstop_deposit: {
    label: "Backstop Deposit",
    icon: Shield,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  backstop_withdraw: {
    label: "Backstop Withdraw",
    icon: Shield,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  backstop_queue_withdrawal: {
    label: "Queued Withdrawal",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  backstop_dequeue_withdrawal: {
    label: "Cancelled Queue",
    icon: XCircle,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  backstop_claim: {
    label: "Backstop Claim",
    icon: Flame,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
}
