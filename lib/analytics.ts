import type {
  ConfidenceBin,
  ExecutablePricing,
  Opportunity,
  OpportunityHistory,
  ReviewDecision,
  ScanResult,
  Venue,
} from "@/lib/types";

// ── Snapshot written by the cron each scan ────────────────────────────────

export interface ExecutableSampleSummary {
  /** Opportunities we attempted to price (top-N). */
  sampled: number;
  /** Sampled opps with a usable book and positive executable margin. */
  executable: number;
  /** Sampled opps with no/incomplete order book. */
  missingBook: number;
  /** Sum of executable margins across `executable` opps. */
  marginSum: number;
  /** Largest executable margin observed. */
  largestMargin: number;
  /** Executable margins keyed by venue pair. */
  byVenuePair: Record<string, { count: number; marginSum: number }>;
}

export interface VenuePairAgg {
  count: number;
  marginSum: number;
  largestMargin: number;
}

export interface AnalyticsSnapshot {
  at: string;
  marketsScanned: number;
  marketsByVenue: Partial<Record<Venue, number>>;
  pairsConsidered: number;
  matchesCreated: number;
  matchesRejected: number;
  confidenceSum: number;
  confidenceHistogram: ConfidenceBin[];
  opportunitiesFound: number;
  opportunitiesAboveThreshold: number;
  averageMargin: number | null;
  largestMargin: number | null;
  /** Above-threshold opportunities by venue pair (indicative margins). */
  byVenuePair: Record<string, VenuePairAgg>;
  executable: ExecutableSampleSummary;
}

export function venuePairKey(venues: Venue[]): string {
  return [...venues].sort().join(" ↔ ");
}

/** Aggregate a batch of sampled executable pricings into a summary. */
export function summarizeExecutable(
  samples: { opportunity: Opportunity; pricing: ExecutablePricing }[],
): ExecutableSampleSummary {
  const summary: ExecutableSampleSummary = {
    sampled: samples.length,
    executable: 0,
    missingBook: 0,
    marginSum: 0,
    largestMargin: 0,
    byVenuePair: {},
  };

  for (const { opportunity, pricing } of samples) {
    if (!pricing.available) {
      summary.missingBook += 1;
      continue;
    }
    if (pricing.executableMargin != null && pricing.executableMargin > 0) {
      summary.executable += 1;
      summary.marginSum += pricing.executableMargin;
      summary.largestMargin = Math.max(summary.largestMargin, pricing.executableMargin);
      const key = venuePairKey(opportunity.venues);
      const cur = summary.byVenuePair[key] ?? { count: 0, marginSum: 0 };
      cur.count += 1;
      cur.marginSum += pricing.executableMargin;
      summary.byVenuePair[key] = cur;
    }
  }
  return summary;
}

/** Build a snapshot from a scan result + executable sample summary. */
export function buildSnapshot(
  scan: ScanResult,
  executable: ExecutableSampleSummary,
): AnalyticsSnapshot {
  const d = scan.diagnostics;
  const byVenuePair: Record<string, VenuePairAgg> = {};
  for (const o of scan.opportunities) {
    if (o.netMargin < scan.config.minMargin) continue;
    const key = venuePairKey(o.venues);
    const cur = byVenuePair[key] ?? { count: 0, marginSum: 0, largestMargin: 0 };
    cur.count += 1;
    cur.marginSum += o.netMargin;
    cur.largestMargin = Math.max(cur.largestMargin, o.netMargin);
    byVenuePair[key] = cur;
  }

  return {
    at: scan.generatedAt,
    marketsScanned: d.marketsScanned,
    marketsByVenue: d.marketsByVenue,
    pairsConsidered: d.match.pairsConsidered,
    matchesCreated: d.match.matchesCreated,
    matchesRejected: d.match.matchesRejected,
    confidenceSum: d.match.confidenceSum,
    confidenceHistogram: d.match.confidenceHistogram,
    opportunitiesFound: d.opportunitiesFound,
    opportunitiesAboveThreshold: d.opportunitiesAboveThreshold,
    averageMargin: d.averageMargin,
    largestMargin: d.largestMargin,
    byVenuePair,
    executable,
  };
}

// ── Aggregations for the analytics dashboard ──────────────────────────────

const dayOf = (iso: string) => iso.slice(0, 10);
const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);
const maxOrNull = (nums: number[]) => (nums.length ? Math.max(...nums) : null);

