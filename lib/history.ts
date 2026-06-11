import type { Opportunity, OpportunityHistory, Venue } from "@/lib/types";

/** Stable, order-independent key for an opportunity (the matched market pair). */
export function opportunityKey(o: Opportunity): string {
  return [o.marketA.id, o.marketB.id].sort().join("::");
}

export interface HistoryStats {
  tracked: number;
  /** Seen in the most recent scan. */
  activeNow: number;
  averageAppearances: number;
  /** Average lifetime in hours (lastSeen − firstSeen). */
  averageDurationHours: number;
  longestDurationHours: number;
  /** Best peak margin ever recorded. */
  bestPeakMargin: number | null;
  /** Appearance count keyed by venue pair, for "which venues are best". */
  byVenuePair: { pair: string; count: number; bestPeakMargin: number }[];
}

/**
 * Fold a fresh batch of opportunities into the existing history map. Each scan
 * bumps `appearances`, refreshes `lastSeen` and `lastMargin`, and raises
 * `peakMargin`. New opportunities get a `firstSeen`.
 */
export function upsertHistory(
  existing: Record<string, OpportunityHistory>,
  opportunities: Opportunity[],
  now: string,
): Record<string, OpportunityHistory> {
  const next: Record<string, OpportunityHistory> = { ...existing };

  for (const o of opportunities) {
    const key = opportunityKey(o);
    const prior = next[key];
    if (prior) {
      next[key] = {
        ...prior,
        lastSeen: now,
        lastMargin: o.netMargin,
        peakMargin: Math.max(prior.peakMargin, o.netMargin),
        appearances: prior.appearances + 1,
        question: o.question,
        category: o.category,
        venues: o.venues,
      };
    } else {
      next[key] = {
        key,
        question: o.question,
        category: o.category,
        venues: o.venues,
        firstSeen: now,
        lastSeen: now,
        peakMargin: o.netMargin,
        lastMargin: o.netMargin,
        appearances: 1,
      };
    }
  }

  return next;
}

const HOUR = 1000 * 60 * 60;

function durationHours(record: OpportunityHistory): number {
  const first = new Date(record.firstSeen).getTime();
  const last = new Date(record.lastSeen).getTime();
  if (Number.isNaN(first) || Number.isNaN(last)) return 0;
  return Math.max(0, (last - first) / HOUR);
}

/** Summary statistics across the tracked history (answers success-criteria Q4–Q6). */
export function historyStats(
  history: Record<string, OpportunityHistory>,
  latestScanAt?: string,
): HistoryStats {
  const records = Object.values(history);
  if (records.length === 0) {
    return {
      tracked: 0,
      activeNow: 0,
      averageAppearances: 0,
      averageDurationHours: 0,
      longestDurationHours: 0,
      bestPeakMargin: null,
      byVenuePair: [],
    };
  }

  const durations = records.map(durationHours);
  const pairMap = new Map<string, { count: number; bestPeakMargin: number }>();
  for (const r of records) {
    const pair = [...r.venues].sort().join(" ↔ ");
    const cur = pairMap.get(pair) ?? { count: 0, bestPeakMargin: 0 };
    cur.count += r.appearances;
    cur.bestPeakMargin = Math.max(cur.bestPeakMargin, r.peakMargin);
    pairMap.set(pair, cur);
  }

  return {
    tracked: records.length,
    activeNow: latestScanAt
      ? records.filter((r) => r.lastSeen === latestScanAt).length
      : 0,
    averageAppearances:
      records.reduce((s, r) => s + r.appearances, 0) / records.length,
    averageDurationHours: durations.reduce((s, d) => s + d, 0) / records.length,
    longestDurationHours: Math.max(...durations),
    bestPeakMargin: Math.max(...records.map((r) => r.peakMargin)),
    byVenuePair: [...pairMap.entries()]
      .map(([pair, v]) => ({ pair, ...v }))
      .sort((a, b) => b.count - a.count),
  };
}
