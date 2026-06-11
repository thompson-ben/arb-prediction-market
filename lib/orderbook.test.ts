import { describe, expect, it } from "vitest";
import {
  type BookedMarket,
  computeExecutablePricing,
  depth,
  fillFromAsks,
} from "@/lib/orderbook";
import type { OrderBook } from "@/lib/types";

function book(asks: [number, number][]): OrderBook {
  return { bids: [], asks: asks.map(([price, size]) => ({ price, size })) };
}

describe("fillFromAsks", () => {
  it("walks levels cheapest-first and blends the price", () => {
    const fill = fillFromAsks(book([[0.4, 100], [0.45, 100]]), 150);
    expect(fill).not.toBeNull();
    expect(fill!.filledSize).toBe(150);
    // (0.4*100 + 0.45*50) / 150
    expect(fill!.averagePrice).toBeCloseTo((40 + 22.5) / 150, 6);
    expect(fill!.complete).toBe(true);
  });

  it("reports incomplete fills when depth runs out", () => {
    const fill = fillFromAsks(book([[0.4, 50]]), 100);
    expect(fill!.filledSize).toBe(50);
    expect(fill!.complete).toBe(false);
  });

  it("returns null with no book", () => {
    expect(fillFromAsks(undefined, 10)).toBeNull();
  });
});

describe("depth", () => {
  it("sums level sizes", () => {
    expect(depth(book([[0.4, 100], [0.45, 50]]).asks)).toBe(150);
  });
});

describe("computeExecutablePricing", () => {
  const yes: BookedMarket = { venue: "polymarket", book: book([[0.4, 100], [0.45, 100]]) };
  const no: BookedMarket = { venue: "polymarket", book: book([[0.5, 100], [0.7, 100]]) };

  it("shrinks the margin as size grows and finds a positive max size", () => {
    const pricing = computeExecutablePricing(yes, no, 0.1);
    expect(pricing.available).toBe(true);
    expect(pricing.executableMargin).not.toBeNull();
    expect(pricing.executableMargin!).toBeGreaterThanOrEqual(0);
    expect(pricing.executableMargin!).toBeLessThan(0.1); // below top-of-book indicative
    expect(pricing.maxSize!).toBeGreaterThan(100);
    expect(pricing.maxSize!).toBeLessThan(200);
    expect(pricing.maxStake!).toBeGreaterThan(0);
  });

  it("is unavailable when a book is missing", () => {
    const pricing = computeExecutablePricing(yes, { venue: "predictit" }, 0.1);
    expect(pricing.available).toBe(false);
    expect(pricing.executableMargin).toBeNull();
    expect(pricing.indicativeMargin).toBe(0.1);
  });
});
