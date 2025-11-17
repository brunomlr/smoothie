"use client"

import * as React from "react"
import { Eye, Check, AlertCircle } from "lucide-react"
import { StrKey } from "@stellar/stellar-sdk"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface FollowAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddressSubmit: (address: string) => void
}

export function FollowAddressModal({
  open,
  onOpenChange,
  onAddressSubmit,
}: FollowAddressModalProps) {
  const [address, setAddress] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isValidating, setIsValidating] = React.useState(false)

  const validateAddress = (addr: string): boolean => {
    if (!addr || typeof addr !== "string") {
      return false
    }
    // Use Stellar SDK's built-in validation
    try {
      return StrKey.isValidEd25519PublicKey(addr.trim())
    } catch {
      return false
    }
  }

  React.useEffect(() => {
    if (open) {
      setAddress("")
      setError(null)
    }
  }, [open])

  const handleSubmit = () => {
    const trimmedAddress = address.trim()
    if (!trimmedAddress) {
      setError("Please enter an address")
      return
    }

    setIsValidating(true)
    // Small delay for better UX
    setTimeout(() => {
      if (!validateAddress(trimmedAddress)) {
        setError("Invalid Stellar address format. Please enter a valid Stellar public key (starts with 'G' and is 56 characters long).")
        setIsValidating(false)
        return
      }

      setError(null)
      onAddressSubmit(trimmedAddress)
      onOpenChange(false)
      setAddress("")
      setIsValidating(false)
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && address.trim() && !isValidating) {
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Follow a Public Address
          </DialogTitle>
          <DialogDescription className="text-base">
            Enter a Stellar public address to view its balances and activity
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <label 
              htmlFor="address" 
              className="text-sm font-semibold text-foreground"
            >
              Stellar Address
            </label>
            <div className="relative">
              <Input
                id="address"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="G..."
                className={cn(
                  "h-12 font-mono text-sm",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={isValidating}
              />
              {address.trim() && !error && validateAddress(address.trim()) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              )}
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {address.trim() && !error && validateAddress(address.trim()) && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Valid Stellar address format</span>
              </div>
            )}
          </div>
          <Separator />
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">Read-only access</div>
              <div className="text-sm text-muted-foreground">
                You can view balances and activity without connecting your wallet. This is safe and doesn't require any permissions.
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isValidating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!address.trim() || isValidating || !!error}
            className="min-w-[120px]"
          >
            {isValidating ? "Validating..." : "Follow Address"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

