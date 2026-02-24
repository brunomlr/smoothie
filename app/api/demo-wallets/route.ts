/**
 * Demo Wallets API Route
 * Returns list of available demo wallets without exposing real addresses
 */

import { createApiHandler, CACHE_CONFIGS } from '@/lib/api'
import {
  getDemoWalletList,
  getRandomDemoWalletAlias,
  isDemoWalletConfigured,
} from '@/lib/config/demo-wallet-server'

interface DemoWalletInfo {
  id: string
  name: string
}

interface DemoWalletsResponse {
  wallets: DemoWalletInfo[]
  randomAlias: string | null
  enabled: boolean
}

export const GET = createApiHandler<DemoWalletsResponse>({
  logPrefix: '[Demo Wallets API]',
  cache: CACHE_CONFIGS.LONG,

  async handler() {
    const wallets = getDemoWalletList()
    const randomAlias = getRandomDemoWalletAlias()
    const enabled = isDemoWalletConfigured()

    return {
      wallets,
      randomAlias,
      enabled,
    }
  },
})
