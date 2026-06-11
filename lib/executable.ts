/**
 * On-demand order-book fetching for executable pricing (Step 6).
 *
 * This is intentionally per-opportunity (not bulk): order-book endpoints are
 * rate-limited and only worth hitting for an opportunity the user is actually
 * inspecting. Books that can't be fetched degrade gracefully — the executable
 * panel simply reports "unavailable" rather than failing.
 *
 *   • Polymarket — public CLOB book by token id (yes/no token from clobTokenIds).
 *   • Kalshi     — public order-book endpoint by ticker.
 *   • PredictIt  — no public order book; only best buy/sell, so unavailable.
 */

import type { OrderBook, OrderBookLevel } from "@/lib/types";

const POLY_CLOB = "https://clob.polymarket.com/book";
const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

function levelsFrom(
  raw: unknown,
  priceKey: string,
  sizeKey: string,
): OrderBookLevel[] {
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
 * Fetch a Kalshi order book by ticker and project it onto a buy-YES book.
 * Kalshi returns `yes`/`no` resting orders in cents; the cost to BUY YES is
 * (100 − no_bid_price) — i.e. the NO side mirrors YES asks. We expose YES asks.
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
    // Each entry is [price_cents, size]. The ask to BUY `side` is mirrored by
    // the resting orders on the opposite side: buy-YES asks come from NO bids.
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
