"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWalletState } from "@/hooks/use-wallet-state"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { activeWallet, isHydrated } = useWalletState()

  useEffect(() => {
    if (isHydrated && !activeWallet) {
      router.replace('/')
    }
  }, [isHydrated, activeWallet, router])

  // Don't render anything until hydration complete
  if (!isHydrated) {
    return null
  }

  // Don't render if no wallet (will redirect)
  if (!activeWallet) {
    return null
  }

  return <>{children}</>
}
