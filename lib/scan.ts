import { CONFIG } from "@/lib/config";
import { buildDisagreements } from "@/lib/disagreement";
import { fetchKalshiMarkets } from "@/lib/kalshi";
import { upsertHistory } from "@/lib/history";
import { matchMarkets } from "@/lib/match";
import { fetchPolymarketMarkets } from "@/lib/polymarket";
import { fetchPredictItMarkets } from "@/lib/predictit";
import { getStore, KEYS } from "@/lib/store";
import type {
  Disagreement,
  NormalizedMarket,
  OpportunityHistory,
  ScanDiagnostics,
  ScanResult,
  Venue,
} from "@/lib/types";

interface VenueSource {
  venue: Venue;
  fetch: () => Promise<NormalizedMarket[]>;
}

const SOURCES: VenueSource[] = [
  { venue: "polymarket", fetch: () => fetchPolymarketMarkets(CONFIG.maxMarkets) },
  { venue: "kalshi", fetch: () => fetchKalshiMarkets(CONFIG.maxMarkets) },
  { venue: "predictit", fetch: () => fetchPredictItMarkets() },
];

/** Fetch and pool markets from every venue (fault-tolerant via allSettled). */
async function fetchPool(): Promise<{
  pool: NormalizedMarket[];
  counts: Partial<Record<Venue, number>>;
  errors: Partial<Record<Venue, string>>;
}> {
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

  return { pool, counts, errors };
}

/**
 * Run a full cross-venue arbitrage scan. Collects opportunities down to the
 * discovery floor (the client filters interactively) and attaches data-quality
 * diagnostics for the validation dashboard.
 */
export async function scanOpportunities(): Promise<ScanResult> {
  const { pool, counts, errors } = await fetchPool();

  const { opportunities, diagnostics: matchDiag } = matchMarkets(pool, {
    minMargin: CONFIG.discoveryMargin,
    matchThreshold: CONFIG.discoveryMatchThreshold,
  });

  const margins = opportunities.map((o) => o.netMargin);
  const aboveThreshold = opportunities.filter(
    (o) => o.netMargin >= CONFIG.minMargin,
  ).length;

  const diagnostics: ScanDiagnostics = {
    marketsScanned: pool.length,
    marketsByVenue: counts,
    venuesScanned: Object.values(counts).filter((c) => (c ?? 0) > 0).length,
    match: matchDiag,
    opportunitiesFound: opportunities.length,
    opportunitiesAboveThreshold: aboveThreshold,
    averageMargin: margins.length
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : null,
    largestMargin: margins.length ? Math.max(...margins) : null,
  };

  return {
    opportunities,
    counts,
    marketsScanned: pool.length,
    venuesScanned: diagnostics.venuesScanned,
    diagnostics,
    errors,
    config: { minMargin: CONFIG.minMargin, matchThreshold: CONFIG.matchThreshold },
    generatedAt: new Date().toISOString(),
  };
}

export interface DisagreementScan {
  disagreements: Disagreement[];
  counts: Partial<Record<Venue, number>>;
  errors: Partial<Record<Venue, string>>;
  generatedAt: string;
}

/** Run the market-disagreement scan (Step 4). Shares cached upstream fetches. */
export async function scanDisagreements(): Promise<DisagreementScan> {
  const { pool, counts, errors } = await fetchPool();
  const disagreements = buildDisagreements(pool, CONFIG.discoveryMatchThreshold);
  return { disagreements, counts, errors, generatedAt: new Date().toISOString() };
}

/**
 * Persist a scan into the opportunity-history store and append a diagnostics
 * snapshot. Driven by the cron endpoint so appearance counts track time.
 */
export async function recordScan(result: ScanResult): Promise<void> {
  const store = getStore();

  const history =
    (await store.getJSON<Record<string, OpportunityHistory>>(KEYS.history)) ?? {};
  const updated = upsertHistory(history, result.opportunities, result.generatedAt);
  await store.setJSON(KEYS.history, updated);

  const snapshots =
    (await store.getJSON<{ at: string; diagnostics: ScanDiagnostics }[]>(
      KEYS.diagnostics,
    )) ?? [];
  snapshots.push({ at: result.generatedAt, diagnostics: result.diagnostics });
  // Keep the most recent 500 snapshots.
  await store.setJSON(KEYS.diagnostics, snapshots.slice(-500));
}
