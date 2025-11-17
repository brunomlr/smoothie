"use client"

import * as React from "react"
import { Wallet, Eye, Cpu, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type WalletConnectionOption = 
  | "follow-address"
  | "connect-wallet"
  | "hardware-wallet"

interface WalletConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOption: (option: WalletConnectionOption) => void
}

const connectionOptions = [
  {
    id: "follow-address" as const,
    icon: Eye,
    title: "Follow a Public Address",
    description: "View balances and activity without connecting",
    iconColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    id: "connect-wallet" as const,
    icon: Wallet,
    title: "Connect a Wallet",
    description: "Connect using xBull, Freighter, Albedo, or other wallets",
    iconColor: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    id: "hardware-wallet" as const,
    icon: Cpu,
    title: "Connect a Hardware Wallet",
    description: "Connect using Ledger or other hardware devices",
    iconColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
]

export function WalletConnectionModal({
  open,
  onOpenChange,
  onSelectOption,
}: WalletConnectionModalProps) {
  const handleOptionClick = (option: WalletConnectionOption) => {
    onSelectOption(option)
    // Keep modal open if it's "connect-wallet" (will open wallet kit modal)
    // Close for other options
    if (option !== "connect-wallet") {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-2xl">Connect to Wallet</DialogTitle>
          <DialogDescription className="text-base">
            Choose how you want to connect to your Stellar wallet
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {connectionOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  "group relative flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-all",
                  "hover:border-primary/50 hover:bg-accent/50 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "active:scale-[0.98]"
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors",
                    option.bgColor,
                    "group-hover:scale-105"
                  )}
                >
                  <Icon className={cn("h-6 w-6", option.iconColor)} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-foreground group-hover:text-primary">
                    {option.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

