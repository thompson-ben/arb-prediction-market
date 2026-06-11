import { describe, expect, it } from "vitest";
import {
  type AnalyticsSnapshot,
  dailyMetrics,
  dataQuality,
  funnel,
  summarizeExecutable,
  venuePairAnalytics,
  venuePairKey,
} from "@/lib/analytics";
import type { ExecutablePricing, Opportunity, OpportunityHistory, ReviewDecision } from "@/lib/types";

function snapshot(at: string, over: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  return {
    at,
    marketsScanned: 1000,
    marketsByVenue: { polymarket: 500, kalshi: 400, predictit: 100 },
    pairsConsidered: 800,
    matchesCreated: 200,
    matchesRejected: 600,
    confidenceSum: 140, // avg 0.7 over 200
    confidenceHistogram: [
      { label: "60–70%", min: 0.6, max: 0.7, count: 50 },
      { label: "70–80%", min: 0.7, max: 0.8, count: 150 },
    ],
    opportunitiesFound: 30,
    opportunitiesAboveThreshold: 10,
    averageMargin: 0.08,
    largestMargin: 0.2,
    byVenuePair: { "kalshi ↔ polymarket": { count: 8, marginSum: 0.64, largestMargin: 0.2 } },
    executable: {
      sampled: 8,
      executable: 4,
      missingBook: 2,
      marginSum: 0.24,
      largestMargin: 0.09,
      byVenuePair: { "kalshi ↔ polymarket": { count: 4, marginSum: 0.24 } },
    },
    ...over,
  };
}

describe("venuePairKey", () => {
  it("is order-independent and sorted", () => {
    expect(venuePairKey(["polymarket", "kalshi"])).toBe("kalshi ↔ polymarket");
    expect(venuePairKey(["kalshi", "polymarket"])).toBe("kalshi ↔ polymarket");
  });
});

describe("summarizeExecutable", () => {
  it("counts executable, missing books, and aggregates by pair", () => {
    const o = (venues: ["polymarket", "kalshi"]): Opportunity =>
      ({ venues, netMargin: 0.1 }) as Opportunity;
    const avail = (m: number | null): ExecutablePricing => ({
      available: m != null,
      indicativeMargin: 0.1,
      executableMargin: m,
      maxStake: m ? 100 : null,
      maxSize: m ? 100 : null,
      legs: [],
    });
    const summary = summarizeExecutable([
      { opportunity: o(["polymarket", "kalshi"]), pricing: avail(0.06) },
      { opportunity: o(["polymarket", "kalshi"]), pricing: avail(0.04) },
      { opportunity: o(["polymarket", "kalshi"]), pricing: { ...avail(null), available: false } },
    ]);
    expect(summary.sampled).toBe(3);
    expect(summary.executable).toBe(2);
    expect(summary.missingBook).toBe(1);
    expect(summary.marginSum).toBeCloseTo(0.1);
    expect(summary.byVenuePair["kalshi ↔ polymarket"].count).toBe(2);
  });
});

describe("funnel", () => {
  it("computes stage values and conversions", () => {
    const stages = funnel([snapshot("2026-06-01T00:00:00Z")]);
    expect(stages.map((s) => s.label)).toEqual([
      "Markets Scanned",
      "Potential Matches",
      "Accepted Matches",
      "Arbitrage Opportunities",
      "Executable Arbitrage",
    ]);
    expect(stages[0].conversion).toBeNull();
    // Accepted / Potential = 200 / 800
    expect(stages[2].conversion).toBeCloseTo(0.25);
    // Executable / Arbitrage = 4 / 10
    expect(stages[4].conversion).toBeCloseTo(0.4);
  });
});

describe("dailyMetrics", () => {
  it("averages per scan within a day and counts review decisions", () => {
    const snaps = [snapshot("2026-06-01T00:00:00Z"), snapshot("2026-06-01T06:00:00Z")];
    const reviews: Record<string, ReviewDecision> = {
      a: { pairId: "a", status: "approved", updatedAt: "2026-06-01T01:00:00Z" },
      b: { pairId: "b", status: "rejected", updatedAt: "2026-06-01T02:00:00Z" },
    };
    const [day] = dailyMetrics(snaps, reviews);
    expect(day.date).toBe("2026-06-01");
    expect(day.scans).toBe(2);
    expect(day.marketsScanned).toBe(1000);
    expect(day.matchesApproved).toBe(1);
    expect(day.matchesRejected).toBe(1);
    expect(day.executableOpportunities).toBe(4);
    expect(day.averageExecutableMargin).toBeCloseTo(0.06); // 0.24 / 4
  });
});

describe("venuePairAnalytics", () => {
  it("aggregates history and executable margins per pair", () => {
    const history: Record<string, OpportunityHistory> = {
      k1: {
        key: "k1",
        question: "q",
        category: "Politics",
        venues: ["polymarket", "kalshi"],
        firstSeen: "2026-06-01T00:00:00Z",
        lastSeen: "2026-06-01T12:00:00Z",
        peakMargin: 0.2,
        lastMargin: 0.1,
        appearances: 3,
      },
    };
    const result = venuePairAnalytics(history, [snapshot("2026-06-01T00:00:00Z")]);
    expect(result).toHaveLength(1);
    expect(result[0].pair).toBe("kalshi ↔ polymarket");
    expect(result[0].opportunities).toBe(1);
    expect(result[0].averageMargin).toBeCloseTo(0.2);
    expect(result[0].averageExecutableMargin).toBeCloseTo(0.06);
    expect(result[0].averageDurationHours).toBeCloseTo(12, 1);
  });
});

describe("dataQuality", () => {
  it("computes average confidence, decision split, and coverage", () => {
    const reviews: Record<string, ReviewDecision> = {
      a: { pairId: "a", status: "approved", updatedAt: "2026-06-01T01:00:00Z" },
      b: { pairId: "b", status: "rejected", updatedAt: "2026-06-01T02:00:00Z" },
      c: { pairId: "c", status: "needs_review", updatedAt: "2026-06-01T03:00:00Z" },
    };
    const q = dataQuality([snapshot("2026-06-01T00:00:00Z")], reviews);
    expect(q.averageConfidence).toBeCloseTo(0.7); // 140 / 200
    expect(q.approved).toBe(1);
    expect(q.rejected).toBe(1);
    expect(q.falseMatchRate).toBeCloseTo(0.5); // 1 / 2 decided
    expect(q.missingOrderBookPct).toBeCloseTo(0.25); // 2 / 8 sampled
  });
});
