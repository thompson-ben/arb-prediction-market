import { CONFIG } from "@/lib/config";
import { persistDisagreements, persistScan } from "@/lib/db";
import { disagreementRow, matchRow, snapshotRow } from "@/lib/dbmap";
import { buildDisagreements } from "@/lib/disagreement";
import { opportunityKey } from "@/lib/history";
import { priceOpportunity } from "@/lib/executable";
import { fetchKalshiMarkets } from "@/lib/kalshi";
import { matchMarkets } from "@/lib/match";
import { fetchPolymarketMarkets } from "@/lib/polymarket";
import { fetchPredictItMarkets } from "@/lib/predictit";
import type {
  Disagreement,
  ExecutablePricing,
  NormalizedMarket,
  Opportunity,
  ScanDiagnostics,
  ScanResult,
  Venue,
} from "@/lib/types";

/** Number of top opportunities to price with live order books per scan. */
const EXECUTABLE_SAMPLE_SIZE = 8;
/** Max opportunities snapshotted per scan (top by score) to bound DB growth. */
const MAX_SNAPSHOTS_PER_SCAN = Number(process.env.MAX_SNAPSHOTS ?? 250);

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
 * Price the top opportunities with live order books, returning a map keyed by
 * opportunity id so the corresponding snapshots can carry executable fields.
 * Bounded to respect rate limits and function duration.
 */
async function sampleExecutable(
  opportunities: Opportunity[],
): Promise<Map<string, ExecutablePricing>> {
  const sample = opportunities.slice(0, EXECUTABLE_SAMPLE_SIZE);
  const out = new Map<string, ExecutablePricing>();
  await Promise.all(
    sample.map(async (opportunity) => {
      try {
        out.set(opportunityKey(opportunity), await priceOpportunity(opportunity));
      } catch {
        /* leave unsampled — snapshot executable fields stay null */
      }
    }),
  );
  return out;
}

/**
 * Persist a scan to Supabase (system of record): upsert the matched-pair
 * identities and insert one opportunity snapshot per opportunity (top
 * MAX_SNAPSHOTS_PER_SCAN by score), with executable fields filled for the
 * sampled subset. No-ops when Supabase isn't configured.
 */
export async function recordScan(result: ScanResult): Promise<void> {
  const scanAt = result.generatedAt;
  const pricings = await sampleExecutable(result.opportunities);

  const tracked = result.opportunities.slice(0, MAX_SNAPSHOTS_PER_SCAN);
  const matches = tracked.map((o) => matchRow(o, scanAt));
  const snapshots = tracked.map((o) =>
    snapshotRow(o, scanAt, pricings.get(opportunityKey(o))),
  );

  await persistScan(matches, snapshots);
}

/** Persist a disagreement scan to Supabase. */
export async function recordDisagreements(scan: DisagreementScan): Promise<void> {
  const rows = scan.disagreements.map((d) => disagreementRow(d, scan.generatedAt));
  await persistDisagreements(rows);
}
