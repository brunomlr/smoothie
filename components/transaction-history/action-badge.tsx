"use client"

import { Badge } from "@/components/ui/badge"
import type { UserAction } from "@/lib/db/types"
import { ACTION_CONFIG } from "./constants"

interface ActionBadgeProps {
  action: UserAction
  currentUserAddress?: string
}

export function ActionBadge({ action, currentUserAddress }: ActionBadgeProps) {
  const config = ACTION_CONFIG[action.action_type] || ACTION_CONFIG.supply
  const Icon = config.icon

  // For fill_auction, show different label based on user's role
  let label = config.label
  if (action.action_type === "fill_auction" && currentUserAddress) {
    const isLiquidator = action.filler_address === currentUserAddress
    label = isLiquidator ? "Filled Liquidation" : "Liquidated"
  }

  return (
    <Badge variant="secondary" className={`${config.bgColor} ${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
