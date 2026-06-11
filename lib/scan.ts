import { CONFIG } from "@/lib/config";
import { fetchKalshiMarkets } from "@/lib/kalshi";
import { buildOpportunities } from "@/lib/match";
import { fetchPolymarketMarkets } from "@/lib/polymarket";
import type { ScanResult } from "@/lib/types";

/**
 * Run a full cross-venue scan: pull markets from both venues in parallel,
 * match them, and return the arbitrage opportunities at or above the
 * configured minimum margin.
 */
export async function scanOpportunities(): Promise<ScanResult> {
  const [polymarket, kalshi] = await Promise.all([
    fetchPolymarketMarkets(CONFIG.maxMarkets),
    fetchKalshiMarkets(CONFIG.maxMarkets),
  ]);

  const opportunities = buildOpportunities(polymarket, kalshi, {
    minMargin: CONFIG.minMargin,
    matchThreshold: CONFIG.matchThreshold,
  });

  return {
    opportunities,
    counts: { polymarket: polymarket.length, kalshi: kalshi.length },
    config: { minMargin: CONFIG.minMargin, matchThreshold: CONFIG.matchThreshold },
    generatedAt: new Date().toISOString(),
  };
}
