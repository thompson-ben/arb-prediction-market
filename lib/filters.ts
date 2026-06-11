import { daysUntil } from "@/lib/format";
import type { Category, Opportunity, Venue } from "@/lib/types";

export type SortKey = "score" | "netMargin" | "confidence" | "expiry";
export type ExpiryWindow = "all" | "7d" | "30d" | "90d";

export interface FilterState {
  /** Minimum net margin as a fraction (0.05 = 5%). */
  minMargin: number;
  /** Minimum match confidence, 0–1. */
  minConfidence: number;
  /** Enabled venues; an opportunity shows only if both its legs are enabled. */
  venues: Venue[];
  /** Resolution window. */
  expiry: ExpiryWindow;
  /** Category filter, or "all". */
  category: Category | "all";
  /** Sort key (default: score). */
  sort: SortKey;
}

export const ALL_VENUES: Venue[] = ["polymarket", "kalshi", "predictit"];

export function defaultFilters(minMargin: number, minConfidence: number): FilterState {
  return {
    minMargin,
    minConfidence,
    venues: [...ALL_VENUES],
    expiry: "all",
    category: "all",
    sort: "score",
  };
}

const EXPIRY_DAYS: Record<ExpiryWindow, number | null> = {
  all: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function passesFilters(o: Opportunity, f: FilterState): boolean {
  if (o.netMargin < f.minMargin) return false;
  if (o.matchScore < f.minConfidence) return false;
  if (!o.venues.every((v) => f.venues.includes(v))) return false;
  if (f.category !== "all" && o.category !== f.category) return false;

  const window = EXPIRY_DAYS[f.expiry];
  if (window !== null) {
    const d = daysUntil(o.endDate);
    if (d === undefined || d < 0 || d > window) return false;
  }
  return true;
}

export function sortOpportunities(list: Opportunity[], key: SortKey): Opportunity[] {
  const arr = [...list];
  switch (key) {
    case "netMargin":
      return arr.sort((a, b) => b.netMargin - a.netMargin);
    case "confidence":
      return arr.sort((a, b) => b.matchScore - a.matchScore);
    case "expiry":
      return arr.sort(
        (a, b) =>
          (daysUntil(a.endDate) ?? Infinity) - (daysUntil(b.endDate) ?? Infinity),
      );
    case "score":
    default:
      return arr.sort((a, b) => b.score - a.score);
  }
}

export interface FilterResult {
  /** Rows to display. */
  rows: Opportunity[];
  /** True when nothing matched and we fell back to the Top-5 by score. */
  fallback: boolean;
  /** Number of opportunities that actually matched the filters. */
  matchedCount: number;
}

/**
 * Apply filters and sort. If nothing matches, fall back to the Top-5
 * opportunities by score so the dashboard is never empty (Priority 2).
 */
export function applyFilters(all: Opportunity[], f: FilterState): FilterResult {
  const matched = all.filter((o) => passesFilters(o, f));
  if (matched.length === 0) {
    return {
      rows: sortOpportunities(all, "score").slice(0, 5),
      fallback: true,
      matchedCount: 0,
    };
  }
  return {
    rows: sortOpportunities(matched, f.sort),
    fallback: false,
    matchedCount: matched.length,
  };
}
