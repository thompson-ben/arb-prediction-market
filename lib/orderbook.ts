/**
 * Step 6 — Executable (order-book) arbitrage.
 *
 * Indicative pricing uses a single ask per side. Executable pricing walks real
 * order-book depth: a larger stake must consume deeper, worse-priced levels, so
 * the executable margin shrinks as size grows. These functions are pure and
 * fully tested; the venue clients populate `NormalizedMarket.book` on demand
 * (see lib/executable.ts and /api/executable).
 */

import { VENUES } from "@/lib/venues";
import type {
  ExecutableLeg,
  ExecutablePricing,
  OrderBook,
  OrderBookLevel,
  Side,
  Venue,
} from "@/lib/types";

/** Minimal shape needed for executable pricing: a venue and (optionally) a book. */
export interface BookedMarket {
  venue: Venue;
  book?: OrderBook;
}

/** A fill computed by walking the ask side of a book for a desired size. */
export interface Fill {
  filledSize: number;
  averagePrice: number;
  cost: number;
  complete: boolean;
}

/** Total size resting across levels. */
export function depth(levels: OrderBookLevel[] | undefined): number {
  if (!levels) return 0;
  return levels.reduce((sum, l) => sum + Math.max(0, l.size), 0);
}

/**
 * Walk the ask side (lowest price first) to BUY `size` shares. Returns the
 * blended fill; `complete` is false if depth ran out before `size`.
 */
export function fillFromAsks(book: OrderBook | undefined, size: number): Fill | null {
  if (!book || book.asks.length === 0 || size <= 0) return null;

  const asks = [...book.asks].sort((a, b) => a.price - b.price);
  let remaining = size;
  let cost = 0;
  let filled = 0;

  for (const level of asks) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    cost += take * level.price;
    filled += take;
    remaining -= take;
  }

  if (filled <= 0) return null;
  return {
    filledSize: filled,
    averagePrice: cost / filled,
    cost,
    complete: remaining <= 1e-9,
  };
}

/** Average ask price to buy `size`, or null if undepth. */
function blendedAsk(book: OrderBook | undefined, size: number): number | null {
  const fill = fillFromAsks(book, size);
  return fill ? fill.averagePrice : null;
}

/** Net margin for a given pair-size, walking both books and applying fees. */
function executableMarginForSize(
  yesMarket: BookedMarket,
  noMarket: BookedMarket,
  size: number,
): number | null {
  const yesPrice = blendedAsk(yesMarket.book, size);
  const noPrice = blendedAsk(noMarket.book, size);
  if (yesPrice === null || noPrice === null) return null;

  const yesCost = yesPrice + VENUES[yesMarket.venue].tradingFee(yesPrice);
  const noCost = noPrice + VENUES[noMarket.venue].tradingFee(noPrice);
  const cost = yesCost + noCost;

  const yesWin = 1 - VENUES[yesMarket.venue].profitFeeRate * (1 - yesPrice) - cost;
  const noWin = 1 - VENUES[noMarket.venue].profitFeeRate * (1 - noPrice) - cost;
  return Math.min(yesWin, noWin);
}

function legSnapshot(market: BookedMarket, side: Side, size: number): ExecutableLeg {
  const fill = fillFromAsks(market.book, size);
  const asks = market.book?.asks ?? [];
  const topAsk = asks.length
    ? [...asks].sort((a, b) => a.price - b.price)[0].price
    : undefined;
  return {
    venue: market.venue,
    side,
    available: fill !== null,
    filledSize: fill?.filledSize ?? 0,
    averagePrice: fill?.averagePrice ?? Number.NaN,
    topAsk,
    depth: depth(asks),
  };
}

/**
 * Compute executable pricing for a YES-leg market and a NO-leg market that both
 * carry order books. Finds the largest pair-size (binary search over depth)
 * whose executable margin stays positive, and reports the size-aware margin at
 * that maximum stake. Returns `available: false` (with the indicative margin)
 * when either book is missing.
 */
export function computeExecutablePricing(
  yesMarket: BookedMarket,
  noMarket: BookedMarket,
  indicativeMargin: number,
): ExecutablePricing {
  const legs = [legSnapshot(yesMarket, "YES", 1), legSnapshot(noMarket, "NO", 1)];

  const maxDepth = Math.min(depth(yesMarket.book?.asks), depth(noMarket.book?.asks));
  if (!yesMarket.book || !noMarket.book || maxDepth <= 0) {
    return {
      available: false,
      indicativeMargin,
      executableMargin: null,
      maxStake: null,
      maxSize: null,
      legs,
      note: "Order-book depth unavailable for one or both legs.",
    };
  }

  // Margin is monotonically non-increasing in size: binary search the largest
  // size that still yields a positive executable margin.
  let lo = 0;
  let hi = maxDepth;
  if ((executableMarginForSize(yesMarket, noMarket, Math.min(1, maxDepth)) ?? -1) <= 0) {
    return {
      available: true,
      indicativeMargin,
      executableMargin: executableMarginForSize(yesMarket, noMarket, Math.min(1, maxDepth)),
      maxStake: 0,
      maxSize: 0,
      legs,
      note: "No positive executable margin at the top of book.",
    };
  }

  for (let iter = 0; iter < 40 && hi - lo > 1e-3; iter++) {
    const mid = (lo + hi) / 2;
    const m = executableMarginForSize(yesMarket, noMarket, mid);
    if (m !== null && m > 0) lo = mid;
    else hi = mid;
  }

  const maxSize = lo;
  const executableMargin = executableMarginForSize(yesMarket, noMarket, maxSize);
  const yesFill = fillFromAsks(yesMarket.book, maxSize);
  const noFill = fillFromAsks(noMarket.book, maxSize);
  const maxStake =
    yesFill && noFill
      ? yesFill.cost +
        noFill.cost +
        maxSize * (VENUES[yesMarket.venue].tradingFee(yesFill.averagePrice) +
          VENUES[noMarket.venue].tradingFee(noFill.averagePrice))
      : null;

  return {
    available: true,
    indicativeMargin,
    executableMargin,
    maxStake,
    maxSize,
    legs: [legSnapshot(yesMarket, "YES", maxSize), legSnapshot(noMarket, "NO", maxSize)],
  };
}
