import { describe, expect, it } from "vitest";
import { historyStats, opportunityKey, upsertHistory } from "@/lib/history";
import type { Opportunity, OpportunityHistory } from "@/lib/types";

function opp(idA: string, idB: string, netMargin: number): Opportunity {
  return {
    id: `${idA}::${idB}`,
    question: "Q 2026",
    category: "Politics",
    matchScore: 0.8,
    score: 70,
    status: "VERIFIED",
    suspicionScore: 10,
    riskNotes: [],
    pricing: "indicative",
    venues: ["polymarket", "kalshi"],
    legs: [
      { venue: "polymarket", side: "YES", price: 0.4, title: "a", url: "#" },
      { venue: "kalshi", side: "NO", price: 0.5, title: "b", url: "#" },
    ],
    cost: 0.9,
    grossMargin: netMargin,
    netMargin,
    grossMarginPct: netMargin * 100,
    netMarginPct: netMargin * 100,
    marketA: { venue: "polymarket", id: idA, title: "a", yesAsk: 0.4, noAsk: 0.6, url: "#", tokens: [] },
    marketB: { venue: "kalshi", id: idB, title: "b", yesAsk: 0.5, noAsk: 0.5, url: "#", tokens: [] },
  };
}

describe("opportunityKey", () => {
  it("is order-independent", () => {
    expect(opportunityKey(opp("a", "b", 0.1))).toBe(opportunityKey(opp("b", "a", 0.1)));
  });
});

describe("upsertHistory", () => {
  it("creates then accumulates a record across scans", () => {
    let history: Record<string, OpportunityHistory> = {};
    history = upsertHistory(history, [opp("a", "b", 0.08)], "2026-06-01T00:00:00Z");
    const key = opportunityKey(opp("a", "b", 0.08));
    expect(history[key]!.appearances).toBe(1);
    expect(history[key]!.peakMargin).toBeCloseTo(0.08);

    history = upsertHistory(history, [opp("a", "b", 0.12)], "2026-06-01T06:00:00Z");
    expect(history[key]!.appearances).toBe(2);
    expect(history[key]!.peakMargin).toBeCloseTo(0.12); // peak raised
    expect(history[key]!.lastMargin).toBeCloseTo(0.12);
    expect(history[key]!.firstSeen).toBe("2026-06-01T00:00:00Z");
    expect(history[key]!.lastSeen).toBe("2026-06-01T06:00:00Z");
  });
});

describe("historyStats", () => {
  it("summarizes durations, appearances, and venue pairs", () => {
    let history: Record<string, OpportunityHistory> = {};
    history = upsertHistory(history, [opp("a", "b", 0.08)], "2026-06-01T00:00:00Z");
    history = upsertHistory(history, [opp("a", "b", 0.1)], "2026-06-01T12:00:00Z");

    const stats = historyStats(history, "2026-06-01T12:00:00Z");
    expect(stats.tracked).toBe(1);
    expect(stats.activeNow).toBe(1);
    expect(stats.averageAppearances).toBe(2);
    expect(stats.averageDurationHours).toBeCloseTo(12, 1);
    expect(stats.bestPeakMargin).toBeCloseTo(0.1);
    expect(stats.byVenuePair[0]!.pair).toContain("kalshi");
  });
});
