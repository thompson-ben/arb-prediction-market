import { describe, expect, it } from "vitest";
import { normalizePredictItMarket } from "@/lib/predictit";

describe("normalizePredictItMarket", () => {
  it("normalizes a single-contract market to one binary market", () => {
    const markets = normalizePredictItMarket({
      id: 100,
      name: "Will the Strait of Hormuz close in July 2026?",
      url: "https://www.predictit.org/markets/detail/100",
      contracts: [
        { id: 1, name: "Yes", bestBuyYesCost: 0.42, bestBuyNoCost: 0.6, dateEnd: "2026-07-31T00:00:00" },
      ],
    });
    expect(markets).toHaveLength(1);
    expect(markets[0]!.venue).toBe("predictit");
    expect(markets[0]!.yesAsk).toBe(0.42);
    expect(markets[0]!.noAsk).toBe(0.6);
    expect(markets[0]!.endDate).toMatch(/^2026-07-31/);
    expect(markets[0]!.title).toBe("Will the Strait of Hormuz close in July 2026?");
  });

  it("expands a multi-contract market into one market per contract", () => {
    const markets = normalizePredictItMarket({
      id: 200,
      name: "Which party wins the 2026 Senate?",
      url: "https://www.predictit.org/markets/detail/200",
      contracts: [
        { id: 1, name: "Republicans", bestBuyYesCost: 0.55, bestBuyNoCost: 0.46 },
        { id: 2, name: "Democrats", bestBuyYesCost: 0.46, bestBuyNoCost: 0.55 },
      ],
    });
    expect(markets).toHaveLength(2);
    expect(markets[0]!.title).toContain("Republicans");
    expect(markets[0]!.tokens).toContain("senate");
    expect(markets[0]!.tokens).toContain("republicans");
  });

  it("treats null/zero buy costs as untradeable (NaN)", () => {
    const markets = normalizePredictItMarket({
      id: 300,
      name: "Some market 2026",
      contracts: [{ id: 1, name: "Yes", bestBuyYesCost: null, bestBuyNoCost: 0 }],
    });
    expect(Number.isNaN(markets[0]!.yesAsk)).toBe(true);
    expect(Number.isNaN(markets[0]!.noAsk)).toBe(true);
  });
});