export interface DailyMetric {
  date: string;
  scans: number;
  marketsScanned: number;
  marketsByVenue: Partial<Record<Venue, number>>;
  matchesGenerated: number;
  matchesApproved: number;
  matchesRejected: number;
  opportunitiesDetected: number;
  opportunitiesAboveThreshold: number;
  executableOpportunities: number;
  averageMargin: number | null;
  averageExecutableMargin: number | null;
  largestMargin: number | null;
  largestExecutableMargin: number | null;
}

/** Per-day metrics (Priority 1). Volume metrics are per-scan averages. */
export function dailyMetrics(
  snapshots: AnalyticsSnapshot[],
  reviews: Record<string, ReviewDecision>,
): DailyMetric[] {
  const byDay = new Map<string, AnalyticsSnapshot[]>();
  for (const s of snapshots) {
    const day = dayOf(s.at);
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(s);
  }

  // Review decisions bucketed by day + status.
  const reviewByDay = new Map<string, { approved: number; rejected: number }>();
  for (const r of Object.values(reviews)) {
    const day = dayOf(r.updatedAt);
    const cur = reviewByDay.get(day) ?? { approved: 0, rejected: 0 };
    if (r.status === "approved") cur.approved += 1;
    else if (r.status === "rejected") cur.rejected += 1;
    reviewByDay.set(day, cur);
  }

  const days = [...new Set([...byDay.keys(), ...reviewByDay.keys()])].sort().reverse();

  return days.map((date) => {
    const snaps = byDay.get(date) ?? [];
    const review = reviewByDay.get(date) ?? { approved: 0, rejected: 0 };

    const byVenue: Partial<Record<Venue, number>> = {};
    for (const venue of ["polymarket", "kalshi", "predictit"] as Venue[]) {
      const vals = snaps.map((s) => s.marketsByVenue[venue] ?? 0);
      if (vals.length) byVenue[venue] = Math.round(avg(vals));
    }

    const execAvgPerScan = snaps
      .filter((s) => s.executable.executable > 0)
      .map((s) => s.executable.marginSum / s.executable.executable);

    return {
      date,
      scans: snaps.length,
      marketsScanned: Math.round(avg(snaps.map((s) => s.marketsScanned))),
      marketsByVenue: byVenue,
      matchesGenerated: Math.round(avg(snaps.map((s) => s.matchesCreated))),
      matchesApproved: review.approved,
      matchesRejected: review.rejected,
      opportunitiesDetected: Math.round(avg(snaps.map((s) => s.opportunitiesFound))),
      opportunitiesAboveThreshold: Math.round(
        avg(snaps.map((s) => s.opportunitiesAboveThreshold)),
      ),
      executableOpportunities: Math.round(avg(snaps.map((s) => s.executable.executable))),
      averageMargin: snaps.some((s) => s.averageMargin != null)
        ? avg(snaps.filter((s) => s.averageMargin != null).map((s) => s.averageMargin!))
        : null,
      averageExecutableMargin: execAvgPerScan.length ? avg(execAvgPerScan) : null,
      largestMargin: maxOrNull(
        snaps.filter((s) => s.largestMargin != null).map((s) => s.largestMargin!),
      ),
      largestExecutableMargin: maxOrNull(
        snaps.map((s) => s.executable.largestMargin).filter((m) => m > 0),
      ),
    };
  });
}

export interface FunnelStage {
  label: string;
  value: number;
  /** Conversion from the previous stage (0–1), or null for the first stage. */
  conversion: number | null;
}

/** Opportunity funnel (Priority 2) using per-scan averages across all snapshots. */
export function funnel(snapshots: AnalyticsSnapshot[]): FunnelStage[] {
  const n = snapshots.length || 1;
  const markets = sum(snapshots.map((s) => s.marketsScanned)) / n;
  const potential = sum(snapshots.map((s) => s.pairsConsidered)) / n;
  const accepted = sum(snapshots.map((s) => s.matchesCreated)) / n;
  const arbitrage = sum(snapshots.map((s) => s.opportunitiesAboveThreshold)) / n;
  const executable = sum(snapshots.map((s) => s.executable.executable)) / n;

  const stages = [
    { label: "Markets Scanned", value: markets },
    { label: "Potential Matches", value: potential },
    { label: "Accepted Matches", value: accepted },
    { label: "Arbitrage Opportunities", value: arbitrage },
    { label: "Executable Arbitrage", value: executable },
  ];

  return stages.map((stage, i) => ({
    label: stage.label,
    value: stage.value,
    conversion: i === 0 ? null : stages[i - 1].value > 0 ? stage.value / stages[i - 1].value : 0,
  }));
}

