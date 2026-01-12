"use client"

import { Badge } from "@/components/ui/badge"
import type { WalletOperation } from "@/app/api/wallet-operations/route"
import { OPERATION_CONFIG } from "./constants"

interface OperationBadgeProps {
  operation: WalletOperation
  currentUserAddress?: string
}

export function OperationBadge({ operation, currentUserAddress }: OperationBadgeProps) {
  const config = OPERATION_CONFIG[operation.type] || OPERATION_CONFIG.unknown
  const Icon = config.icon

  // For payment operations, customize the label based on direction
  let label = config.label
  if (operation.type === "payment" && currentUserAddress) {
    const isReceiving = operation.to === currentUserAddress
    label = isReceiving ? "Received" : "Sent"
  }

  // For trustline changes, customize based on limit
  if (operation.type === "change_trust") {
    const isAdding = operation.limit && parseFloat(operation.limit) > 0
    label = isAdding ? "Added Trustline" : "Removed Trustline"
  }

  return (
    <Badge variant="secondary" className={`${config.bgColor} ${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
