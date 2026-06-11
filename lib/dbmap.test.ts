import { describe, expect, it } from "vitest";
import { disagreementRow, matchRow, snapshotRow, venuePairKey } from "@/lib/dbmap";
import { normalizeTokens } from "@/lib/normalize";
import type { Disagreement, ExecutablePricing, Opportunity } from "@/lib/types";

function opp(): Opportunity {
  return {
    id: "pm-x::k-y",
    question: "Will X happen in 2026?",
    category: "Politics",
    matchScore: 0.82,
    score: 71,
    status: "VERIFIED",
    suspicionScore: 12,
    riskNotes: [],
    pricing: "indicative",
    venues: ["polymarket", "kalshi"],
    legs: [
      { venue: "polymarket", side: "YES", price: 0.4, title: "a", url: "https://a" },
      { venue: "kalshi", side: "NO", price: 0.5, title: "b", url: "https://b" },
    ],
    cost: 0.9,
    grossMargin: 0.1,
    netMargin: 0.09,
    grossMarginPct: 10,
    netMarginPct: 9,
    liquidity: 12000,
    marketA: { venue: "polymarket", id: "pm-x", title: "A", yesAsk: 0.4, noAsk: 0.6, url: "https://a", tokens: [] },
    marketB: { venue: "kalshi", id: "k-y", title: "B", yesAsk: 0.5, noAsk: 0.5, url: "https://b", tokens: [] },
    endDate: "2026-10-01T00:00:00Z",
  };
}

describe("venuePairKey", () => {
  it("is sorted and order-independent", () => {
    expect(venuePairKey(["polymarket", "kalshi"])).toBe("kalshi ↔ polymarket");
    expect(venuePairKey(["kalshi", "polymarket"])).toBe("kalshi ↔ polymarket");
  });
});

describe("matchRow", () => {
  it("maps identity fields and omits first_seen (preserved by DB)", () => {
    const row = matchRow(opp(), "2026-06-11T00:00:00Z");
    expect(row.opportunity_id).toBe("k-y::pm-x"); // sorted pair key
    expect(row.venue_pair).toBe("kalshi ↔ polymarket");
    expect(row.latest_confidence).toBeCloseTo(0.82);
    expect(row.latest_trust).toBe("VERIFIED");
    expect(row.last_seen).toBe("2026-06-11T00:00:00Z");
    expect("first_seen" in row).toBe(false);
  });
});

describe("snapshotRow", () => {
  it("leaves executable fields null when not priced", () => {
    const row = snapshotRow(opp(), "2026-06-11T00:00:00Z");
    expect(row.net_margin).toBeCloseTo(0.09);
    expect(row.liquidity).toBe(12000);
    expect(row.executable_margin).toBeNull();
    expect(row.max_executable_stake).toBeNull();
  });

  it("fills executable fields from available pricing", () => {
    const pricing: ExecutablePricing = {
      available: true,
      indicativeMargin: 0.09,
      executableMargin: 0.06,
      maxStake: 8000,
      maxSize: 8000,
      legs: [
        { venue: "polymarket", side: "YES", available: true, filledSize: 100, averagePrice: 0.41, depth: 500 },
        { venue: "kalshi", side: "NO", available: true, filledSize: 100, averagePrice: 0.51, depth: 300 },
      ],
    };
    const row = snapshotRow(opp(), "2026-06-11T00:00:00Z", pricing);
    expect(row.executable_margin).toBeCloseTo(0.06);
    expect(row.max_executable_stake).toBe(8000);
    expect(row.order_book_depth).toBe(800);
  });

  it("treats unavailable pricing as not priced", () => {
    const pricing = { available: false, indicativeMargin: 0.09, executableMargin: null, maxStake: null, maxSize: null, legs: [] } as ExecutablePricing;
    const row = snapshotRow(opp(), "t", pricing);
    expect(row.executable_margin).toBeNull();
    expect(row.order_book_depth).toBeNull();
  });
});

describe("disagreementRow", () => {
  it("maps quotes to venue/implied_yes pairs", () => {
    const d: Disagreement = {
      id: "p::k",
      question: "Q 2026",
      category: "Economics",
      quotes: [
        { venue: "kalshi", impliedYes: 0.51, market: { venue: "kalshi", id: "k", title: "", yesAsk: 0.51, noAsk: 0.5, url: "#", tokens: normalizeTokens("q") } },
        { venue: "polymarket", impliedYes: 0.35, market: { venue: "polymarket", id: "p", title: "", yesAsk: 0.35, noAsk: 0.66, url: "#", tokens: normalizeTokens("q") } },
      ],
      spread: 0.16,
      confidence: 0.8,
      endDate: "2026-12-31T00:00:00Z",
    };
    const row = disagreementRow(d, "2026-06-11T00:00:00Z");
    expect(row.spread).toBeCloseTo(0.16);
    expect(row.quotes).toEqual([
      { venue: "kalshi", implied_yes: 0.51 },
      { venue: "polymarket", implied_yes: 0.35 },
    ]);
  });
});
