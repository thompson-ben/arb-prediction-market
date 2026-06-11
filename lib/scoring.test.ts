import { describe, expect, it } from "vitest";
import { categorize } from "@/lib/category";
import { deriveStatus } from "@/lib/risk";
import { computeScore } from "@/lib/scoring";

describe("computeScore", () => {
  it("returns a value in [0, 100]", () => {
    const s = computeScore({ netMargin: 0.1, confidence: 0.8, liquidity: 10000 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("rewards higher margin, confidence, and liquidity", () => {
    const weak = computeScore({ netMargin: 0.05, confidence: 0.5, liquidity: 0 });
    const strong = computeScore({ netMargin: 0.2, confidence: 0.95, liquidity: 100000 });
    expect(strong).toBeGreaterThan(weak);
  });

  it("saturates margin so an implausible spread does not dominate", () => {
    const a = computeScore({ netMargin: 0.2, confidence: 0.9, liquidity: 50000 });
    const b = computeScore({ netMargin: 0.6, confidence: 0.9, liquidity: 50000 });
    expect(b).toBe(a); // both clamp the margin component to full
  });
});

describe("deriveStatus", () => {
  it("flags low confidence as HIGH RISK", () => {
    expect(deriveStatus({ confidence: 0.5, netMargin: 0.08, venues: ["kalshi", "polymarket"] })).toBe(
      "HIGH_RISK",
    );
  });

  it("flags an outsized margin as HIGH RISK", () => {
    expect(deriveStatus({ confidence: 0.9, netMargin: 0.5, venues: ["kalshi", "polymarket"] })).toBe(
      "HIGH_RISK",
    );
  });

  it("marks well-matched, sane-margin opportunities VERIFIED", () => {
    expect(deriveStatus({ confidence: 0.9, netMargin: 0.08, venues: ["kalshi", "polymarket"] })).toBe(
      "VERIFIED",
    );
  });

  it("otherwise requires review", () => {
    expect(deriveStatus({ confidence: 0.7, netMargin: 0.08, venues: ["kalshi", "polymarket"] })).toBe(
      "REVIEW_REQUIRED",
    );
  });
});

describe("categorize", () => {
  it("classifies by keyword", () => {
    expect(categorize("Will the Strait of Hormuz close in July 2026?")).toBe("Geopolitics");
    expect(categorize("Will Bitcoin reach $200k in 2026?")).toBe("Crypto");
    expect(categorize("Who will win the 2028 presidential election?")).toBe("Politics");
    expect(categorize("Some entirely unrelated question")).toBe("Other");
  });
});
