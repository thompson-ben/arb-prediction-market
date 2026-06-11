import { describe, expect, it } from "vitest";
import { buildOpportunities, computeArb } from "@/lib/match";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket } from "@/lib/types";

function market(overrides: Partial<NormalizedMarket>): NormalizedMarket {
  const title = overrides.title ?? "Will the Strait of Hormuz close in July 2026?";
  return {
    venue: "polymarket",
    id: "m1",
    title,
    yesAsk: 0.5,
    noAsk: 0.5,
    url: "https://example.com",
    tokens: normalizeTokens(title),
    ...overrides,
  };
}

describe("computeArb", () => {
  it("picks the cheaper of the two directions", () => {
    const pm = market({ venue: "polymarket", yesAsk: 0.4, noAsk: 0.62 });
    const kalshi = market({ venue: "kalshi", id: "k1", yesAsk: 0.58, noAsk: 0.5 });
    // Dir A: pm YES 0.4 + kalshi NO 0.5 = 0.90 (cheaper)
    // Dir B: kalshi YES 0.58 + pm NO 0.62 = 1.20
    const arb = computeArb(pm, kalshi);
    expect(arb).not.toBeNull();
    expect(arb!.cost).toBeCloseTo(0.9);
    expect(arb!.margin).toBeCloseTo(0.1);
    expect(arb!.legs.map((l) => `${l.venue}:${l.side}`)).toEqual([
      "polymarket:YES",
      "kalshi:NO",
    ]);
  });

  it("returns null when no side is tradeable", () => {
    const pm = market({ yesAsk: Number.NaN, noAsk: Number.NaN });
    const kalshi = market({ venue: "kalshi", yesAsk: Number.NaN, noAsk: Number.NaN });
    expect(computeArb(pm, kalshi)).toBeNull();
  });

  it("treats degenerate 0/1 prices as untradeable", () => {
    const pm = market({ yesAsk: 0, noAsk: 1 });
    const kalshi = market({ venue: "kalshi", yesAsk: 1, noAsk: 0 });
    expect(computeArb(pm, kalshi)).toBeNull();
  });
});

describe("buildOpportunities", () => {
  const opts = { minMargin: 0.05, matchThreshold: 0.5 };

  it("matches similar titles across venues and reports a ≥5% margin", () => {
    const pm = [
      market({
        venue: "polymarket",
        id: "pm-hormuz",
        title: "Will the Strait of Hormuz close in July 2026?",
        yesAsk: 0.42,
        noAsk: 0.6,
      }),
    ];
    const kalshi = [
      market({
        venue: "kalshi",
        id: "k-hormuz",
        title: "Strait of Hormuz closed in July 2026",
        yesAsk: 0.55,
        noAsk: 0.5,
      }),
    ];
    const opps = buildOpportunities(pm, kalshi, opts);
    expect(opps).toHaveLength(1);
    expect(opps[0]!.marginPct).toBeCloseTo(8); // 1 - (0.42 + 0.5)
    expect(opps[0]!.matchScore).toBeGreaterThanOrEqual(0.5);
  });

  it("filters out opportunities below the minimum margin", () => {
    const pm = [market({ venue: "polymarket", id: "p", yesAsk: 0.49, noAsk: 0.52 })];
    const kalshi = [market({ venue: "kalshi", id: "k", yesAsk: 0.52, noAsk: 0.49 })];
    // best cost = 0.49 + 0.49 = 0.98 -> 2% margin, below 5%
    expect(buildOpportunities(pm, kalshi, opts)).toEqual([]);
  });

  it("does not match unrelated markets", () => {
    const pm = [
      market({
        venue: "polymarket",
        id: "p",
        title: "Will Bitcoin reach 200k in 2026?",
        yesAsk: 0.3,
        noAsk: 0.3,
      }),
    ];
    const kalshi = [
      market({
        venue: "kalshi",
        id: "k",
        title: "Will the Lakers win the 2026 NBA championship?",
        yesAsk: 0.3,
        noAsk: 0.3,
      }),
    ];
    expect(buildOpportunities(pm, kalshi, opts)).toEqual([]);
  });

  it("sorts opportunities by descending margin", () => {
    const pm = [
      market({ venue: "polymarket", id: "p1", title: "Alpha event 2026", yesAsk: 0.45, noAsk: 0.6 }),
      market({ venue: "polymarket", id: "p2", title: "Beta event 2026", yesAsk: 0.3, noAsk: 0.6 }),
    ];
    const kalshi = [
      market({ venue: "kalshi", id: "k1", title: "Alpha event 2026", yesAsk: 0.6, noAsk: 0.45 }),
      market({ venue: "kalshi", id: "k2", title: "Beta event 2026", yesAsk: 0.6, noAsk: 0.4 }),
    ];
    const opps = buildOpportunities(pm, kalshi, opts);
    expect(opps).toHaveLength(2);
    expect(opps[0]!.margin).toBeGreaterThan(opps[1]!.margin);
    expect(opps[0]!.question).toContain("Beta"); // 0.3 + 0.4 = 0.7 -> 30%
  });
});
