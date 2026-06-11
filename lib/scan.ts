import {
  type AnalyticsSnapshot,
  buildSnapshot,
  summarizeExecutable,
} from "@/lib/analytics";
import { CONFIG } from "@/lib/config";
import { buildDisagreements } from "@/lib/disagreement";
import { priceOpportunity } from "@/lib/executable";
import { fetchKalshiMarkets } from "@/lib/kalshi";
import { upsertHistory } from "@/lib/history";
import { matchMarkets } from "@/lib/match";
import { fetchPolymarketMarkets } from "@/lib/polymarket";
import { fetchPredictItMarkets } from "@/lib/predictit";
import { getStore, KEYS } from "@/lib/store";
import type {
  Disagreement,
  ExecutablePricing,
  NormalizedMarket,
  Opportunity,
  OpportunityHistory,
  ScanDiagnostics,
  ScanResult,
  Venue,
} from "@/lib/types";

/** Number of top opportunities to price with live order books per scan. */
const EXECUTABLE_SAMPLE_SIZE = 8;

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
 * Sample the top opportunities and price them with live order books, then
 * summarize. Bounded to keep within rate limits and function duration; books
 * that can't be fetched count toward `missingBook`.
 */
async function sampleExecutable(opportunities: Opportunity[]) {
  const sample = opportunities.slice(0, EXECUTABLE_SAMPLE_SIZE);
  const priced = await Promise.all(
    sample.map(async (opportunity) => {
      let pricing: ExecutablePricing;
      try {
        pricing = await priceOpportunity(opportunity);
      } catch {
        pricing = {
          available: false,
          indicativeMargin: opportunity.netMargin,
          executableMargin: null,
          maxStake: null,
          maxSize: null,
          legs: [],
          note: "pricing failed",
        };
      }
      return { opportunity, pricing };
    }),
  );
  return summarizeExecutable(priced);
}

/**
 * Persist a scan: update opportunity history and append a full analytics
 * snapshot (including a sampled executable summary). Driven by the cron
 * endpoint so appearance counts and metrics track time.
 */
export async function recordScan(result: ScanResult): Promise<void> {
  const store = getStore();

  const history =
    (await store.getJSON<Record<string, OpportunityHistory>>(KEYS.history)) ?? {};
  const updated = upsertHistory(history, result.opportunities, result.generatedAt);
  await store.setJSON(KEYS.history, updated);

  const executable = await sampleExecutable(result.opportunities);
  const snapshot = buildSnapshot(result, executable);

  const snapshots =
    (await store.getJSON<AnalyticsSnapshot[]>(KEYS.analytics)) ?? [];
  snapshots.push(snapshot);
  // Keep the most recent 1000 snapshots (~6 weeks at hourly).
  await store.setJSON(KEYS.analytics, snapshots.slice(-1000));
}
