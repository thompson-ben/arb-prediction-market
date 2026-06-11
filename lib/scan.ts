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
 * pool them, match across venues, and return arbitrage opportunities down to
 * the discovery floor. The client filters this set interactively (and the UI
 * defaults to a 5% margin filter), so the scan collects generously.
 *
 * Uses `allSettled` so a single venue outage degrades gracefully (its markets
 * are simply absent) rather than failing the entire scan.
 */
export async function scanOpportunities(): Promise<ScanResult> {
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
    minMargin: CONFIG.discoveryMargin,
    matchThreshold: CONFIG.discoveryMatchThreshold,
  });

  const marketsScanned = pool.length;
  const venuesScanned = Object.values(counts).filter((c) => (c ?? 0) > 0).length;

  return {
    opportunities,
    counts,
    marketsScanned,
    venuesScanned,
    errors,
    // The UI's *default* filter starts here, not the discovery floor.
    config: { minMargin: CONFIG.minMargin, matchThreshold: CONFIG.matchThreshold },
    generatedAt: new Date().toISOString(),
  };
}
