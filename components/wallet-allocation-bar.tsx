"use client"

import { useMemo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { WalletAvatar } from "@/components/wallet-avatar"
import { useWalletAvatarCustomization, AVATAR_GRADIENTS } from "@/hooks/use-wallet-avatar-customization"
import { useWalletCustomNames } from "@/hooks/use-wallet-custom-names"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import type { Wallet } from "@/types/wallet"

// Default colors for wallets without customization (cycle through)
const DEFAULT_WALLET_COLORS = [
  "#ec4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#F97316", // Orange
]

interface WalletAllocation {
  walletId: string
  publicKey: string
  name: string
  totalValue: number
  percentage: number
  color: string
}

interface WalletAllocationBarProps {
  wallets: Wallet[]
  perWalletTotals: Array<{
    walletId: string
    publicKey: string
    totalUsdValue: number
  }>
  isLoading?: boolean
}

function formatPercentage(value: number): string {
  if (value < 1) return "<1%"
  return `${Math.round(value)}%`
}

export function WalletAllocationBar({
  wallets,
  perWalletTotals,
  isLoading = false,
}: WalletAllocationBarProps) {
  const { format: formatInCurrency } = useCurrencyPreference()
  const { getCustomization } = useWalletAvatarCustomization()
  const { getDisplayName } = useWalletCustomNames()

  const formatUsd = (value: number) =>
    formatInCurrency(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const { allocations } = useMemo(() => {
    // Calculate total value
    let total = 0
    for (const wallet of perWalletTotals) {
      total += wallet.totalUsdValue
    }

    // Build allocation data
    const allocs: WalletAllocation[] = perWalletTotals
      .filter((w) => w.totalUsdValue > 0)
      .map((walletTotal, index) => {
        const wallet = wallets.find((w) => w.id === walletTotal.walletId)
        const customization = wallet ? getCustomization(wallet.id) : null

        // Get color: from customization gradient, or default color
        let color: string
        if (customization) {
          const gradient = AVATAR_GRADIENTS.find((g) => g.id === customization.gradientId)
          color = gradient?.colors[0] ?? DEFAULT_WALLET_COLORS[index % DEFAULT_WALLET_COLORS.length]
        } else {
          color = DEFAULT_WALLET_COLORS[index % DEFAULT_WALLET_COLORS.length]
        }

        return {
          walletId: walletTotal.walletId,
          publicKey: walletTotal.publicKey,
          name: wallet ? getDisplayName(wallet) : walletTotal.publicKey.slice(0, 8),
          totalValue: walletTotal.totalUsdValue,
          percentage: total > 0 ? (walletTotal.totalUsdValue / total) * 100 : 0,
          color,
        }
      })
      .sort((a, b) => b.totalValue - a.totalValue)

    return { allocations: allocs, totalValue: total }
  }, [perWalletTotals, wallets, getCustomization, getDisplayName])

  // Don't show if only one wallet or no data
  if (isLoading || allocations.length <= 1) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Wallet icons row */}
        <div className="relative h-6 flex items-center">
          {allocations.map((allocation, index) => {
            const wallet = wallets.find((w) => w.id === allocation.walletId)
            if (!wallet) return null

            // Calculate position based on cumulative percentage
            let cumulativePercent = 0
            for (let i = 0; i < index; i++) {
              cumulativePercent += allocations[i].percentage
            }

            // Only show icon if segment is large enough
            const showIcon = allocation.percentage >= 8

            if (!showIcon) return null

            return (
              <Tooltip key={allocation.walletId}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute flex items-center cursor-pointer"
                    style={{
                      left: `${cumulativePercent + allocation.percentage / 2}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <WalletAvatar
                      address={wallet.publicKey}
                      name={wallet.name}
                      size="sm"
                      customization={getCustomization(wallet.id)}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="font-medium">{allocation.name}</div>
                  <div className="text-zinc-400">
                    {formatPercentage(allocation.percentage)} of total
                  </div>
                  <div className="mt-1">{formatUsd(allocation.totalValue)}</div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Allocation bar */}
        <div className="relative h-2 flex rounded-sm overflow-hidden">
          {allocations.map((allocation, index) => {
            const wallet = wallets.find((w) => w.id === allocation.walletId)
            const isNewSegment = index > 0

            return (
              <Tooltip key={allocation.walletId}>
                <TooltipTrigger asChild>
                  <div
                    className="h-full transition-opacity hover:opacity-80 cursor-pointer"
                    style={{
                      width: `${allocation.percentage}%`,
                      backgroundColor: allocation.color,
                      borderLeft: isNewSegment ? "2px solid var(--background)" : undefined,
                      minWidth: allocation.percentage > 0 ? 2 : 0,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2 font-medium">
                    {wallet && (
                      <WalletAvatar
                        address={wallet.publicKey}
                        name={wallet.name}
                        size="sm"
                        customization={getCustomization(wallet.id)}
                      />
                    )}
                    {allocation.name}
                  </div>
                  <div className="text-zinc-400 mt-1">
                    {formatUsd(allocation.totalValue)} ({formatPercentage(allocation.percentage)})
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
