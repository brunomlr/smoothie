"use client"

import { Coins, Gift } from "lucide-react"
import { useTokenBalance } from "@/hooks/use-token-balance"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FormattedBalance } from "@/components/formatted-balance"

// BLND token contract ID on mainnet
const BLND_TOKEN_CONTRACT_ID = "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY"

interface BlndBalanceCardProps {
  walletAddress: string | undefined
  redeemableAmount?: number
}

function formatNumber(value: number | string, decimals = 4): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (!Number.isFinite(num)) {
    return "0.00"
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function BlndBalanceCard({
  walletAddress,
  redeemableAmount = 0,
}: BlndBalanceCardProps) {
  const { data: blndBalance, isLoading } = useTokenBalance(
    BLND_TOKEN_CONTRACT_ID,
    walletAddress
  )

  // Convert balance from string (with 7 decimals) to number
  const balanceNumber = blndBalance
    ? parseFloat(blndBalance) / 1e7
    : 0

  const hasRedeemable = redeemableAmount > 0
  const formattedBalance = formatNumber(balanceNumber, 4)
  const formattedRedeemable = formatNumber(redeemableAmount, 4)

  return (
    <Card className="@container/card border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          BLND Balance
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-amber-600 dark:text-amber-400">
          {isLoading ? "..." : formattedBalance}
        </CardTitle>
        {hasRedeemable && (
          <CardAction>
            <Badge variant="outline" className="border-amber-500/20">
              <Gift className="h-3 w-3 mr-1" />
              {formattedRedeemable} redeemable
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Wallet Balance</span>
            <span className="text-sm font-medium">{formattedBalance} BLND</span>
          </div>
          {hasRedeemable && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Claimable Rewards
              </span>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {formattedRedeemable} BLND
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {hasRedeemable ? (
            <>
              <Gift className="size-4" />
              {formattedRedeemable} BLND to redeem
            </>
          ) : (
            <>
              <Coins className="size-4" />
              {walletAddress
                ? "No rewards available"
                : "Connect wallet to view balance"}
            </>
          )}
        </div>
        <div className="text-muted-foreground">
          {hasRedeemable
            ? "Claim your rewards from Blend positions"
            : walletAddress
              ? "Load positions to see claimable rewards"
              : "Connect wallet and load positions to see rewards"}
        </div>
      </CardFooter>
    </Card>
  )
}








