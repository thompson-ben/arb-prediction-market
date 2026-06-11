import { CONFIG } from "@/lib/config";
import { fetchKalshiMarkets } from "@/lib/kalshi";
import { buildOpportunities } from "@/lib/match";
import { fetchPolymarketMarkets } from "@/lib/polymarket";
import { fetchPredictItMarkets } from "@/lib/predictit";
import type { NormalizedMarket, ScanResult, Venue } from "@/lib/types";

interface VenueSource {
  venue: Venue;
  fetch: () => Promise<NormalizedMarket[]>;
}

const SOURCES: VenueSource[] = [
  { venue: "polymarket", fetch: () => fetchPolymarketMarkets(CONFIG.maxMarkets) },
  { venue: "kalshi", fetch: () => fetchKalshiMarkets(CONFIG.maxMarkets) },
  { venue: "predictit", fetch: () => fetchPredictItMarkets() },
];

/**
 * Run a full cross-venue scan: pull markets from every source in parallel,
 * pool them, match across venues, and return arbitrage opportunities at or
 * above the configured minimum net margin.
 *
 * Uses `allSettled` so a single venue outage degrades gracefully (its markets
 * are simply absent) rather than failing the entire scan.
 */
export async function scanOpportunities(): Promise<
  ScanResult & { errors: Partial<Record<Venue, string>> }
> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetch()));

  const pool: NormalizedMarket[] = [];
  const counts: Partial<Record<Venue, number>> = {};
  const errors: Partial<Record<Venue, string>> = {};

  settled.forEach((result, i) => {
    const { venue } = SOURCES[i];
    if (result.status === "fulfilled") {
      pool.push(...result.value);
      counts[venue] = result.value.length;
    } else {
      counts[venue] = 0;
      errors[venue] =
        result.reason instanceof Error ? result.reason.message : "fetch failed";
    }
  });

  const opportunities = buildOpportunities(pool, {
    minMargin: CONFIG.minMargin,
    matchThreshold: CONFIG.matchThreshold,
  });

  return {
    opportunities,
    counts,
    config: { minMargin: CONFIG.minMargin, matchThreshold: CONFIG.matchThreshold },
    generatedAt: new Date().toISOString(),
    errors,
  };
}
