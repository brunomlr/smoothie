'use client'

import * as React from 'react'
import { CurrencyCode, SUPPORTED_CURRENCIES } from '@/lib/currency/types'
import { getExchangeRate, convertFromUsd } from '@/lib/currency/exchange-rates'
import { formatCurrency, FormatCurrencyOptions } from '@/lib/currency/format'
import posthog from 'posthog-js'

const STORAGE_KEY = 'smoothie-currency-preference'

export interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (code: CurrencyCode) => void
  exchangeRate: number
  isLoading: boolean
  error: string | null
  convert: (amountUsd: number) => number
  format: (amountUsd: number, options?: FormatCurrencyOptions) => string
}

const CurrencyContext = React.createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = React.useState<CurrencyCode>('USD')
  const [exchangeRate, setExchangeRate] = React.useState<number>(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Load preference from localStorage on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) {
      setCurrencyState(saved as CurrencyCode)
    }
    setIsInitialized(true)
  }, [])

  // Fetch exchange rate when currency changes
  React.useEffect(() => {
    if (!isInitialized) return

    // USD is always 1, no need to fetch
    if (currency === 'USD') {
      setExchangeRate(1)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getExchangeRate(currency)
      .then(rate => {
        if (!cancelled) {
          setExchangeRate(rate)
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch exchange rate')
          setIsLoading(false)
          // Keep previous rate or default to 1
        }
      })

    return () => {
      cancelled = true
    }
  }, [currency, isInitialized])

  const setCurrency = React.useCallback((code: CurrencyCode) => {
    setCurrencyState(code)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code)
    }
    // Track currency change event and set user property
    if (typeof window !== 'undefined') {
      posthog.capture('currency_changed', {
        currency_code: code,
        // $set updates user properties in PostHog
        $set: { preferred_currency: code },
      })
    }
  }, [])

  const convert = React.useCallback(
    (amountUsd: number) => convertFromUsd(amountUsd, exchangeRate),
    [exchangeRate]
  )

  const format = React.useCallback(
    (amountUsd: number, options?: FormatCurrencyOptions) => {
      const converted = convertFromUsd(amountUsd, exchangeRate)
      return formatCurrency(converted, currency, options)
    },
    [exchangeRate, currency]
  )

  const value = React.useMemo(
    () => ({
      currency,
      setCurrency,
      exchangeRate,
      isLoading,
      error,
      convert,
      format,
    }),
    [currency, setCurrency, exchangeRate, isLoading, error, convert, format]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrencyContext(): CurrencyContextValue {
  const context = React.useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrencyContext must be used within a CurrencyProvider')
  }
  return context
}
