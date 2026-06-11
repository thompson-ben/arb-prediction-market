import { describe, expect, it } from "vitest";
import { jaccard, normalizeTokens } from "@/lib/normalize";

describe("normalizeTokens", () => {
  it("lowercases, strips punctuation, and drops stopwords", () => {
    const tokens = normalizeTokens("Will the Strait of Hormuz close in July 2026?");
    expect(tokens).toEqual(["strait", "hormuz", "close", "july", "2026"]);
  });

  it("preserves years and numbers as significant tokens", () => {
    const tokens = normalizeTokens("Bitcoin above 100000 by 2027");
    expect(tokens).toContain("100000");
    expect(tokens).toContain("2027");
  });
});

describe("jaccard", () => {
  it("returns 1 for identical token sets", () => {
    const a = normalizeTokens("Strait of Hormuz closes July 2026");
    const b = normalizeTokens("Strait of Hormuz closes July 2026");
    expect(jaccard(a, b)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccard(["bitcoin", "2026"], ["lakers", "nba"])).toBe(0);
  });

  it("scores partial overlap between 0 and 1", () => {
    const score = jaccard(
      normalizeTokens("Strait of Hormuz close July 2026"),
      normalizeTokens("Strait of Hormuz closed in July 2026"),
    );
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });
});
