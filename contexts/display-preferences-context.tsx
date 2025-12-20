'use client'

import * as React from 'react'

const STORAGE_KEY = 'smoothie-display-preferences'

export interface DisplayPreferences {
  showPriceChanges: boolean
  useHistoricalBlndPrices: boolean
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  showPriceChanges: false,
  useHistoricalBlndPrices: true,
}

export interface DisplayPreferencesContextValue {
  preferences: DisplayPreferences
  setShowPriceChanges: (value: boolean) => void
  setUseHistoricalBlndPrices: (value: boolean) => void
}

const DisplayPreferencesContext = React.createContext<DisplayPreferencesContextValue | null>(null)

export function DisplayPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<DisplayPreferences>(DEFAULT_PREFERENCES)
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Load preferences from localStorage on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setPreferences(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // Ignore parse errors
    }
    setIsInitialized(true)
  }, [])

  // Save to localStorage when preferences change
  React.useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences, isInitialized])

  const setShowPriceChanges = React.useCallback((value: boolean) => {
    setPreferences(prev => ({ ...prev, showPriceChanges: value }))
  }, [])

  const setUseHistoricalBlndPrices = React.useCallback((value: boolean) => {
    setPreferences(prev => ({ ...prev, useHistoricalBlndPrices: value }))
  }, [])

  const value = React.useMemo(
    () => ({
      preferences,
      setShowPriceChanges,
      setUseHistoricalBlndPrices,
    }),
    [preferences, setShowPriceChanges, setUseHistoricalBlndPrices]
  )

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  )
}

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const context = React.useContext(DisplayPreferencesContext)
  if (!context) {
    throw new Error('useDisplayPreferences must be used within a DisplayPreferencesProvider')
  }
  return context
}
