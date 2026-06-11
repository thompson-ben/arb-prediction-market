import { describe, expect, it } from "vitest";
import { buildDisagreements, impliedYesProbability } from "@/lib/disagreement";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket, Venue } from "@/lib/types";

function market(venue: Venue, id: string, title: string, yesAsk: number, noAsk: number): NormalizedMarket {
  return { venue, id, title, yesAsk, noAsk, url: "#", tokens: normalizeTokens(title) };
}

describe("impliedYesProbability", () => {
  it("averages the YES ask and (1 - NO ask)", () => {
    const m = market("kalshi", "k", "x", 0.51, 0.5);
    expect(impliedYesProbability(m)).toBeCloseTo((0.51 + 0.5) / 2, 6);
  });

  it("uses whichever side is available", () => {
    const m = market("kalshi", "k", "x", Number.NaN, 0.66);
    expect(impliedYesProbability(m)).toBeCloseTo(0.34, 6);
  });
});

describe("buildDisagreements", () => {
  it("clusters the same event across venues and computes the spread", () => {
    const title = "Will the Fed raise rates in 2026?";
    const pool = [
      market("polymarket", "p", title, 0.35, 0.66), // implied ~0.345
      market("kalshi", "k", title, 0.51, 0.5), // implied ~0.505
      market("predictit", "i", title, 0.47, 0.54), // implied ~0.465
    ];
    const result = buildDisagreements(pool, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]!.quotes).toHaveLength(3);
    expect(result[0]!.spread).toBeCloseTo(0.16, 2); // 0.505 - 0.345
  });

  it("ignores single-venue events", () => {
    const pool = [
      market("polymarket", "p", "Unique poly event 2026", 0.5, 0.5),
    ];
    expect(buildDisagreements(pool, 0.5)).toEqual([]);
  });

  it("drops sub-threshold spreads", () => {
    const title = "Same event 2026";
    const pool = [
      market("polymarket", "p", title, 0.5, 0.5),
      market("kalshi", "k", title, 0.51, 0.49),
    ];
    // spread ~0.01, below default minSpread 0.05
    expect(buildDisagreements(pool, 0.5)).toEqual([]);
  });
});
