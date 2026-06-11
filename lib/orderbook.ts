/**
 * Priority 5 — Order-book foundation.
 *
 * This module defines the *shape* of executable arbitrage but does NOT yet
 * implement it. Today the scanner uses indicative quotes (a single ask price
 * per side). True executable arbitrage must walk real order-book depth to know
 * how much size can be filled and at what blended price.
 *
 * When venue clients begin populating `NormalizedMarket.book`, the functions
 * below can be implemented and swapped in behind the existing `pricing` flag,
 * upgrading opportunities from "indicative" to "orderbook" without changing the
 * UI or matching layers.
 */

import type { OrderBook, OrderBookLevel } from "@/lib/types";

/** A fill computed by walking the book for a desired size. */
export interface Fill {
  /** Shares actually fillable (may be less than requested if depth runs out). */
  filledSize: number;
  /** Average price per share across the consumed levels, in dollars. */
  averagePrice: number;
  /** Total cash cost of the fill, in dollars. */
  cost: number;
  /** Whether the full requested size was available. */
  complete: boolean;
}

/**
 * Walk the ask side of a book to fill `size` shares (the cost to BUY).
 * Returns the blended fill, or null if depth is unavailable.
 *
 * NOT YET IMPLEMENTED — placeholder for the executable-pricing path.
 */
export function fillFromAsks(
  _book: OrderBook | undefined,
  _size: number,
): Fill | null {
  return null;
}

/** Total size available on a side of the book (sum of level sizes). */
export function depth(levels: OrderBookLevel[] | undefined): number {
  if (!levels) return 0;
  return levels.reduce((sum, l) => sum + l.size, 0);
}

/**
 * Executable cross-venue arbitrage for a given target size.
 *
 * NOT YET IMPLEMENTED. Will replace indicative pricing once books are wired in:
 * walk both venues' ask books for the target size, compute the blended cost of
 * each leg, and return the size-aware net margin (which shrinks as size grows
 * and depth thins). Returning null keeps callers on the indicative path.
 */
export function computeExecutableArb(): null {
  return null;
}
