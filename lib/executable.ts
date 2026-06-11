/**
 * On-demand order-book fetching for executable pricing (Step 6 / Phase 3.5).
 *
 * Per-opportunity, not bulk: order-book endpoints are rate-limited and only
 * worth hitting for opportunities being inspected (detail panel) or sampled
 * (the analytics cron prices the top-N). Books that can't be fetched degrade
 * gracefully — pricing reports `available: false` rather than throwing.
 *
 *   • Polymarket — public CLOB book by token id (yes/no from clobTokenIds).
 *   • Kalshi     — public order-book endpoint by ticker.
 *   • PredictIt  — no public order book → unavailable.
 */

import { computeExecutablePricing } from "@/lib/orderbook";
import type {
  ExecutablePricing,
  NormalizedMarket,
  OrderBook,
  OrderBookLevel,
  Opportunity,
  Side,
  Venue,
} from "@/lib/types";

const POLY_CLOB = "https://clob.polymarket.com/book";
const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export interface LegRef {
  venue: Venue;
  /** Kalshi ticker (or any market id). */
  marketId?: string;
  /** Polymarket CLOB token id for this outcome. */
  clobTokenId?: string;
}

function levelsFrom(raw: unknown, priceKey: string, sizeKey: string): OrderBookLevel[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderBookLevel[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const price = Number((item as Record<string, unknown>)[priceKey]);
      const size = Number((item as Record<string, unknown>)[sizeKey]);
      if (Number.isFinite(price) && Number.isFinite(size) && size > 0) {
        out.push({ price, size });
      }
    }
  }
  return out;
}

/** Fetch the ask side of a Polymarket CLOB book for a given outcome token. */
export async function fetchPolymarketBook(tokenId: string): Promise<OrderBook | null> {
  try {
    const res = await fetch(`${POLY_CLOB}?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { bids?: unknown; asks?: unknown };
    return {
      bids: levelsFrom(data.bids, "price", "size"),
      asks: levelsFrom(data.asks, "price", "size"),
      asOf: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a Kalshi order book by ticker and project it onto a buy-`side` book.
 * Kalshi entries are [price_cents, size]; the cost to BUY one side is mirrored
 * by the opposite side's resting orders (buy-YES asks come from NO bids).
 */
export async function fetchKalshiBook(
  ticker: string,
  side: "yes" | "no",
): Promise<OrderBook | null> {
  try {
    const res = await fetch(
      `${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}/orderbook`,
      { headers: { accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      orderbook?: { yes?: [number, number][]; no?: [number, number][] };
    };
    const book = data.orderbook ?? {};
    const opposite = side === "yes" ? book.no : book.yes;
    const asks: OrderBookLevel[] = (opposite ?? [])
      .filter((e) => Array.isArray(e) && e.length >= 2)
      .map(([priceCents, size]) => ({ price: (100 - priceCents) / 100, size }))
      .filter((l) => l.price > 0 && l.price < 1 && l.size > 0)
      .sort((a, b) => a.price - b.price);
    return { bids: [], asks, asOf: new Date().toISOString() };
  } catch {
    return null;
  }
}

async function fetchBookForRef(ref: LegRef, side: "yes" | "no"): Promise<OrderBook | null> {
  if (ref.venue === "polymarket" && ref.clobTokenId) {
    return fetchPolymarketBook(ref.clobTokenId);
  }
  if (ref.venue === "kalshi" && ref.marketId) {
    return fetchKalshiBook(ref.marketId, side);
  }
  return null; // PredictIt and others: no public book
}

/** Fetch both legs' books and compute executable pricing. */
export async function priceLegs(
  yes: LegRef,
  no: LegRef,
  indicativeMargin: number,
): Promise<ExecutablePricing> {
  const [yesBook, noBook] = await Promise.all([
    fetchBookForRef(yes, "yes"),
    fetchBookForRef(no, "no"),
  ]);
  return computeExecutablePricing(
    { venue: yes.venue, book: yesBook ?? undefined },
    { venue: no.venue, book: noBook ?? undefined },
    indicativeMargin,
  );
}

/** The market backing a given leg side (the one whose venue matches the leg). */
function marketForSide(o: Opportunity, side: Side): NormalizedMarket {
  const leg = o.legs.find((l) => l.side === side) ?? o.legs[0];
  return [o.marketA, o.marketB].find((m) => m.venue === leg.venue) ?? o.marketA;
}

/** Build the order-book leg references for an opportunity. */
export function legRefsFor(o: Opportunity): {
  yes: LegRef;
  no: LegRef;
  indicativeMargin: number;
} {
  const yesMarket = marketForSide(o, "YES");
  const noMarket = marketForSide(o, "NO");
  return {
    indicativeMargin: o.netMargin,
    yes: {
      venue: yesMarket.venue,
      marketId: yesMarket.id,
      clobTokenId: yesMarket.clobTokenIds?.[0],
    },
    no: {
      venue: noMarket.venue,
      marketId: noMarket.id,
      clobTokenId: noMarket.clobTokenIds?.[1],
    },
  };
}

/** Convenience: price an opportunity end-to-end. */
export function priceOpportunity(o: Opportunity): Promise<ExecutablePricing> {
  const refs = legRefsFor(o);
  return priceLegs(refs.yes, refs.no, refs.indicativeMargin);
}
