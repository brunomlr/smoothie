'use client'

import { useCurrencyContext, CurrencyContextValue } from '@/contexts/currency-context'
import { FormatCurrencyOptions } from '@/lib/currency/format'

export interface CurrencyPreference {
  currency: CurrencyContextValue['currency']
  setCurrency: CurrencyContextValue['setCurrency']
  exchangeRate: number
  isLoading: boolean
  error: string | null
  convert: (amountUsd: number) => number
  format: (amountUsd: number, options?: FormatCurrencyOptions) => string
}

/**
 * Hook to access the user's currency preference.
 * Uses the CurrencyContext to share state across all components.
 */
export function useCurrencyPreference(): CurrencyPreference {
  return useCurrencyContext()
}