export interface VenuePairAnalytics {
  pair: string;
  opportunities: number;
  averageMargin: number | null;
  averageExecutableMargin: number | null;
  averageDurationHours: number | null;
  largestMargin: number | null;
}

const HOUR = 1000 * 60 * 60;

/** Per-venue-pair analytics (Priority 3), from history + executable samples. */
export function venuePairAnalytics(
  history: Record<string, OpportunityHistory>,
  snapshots: AnalyticsSnapshot[],
): VenuePairAnalytics[] {
  const byPair = new Map<
    string,
    { peaks: number[]; durations: number[]; largest: number }
  >();

  for (const r of Object.values(history)) {
    const key = venuePairKey(r.venues);
    const entry = byPair.get(key) ?? { peaks: [], durations: [], largest: 0 };
    entry.peaks.push(r.peakMargin);
    entry.largest = Math.max(entry.largest, r.peakMargin);
    const dur = (new Date(r.lastSeen).getTime() - new Date(r.firstSeen).getTime()) / HOUR;
    if (Number.isFinite(dur)) entry.durations.push(Math.max(0, dur));
    byPair.set(key, entry);
  }

  // Executable margins per pair across snapshots.
  const execByPair = new Map<string, { count: number; marginSum: number }>();
  for (const s of snapshots) {
    for (const [pair, agg] of Object.entries(s.executable.byVenuePair)) {
      const cur = execByPair.get(pair) ?? { count: 0, marginSum: 0 };
      cur.count += agg.count;
      cur.marginSum += agg.marginSum;
      execByPair.set(pair, cur);
    }
  }

  const pairs = new Set([...byPair.keys(), ...execByPair.keys()]);
  return [...pairs]
    .map((pair) => {
      const h = byPair.get(pair);
      const e = execByPair.get(pair);
      return {
        pair,
        opportunities: h?.peaks.length ?? 0,
        averageMargin: h && h.peaks.length ? avg(h.peaks) : null,
        averageExecutableMargin: e && e.count > 0 ? e.marginSum / e.count : null,
        averageDurationHours: h && h.durations.length ? avg(h.durations) : null,
        largestMargin: h ? h.largest : null,
      };
    })
    .sort((a, b) => b.opportunities - a.opportunities);
}

export interface DataQuality {
  averageConfidence: number | null;
  confidenceHistogram: ConfidenceBin[];
  approved: number;
  rejected: number;
  needsReview: number;
  approvedPct: number | null;
  rejectedPct: number | null;
  /** Human-rejected matches as a share of decided matches. */
  falseMatchRate: number | null;
  /** Sampled opportunities lacking an order book, as a share of sampled. */
  missingOrderBookPct: number | null;
}

/** Data-quality metrics (Priority 4). */
export function dataQuality(
  snapshots: AnalyticsSnapshot[],
  reviews: Record<string, ReviewDecision>,
): DataQuality {
  const totalConf = sum(snapshots.map((s) => s.confidenceSum));
  const totalMatches = sum(snapshots.map((s) => s.matchesCreated));

  // Sum histograms element-wise (assumes aligned bins).
  const histogram: ConfidenceBin[] = [];
  for (const s of snapshots) {
    s.confidenceHistogram.forEach((bin, i) => {
      if (!histogram[i]) histogram[i] = { ...bin, count: 0 };
      histogram[i].count += bin.count;
    });
  }

  let approved = 0;
  let rejected = 0;
  let needsReview = 0;
  for (const r of Object.values(reviews)) {
    if (r.status === "approved") approved += 1;
    else if (r.status === "rejected") rejected += 1;
    else needsReview += 1;
  }
  const decided = approved + rejected;
  const totalDecisions = approved + rejected + needsReview;

  const sampled = sum(snapshots.map((s) => s.executable.sampled));
  const missing = sum(snapshots.map((s) => s.executable.missingBook));

  return {
    averageConfidence: totalMatches > 0 ? totalConf / totalMatches : null,
    confidenceHistogram: histogram,
    approved,
    rejected,
    needsReview,
    approvedPct: totalDecisions > 0 ? approved / totalDecisions : null,
    rejectedPct: totalDecisions > 0 ? rejected / totalDecisions : null,
    falseMatchRate: decided > 0 ? rejected / decided : null,
    missingOrderBookPct: sampled > 0 ? missing / sampled : null,
  };
}
