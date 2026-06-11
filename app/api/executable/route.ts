import { NextResponse } from "next/server";
import { fetchKalshiBook, fetchPolymarketBook } from "@/lib/executable";
import { computeExecutablePricing } from "@/lib/orderbook";
import type { OrderBook, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LegRequest {
  venue: Venue;
  /** Kalshi ticker, or any market id (unused for the fetch on Polymarket). */
  marketId?: string;
  /** Polymarket CLOB token id for this outcome. */
  clobTokenId?: string;
}

async function fetchBook(leg: LegRequest, side: "yes" | "no"): Promise<OrderBook | null> {
  if (leg.venue === "polymarket" && leg.clobTokenId) {
    return fetchPolymarketBook(leg.clobTokenId);
  }
  if (leg.venue === "kalshi" && leg.marketId) {
    return fetchKalshiBook(leg.marketId, side);
  }
  return null; // PredictIt and others: no public book
}

/**
 * POST /api/executable — compute executable pricing for one opportunity by
 * fetching both legs' order books on demand. Body:
 *   { indicativeMargin, yes: LegRequest, no: LegRequest }
 * Degrades gracefully: returns available:false when books can't be fetched.
 */
export async function POST(request: Request) {
  let body: { indicativeMargin?: number; yes?: LegRequest; no?: LegRequest };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { indicativeMargin = 0, yes, no } = body;
  if (!yes || !no) {
    return NextResponse.json({ error: "yes and no legs required" }, { status: 400 });
  }

  const [yesBook, noBook] = await Promise.all([
    fetchBook(yes, "yes"),
    fetchBook(no, "no"),
  ]);

  const pricing = computeExecutablePricing(
    { venue: yes.venue, book: yesBook ?? undefined },
    { venue: no.venue, book: noBook ?? undefined },
    indicativeMargin,
  );

  return NextResponse.json(pricing);
}
