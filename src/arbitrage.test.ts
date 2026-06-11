import { describe, expect, it } from "vitest";
import {
  findArbitrage,
  findCrossVenueArbs,
  findSingleMarketArbs,
} from "./arbitrage.js";
import type { Market } from "./types.js";

const market = (overrides: Partial<Market> = {}): Market => ({
  eventId: "evt-1",
  question: "Will it rain?",
  venue: "venueA",
  yesAsk: 0.5,
  noAsk: 0.5,
  ...overrides,
});

describe("findSingleMarketArbs", () => {
  it("detects a market priced below \$1", () => {
    const arbs = findSingleMarketArbs([market({ yesAsk: 0.45, noAsk: 0.5 })]);
    expect(arbs).toHaveLength(1);
    expect(arbs[0]!.profit).toBeCloseTo(0.05);
    expect(arbs[0]!.kind).toBe("single-market");
  });

  it("ignores efficiently-priced markets", () => {
    expect(findSingleMarketArbs([market({ yesAsk: 0.5, noAsk: 0.5 })])).toEqual(
      [],
    );
  });
});

describe("findCrossVenueArbs", () => {
  it("combines the cheapest YES and NO across venues", () => {
    const arbs = findCrossVenueArbs([
      market({ venue: "venueA", yesAsk: 0.4, noAsk: 0.65 }),
      market({ venue: "venueB", yesAsk: 0.55, noAsk: 0.5 }),
    ]);
    expect(arbs).toHaveLength(1);
    // cheapest YES (0.4 @ A) + cheapest NO (0.5 @ B) = 0.9
    expect(arbs[0]!.cost).toBeCloseTo(0.9);
    expect(arbs[0]!.kind).toBe("cross-venue");
  });

  it("does not flag a single venue as cross-venue", () => {
    const arbs = findCrossVenueArbs([
      market({ venue: "venueA", yesAsk: 0.4, noAsk: 0.4 }),
    ]);
    expect(arbs).toEqual([]);
  });
});

describe("findArbitrage", () => {
  it("sorts opportunities by descending profit", () => {
    const arbs = findArbitrage([
      market({ eventId: "a", yesAsk: 0.49, noAsk: 0.49 }),
      market({ eventId: "b", yesAsk: 0.3, noAsk: 0.3 }),
    ]);
    expect(arbs.map((a) => a.eventId)).toEqual(["b", "a"]);
  });
});
