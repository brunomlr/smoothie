"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LandingPage } from "@/components/landing-page"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useWalletState } from "@/hooks/use-wallet-state"

interface AuthenticatedPageProps {
  children: React.ReactNode
  onRefresh?: () => Promise<void>
  error?: Error | null
  /** When false, renders children without DashboardLayout wrapper */
  withLayout?: boolean
}

export function AuthenticatedPage({
  children,
  onRefresh,
  error,
  withLayout = true,
}: AuthenticatedPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    wallets,
    activeWallet,
    handleSelectWallet,
    handleConnectWallet,
    handleConnectDemoWallet,
    handleDisconnect,
    isHydrated,
  } = useWalletState()

  // Redirect to landing if no wallet (except on landing itself)
  useEffect(() => {
    if (isHydrated && !activeWallet && pathname !== '/') {
      router.replace('/')
    }
  }, [isHydrated, activeWallet, pathname, router])

  // Wait for hydration before deciding what to show
  if (!isHydrated) {
    return null
  }

  // Show landing page ONLY if on landing route
  if (!activeWallet && pathname === '/') {
    return (
      <LandingPage
        wallets={wallets}
        activeWallet={activeWallet}
        onSelectWallet={handleSelectWallet}
        onConnectWallet={handleConnectWallet}
        onConnectDemoWallet={handleConnectDemoWallet}
        onDisconnect={handleDisconnect}
        isHydrated={isHydrated}
      />
    )
  }

  // Show nothing if no wallet (will redirect)
  if (!activeWallet) {
    return null
  }

  if (!withLayout) {
    // Support pull-to-refresh even without DashboardLayout
    if (onRefresh) {
      return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>
    }
    return <>{children}</>
  }

  return (
    <DashboardLayout onRefresh={onRefresh} error={error}>
      {children}
    </DashboardLayout>
  )
}
