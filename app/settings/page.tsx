"use client"

import { Suspense, useEffect } from "react"
import { CurrencySelector } from "@/components/currency-selector"
import { Switch } from "@/components/ui/switch"
import { useCurrencyPreference } from "@/hooks/use-currency-preference"
import { useDisplayPreferences } from "@/contexts/display-preferences-context"
import { useAnalytics } from "@/hooks/use-analytics"
import { AuthenticatedPage } from "@/components/authenticated-page"
import { PageLoadingShell } from "@/components/page-loading-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { PageTitle } from "@/components/page-title"

function SettingsContent() {
  const { capture } = useAnalytics()
  const { currency, setCurrency } = useCurrencyPreference()
  const { preferences, setShowPriceChanges, setUseHistoricalBlndPrices } = useDisplayPreferences()

  // Track page view
  useEffect(() => {
    capture('page_viewed', { page: 'settings' })
  }, [capture])

  return (
    <AuthenticatedPage>
      <div>
        <PageTitle>Settings</PageTitle>

        <div className="space-y-4">
          {/* Currency Section */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium">Display Currency</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose your preferred currency for displaying values
                </p>
              </div>
              <CurrencySelector value={currency} onChange={setCurrency} />
            </div>
          </div>

          {/* Price Changes Toggle */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="setting-price-changes" className="text-sm font-medium">Include price changes in earnings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, earnings include asset price changes. When disabled, only protocol yield at current price is shown.
                </p>
              </div>
              <Switch
                checked={preferences.showPriceChanges}
                onCheckedChange={setShowPriceChanges}
                aria-labelledby="setting-price-changes"
              />
            </div>
          </div>

          {/* BLND Historical Prices Toggle */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="setting-blnd-prices" className="text-sm font-medium">Use historical BLND prices</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, claimed BLND is valued at the price when claimed. When disabled, all BLND uses current price.
                </p>
              </div>
              <Switch
                checked={preferences.useHistoricalBlndPrices}
                onCheckedChange={setUseHistoricalBlndPrices}
                aria-labelledby="setting-blnd-prices"
              />
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedPage>
  )
}

function SettingsLoading() {
  return (
    <PageLoadingShell>
      {/* Settings cards skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageLoadingShell>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}
