import { describe, expect, it } from "vitest";
import { applyFilters, defaultFilters, passesFilters } from "@/lib/filters";
import type { Opportunity, Venue } from "@/lib/types";

function opp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "a::b",
    question: "Test market 2026",
    category: "Politics",
    matchScore: 0.8,
    score: 70,
    status: "VERIFIED",
    riskNotes: [],
    pricing: "indicative",
    venues: ["polymarket", "kalshi"],
    legs: [
      { venue: "polymarket", side: "YES", price: 0.4, title: "a", url: "#" },
      { venue: "kalshi", side: "NO", price: 0.5, title: "b", url: "#" },
    ],
    cost: 0.9,
    grossMargin: 0.1,
    netMargin: 0.1,
    grossMarginPct: 10,
    netMarginPct: 10,
    liquidity: 5000,
    marketA: {
      venue: "polymarket",
      id: "a",
      title: "a",
      yesAsk: 0.4,
      noAsk: 0.6,
      url: "#",
      tokens: [],
    },
    marketB: {
      venue: "kalshi",
      id: "b",
      title: "b",
      yesAsk: 0.5,
      noAsk: 0.5,
      url: "#",
      tokens: [],
    },
    ...overrides,
  };
}

describe("passesFilters", () => {
  const base = defaultFilters(0.05, 0.5);

  it("filters out below minimum margin", () => {
    expect(passesFilters(opp({ netMargin: 0.03 }), base)).toBe(false);
    expect(passesFilters(opp({ netMargin: 0.07 }), base)).toBe(true);
  });

  it("filters out below minimum confidence", () => {
    expect(passesFilters(opp({ matchScore: 0.49 }), { ...base, minConfidence: 0.5 })).toBe(false);
  });

  it("hides opportunities touching a disabled venue", () => {
    const venues: Venue[] = ["polymarket", "predictit"];
    expect(passesFilters(opp({ venues: ["polymarket", "kalshi"] }), { ...base, venues })).toBe(false);
  });

  it("filters by category", () => {
    expect(passesFilters(opp({ category: "Crypto" }), { ...base, category: "Politics" })).toBe(false);
    expect(passesFilters(opp({ category: "Politics" }), { ...base, category: "Politics" })).toBe(true);
  });
});

describe("applyFilters", () => {
  it("falls back to the top-5 by score when nothing matches", () => {
    const all = [
      opp({ id: "1", netMargin: 0.02, score: 90 }),
      opp({ id: "2", netMargin: 0.01, score: 80 }),
      opp({ id: "3", netMargin: 0.03, score: 70 }),
    ];
    // Require 50% margin -> nothing matches -> fallback.
    const result = applyFilters(all, { ...defaultFilters(0.5, 0.5) });
    expect(result.fallback).toBe(true);
    expect(result.matchedCount).toBe(0);
    expect(result.rows.map((o) => o.id)).toEqual(["1", "2", "3"]); // sorted by score
  });

  it("returns matched rows sorted by the chosen key", () => {
    const all = [
      opp({ id: "low", netMargin: 0.06, score: 50 }),
      opp({ id: "high", netMargin: 0.2, score: 40 }),
    ];
    const result = applyFilters(all, { ...defaultFilters(0.05, 0.5), sort: "netMargin" });
    expect(result.fallback).toBe(false);
    expect(result.rows[0]!.id).toBe("high");
  });
});
