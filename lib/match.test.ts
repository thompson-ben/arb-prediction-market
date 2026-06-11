import { describe, expect, it } from "vitest";
import { buildOpportunities, computeArb } from "@/lib/match";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket, Venue } from "@/lib/types";

function market(
  venue: Venue,
  id: string,
  title: string,
  yesAsk: number,
  noAsk: number,
): NormalizedMarket {
  return {
    venue,
    id,
    title,
    yesAsk,
    noAsk,
    url: "https://example.com",
    tokens: normalizeTokens(title),
  };
}

const HORMUZ = "Strait of Hormuz close in July 2026";

describe("computeArb", () => {
  it("picks the higher-net-margin direction", () => {
    // Polymarket and Kalshi both have ~0 profit fee; Kalshi has a small trading fee.
    const pm = market("polymarket", "p", HORMUZ, 0.4, 0.62);
    const kalshi = market("kalshi", "k", HORMUZ, 0.58, 0.5);
    // Dir A: pm YES 0.4 + kalshi NO 0.5 (+fee) ≈ 0.9175 (cheaper)
    const arb = computeArb(pm, kalshi);
    expect(arb).not.toBeNull();
    expect(arb!.legs.map((l) => `${l.venue}:${l.side}`)).toEqual([
      "polymarket:YES",
      "kalshi:NO",
    ]);
    expect(arb!.grossMargin).toBeCloseTo(0.1, 5); // 1 - (0.4 + 0.5)
    // Net is slightly below gross due to Kalshi's trading fee on the NO leg.
    expect(arb!.netMargin).toBeLessThan(arb!.grossMargin);
    expect(arb!.netMargin).toBeGreaterThan(0.08);
  });

  it("applies PredictIt's 5% profit fee to net margin", () => {
    // pm YES 0.45 + predictit NO 0.45 -> gross 10%. PredictIt NO leg, if it wins,
    // pays 1 - 0.05*(1-0.45) = 0.9725; worst-case net = 0.9725 - 0.90 = 0.0725.
    const pm = market("polymarket", "p", HORMUZ, 0.45, 0.6);
    const pi = market("predictit", "pi", HORMUZ, 0.6, 0.45);
    const arb = computeArb(pm, pi)!;
    expect(arb.grossMargin).toBeCloseTo(0.1, 5);
    expect(arb.netMargin).toBeCloseTo(0.0725, 4);
  });

  it("returns null when no side is tradeable", () => {
    const a = market("polymarket", "p", HORMUZ, Number.NaN, Number.NaN);
    const b = market("kalshi", "k", HORMUZ, Number.NaN, Number.NaN);
    expect(computeArb(a, b)).toBeNull();
  });
});

describe("buildOpportunities", () => {
  const opts = { minMargin: 0.05, matchThreshold: 0.5 };

  it("matches similar titles across venues and reports net margin", () => {
    const pool = [
      market("polymarket", "pm-hormuz", "Will the Strait of Hormuz close in July 2026?", 0.42, 0.6),
      market("kalshi", "k-hormuz", "Strait of Hormuz closed in July 2026", 0.55, 0.5),
    ];
    const opps = buildOpportunities(pool, opts);
    expect(opps).toHaveLength(1);
    expect(opps[0]!.matchScore).toBeGreaterThanOrEqual(0.5);
    expect(opps[0]!.grossMarginPct).toBeCloseTo(8, 1); // 1 - (0.42 + 0.5)
    expect(opps[0]!.netMargin).toBeLessThanOrEqual(opps[0]!.grossMargin);
  });

  it("never pairs two markets from the same venue", () => {
    const pool = [
      market("polymarket", "p1", "Alpha event 2026", 0.3, 0.4),
      market("polymarket", "p2", "Alpha event 2026", 0.3, 0.4),
    ];
    expect(buildOpportunities(pool, opts)).toEqual([]);
  });

  it("filters out opportunities below the minimum net margin", () => {
    const pool = [
      market("polymarket", "p", "Gamma event 2026", 0.49, 0.52),
      market("kalshi", "k", "Gamma event 2026", 0.52, 0.49),
    ];
    // best cost = 0.49 + 0.49 (+ fee) -> ~2% gross, below 5%
    expect(buildOpportunities(pool, opts)).toEqual([]);
  });

  it("does not match unrelated markets", () => {
    const pool = [
      market("polymarket", "p", "Will Bitcoin reach 200k in 2026?", 0.3, 0.3),
      market("kalshi", "k", "Will the Lakers win the 2026 NBA championship?", 0.3, 0.3),
    ];
    expect(buildOpportunities(pool, opts)).toEqual([]);
  });

  it("finds three-venue opportunities and sorts by net margin", () => {
    const pool = [
      market("polymarket", "p", "Beta event 2026", 0.3, 0.6),
      market("kalshi", "k", "Beta event 2026", 0.6, 0.4),
      market("predictit", "pi", "Alpha event 2026", 0.45, 0.6),
      market("polymarket", "p2", "Alpha event 2026", 0.6, 0.45),
    ];
    const opps = buildOpportunities(pool, opts);
    expect(opps.length).toBeGreaterThanOrEqual(2);
    // Beta (0.3 + 0.4 = 0.7 -> 30%) should outrank Alpha (~10% gross, less after fee).
    expect(opps[0]!.question).toContain("Beta");
    expect(opps[0]!.netMargin).toBeGreaterThan(opps[1]!.netMargin);
  });
});
