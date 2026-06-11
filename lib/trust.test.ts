import { describe, expect, it } from "vitest";
import { normalizeTokens } from "@/lib/normalize";
import { assessMatch, liquidityTier, properNouns } from "@/lib/trust";
import type { NormalizedMarket, Venue } from "@/lib/types";

function market(venue: Venue, title: string, yesAsk = 0.5, noAsk = 0.5, endDate?: string): NormalizedMarket {
  return { venue, id: `${venue}-${title.slice(0, 6)}`, title, yesAsk, noAsk, url: "#", endDate, tokens: normalizeTokens(title) };
}

describe("properNouns", () => {
  it("extracts entity names and drops question words", () => {
    const nouns = properNouns("Will Eduardo Bolsonaro win the 2026 Brazilian presidential election?");
    expect(nouns).toContain("Eduardo");
    expect(nouns).toContain("Bolsonaro");
    expect(nouns).toContain("Brazilian");
    expect(nouns).not.toContain("Will");
  });
});

describe("assessMatch — different candidates (the Bolsonaro case)", () => {
  const a = market("polymarket", "Will Eduardo Bolsonaro win the 2026 Brazilian presidential election?", 0.35, 0.66, "2026-10-04");
  const b = market("predictit", "Who will win the 2026 Brazilian presidential election? — Flávio Bolsonaro", 0.51, 0.5, "2026-10-04");

  const result = assessMatch({ marketA: a, marketB: b, netMargin: 0.06, matchScore: 0.72 });

  it("flags the name mismatch and lands on REVIEW", () => {
    expect(result.trust).toBe("review");
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.suspicionScore).toBeGreaterThan(30);
    expect(result.concernReasons.join(" ")).toMatch(/different names/i);
  });

  it("still recognizes the supporting signals", () => {
    const support = result.supportReasons.join(" ").toLowerCase();
    expect(support).toMatch(/bolsonaro|brazilian/);
    expect(result.matchConfidence).toBeCloseTo(0.72);
  });

  it("writes a plain-English summary recommending verification", () => {
    expect(result.summary).toMatch(/different names/i);
    expect(result.summary.toLowerCase()).toContain("verification");
  });
});

describe("assessMatch — margin suspicion (Priority 4)", () => {
  const same = (netMargin: number) =>
    assessMatch({
      marketA: market("polymarket", "Will the Fed raise rates in 2026?", 0.4, 0.62, "2026-12-31"),
      marketB: market("kalshi", "Will the Fed raise rates in 2026?", 0.55, 0.5, "2026-12-31"),
      netMargin,
      matchScore: 0.95,
    });

  it("verifies a well-matched, modest-margin opportunity", () => {
    expect(same(0.08).trust).toBe("verified");
  });

  it("raises suspicion past 15% margin", () => {
    expect(same(0.18).trust).not.toBe("verified");
  });

  it("strongly raises suspicion past 25% margin", () => {
    const r = same(0.3);
    expect(r.suspicionScore).toBeGreaterThanOrEqual(40);
    expect(r.concernReasons.join(" ")).toMatch(/large margin|unusually large/i);
  });
});

describe("assessMatch — category mismatch", () => {
  it("flags markets in different categories", () => {
    const a = market("polymarket", "Will Bitcoin reach 200k in 2026?", 0.3, 0.72);
    const b = market("kalshi", "Will the Lakers win in 2026?", 0.55, 0.5);
    const r = assessMatch({ marketA: a, marketB: b, netMargin: 0.05, matchScore: 0.62 });
    expect(r.concernReasons.join(" ")).toMatch(/different categories/i);
  });
});

describe("liquidityTier", () => {
  it("buckets liquidity", () => {
    expect(liquidityTier(undefined)).toBe("Low");
    expect(liquidityTier(500)).toBe("Low");
    expect(liquidityTier(5000)).toBe("Medium");
    expect(liquidityTier(100000)).toBe("High");
  });
});
