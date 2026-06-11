import type { NormalizedMarket, OpportunityStatus, Venue } from "@/lib/types";
import { daysToExpiry } from "@/lib/scoring";

export interface RiskInput {
  confidence: number;
  netMargin: number;
  venues: Venue[];
  liquidity?: number;
  endDate?: string;
}

/**
 * Trust indicator (Priority 3). A high margin is treated as *suspicious*, not
 * good — genuine cross-venue edges are usually small, so an outsized spread
 * most often signals a bad match or stale quote.
 */
export function deriveStatus(input: RiskInput): OpportunityStatus {
  if (input.confidence < 0.6 || input.netMargin > 0.4) return "HIGH_RISK";
  if (input.confidence >= 0.85 && input.netMargin <= 0.25) return "VERIFIED";
  return "REVIEW_REQUIRED";
}

/** Generate human-readable risk notes for the detail panel. */
export function riskNotes(input: RiskInput): string[] {
  const notes: string[] = [];

  if (input.confidence < 0.7) {
    notes.push(
      "Markets were paired automatically by title similarity — confirm both resolve on identical terms, sources, and dates.",
    );
  }
  if (input.netMargin > 0.25) {
    notes.push(
      "Unusually large margin. Genuine arbitrage is typically small; this often indicates a market mismatch or a stale quote.",
    );
  }
  if (input.venues.includes("predictit")) {
    notes.push(
      "PredictIt charges 5% on profits and 5% on withdrawals, and caps positions at $850 per contract — net edge may be thinner than shown.",
    );
  }
  if (!input.liquidity || input.liquidity < 1000) {
    notes.push(
      "Thin or unreported liquidity — your size may not fill at the quoted prices.",
    );
  }

  const days = daysToExpiry(input.endDate);
  if (days !== undefined && days < 2) {
    notes.push("Resolves imminently — execution and settlement timing risk.");
  } else if (days !== undefined && days > 180) {
    notes.push("Distant resolution — capital is tied up for a long period.");
  }

  notes.push(
    "Prices are indicative quotes, not order-book fills; slippage is not yet modeled.",
  );

  return notes;
}

/** Bottleneck liquidity across two legs (the smaller of the two known values). */
export function bottleneckLiquidity(
  a: NormalizedMarket,
  b: NormalizedMarket,
): number | undefined {
  const values = [a.liquidity, b.liquidity].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (values.length === 0) return undefined;
  return Math.min(...values);
}
