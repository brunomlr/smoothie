import type { PriceLookupInput, PriceQuote, PriceService } from "./types";

const MOCK_PRICES: Record<string, number> = {
  USDC: 1,
  XLM: 0.12,
  AQUA: 0.004,
  BLND: 0.25,
  // Extend as needed while wiring real price feeds.
};

const DEFAULT_PRICE = 0;

class MockPriceService implements PriceService {
  async getUsdPrice({
    assetId,
    symbol,
  }: PriceLookupInput): Promise<PriceQuote | null> {
    const key = (symbol || "").toUpperCase();
    const price =
      (key && MOCK_PRICES[key]) ||
      MOCK_PRICES[assetId.toUpperCase()] ||
      DEFAULT_PRICE;

    if (price <= 0) {
      return null;
    }

    return {
      assetId,
      symbol,
      usdPrice: price,
      timestamp: Date.now(),
      source: "mock",
    };
  }
}

let singleton: MockPriceService | undefined;

export function getMockPriceService(): PriceService {
  if (!singleton) {
    singleton = new MockPriceService();
  }
  return singleton;
}
