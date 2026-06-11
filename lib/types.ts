/** Core domain types for cross-venue prediction-market arbitrage. */

export type Venue = "polymarket" | "kalshi" | "predictit";

export type Side = "YES" | "NO";

/**
 * A binary (Yes/No) market normalized into a common shape across venues.
 * `yesAsk` / `noAsk` are the cost in dollars (0–1) to acquire one share of
 * that outcome. `NaN` means that side is currently not purchasable.
 */
export interface NormalizedMarket {
  venue: Venue;
  /** Venue-specific identifier (Polymarket id / Kalshi ticker). */
  id: string;
  /** Human-readable market question for display. */
  title: string;
  /** Cost to buy a YES share, in dollars (0–1). */
  yesAsk: number;
  /** Cost to buy a NO share, in dollars (0–1). */
  noAsk: number;
  /** ISO resolution/close date, if known. */
  endDate?: string;
  /** Link to the market on its venue. */
  url: string;
  /** Traded volume, if reported (used only for ranking input). */
  volume?: number;
  /** Normalized significant tokens used for cross-venue matching. */
  tokens: string[];
}

/** One leg of an arbitrage trade: a single outcome to buy on a single venue. */
export interface ArbLeg {
  venue: Venue;
  side: Side;
  /** Price paid for the share, in dollars (0–1). */
  price: number;
  title: string;
  url: string;
}

/** A cross-venue arbitrage opportunity between two matched markets. */
export interface Opportunity {
  /** Stable composite id (venueA market id + venueB market id). */
  id: string;
  /** Representative question for the matched event. */
  question: string;
  /** Title-similarity score of the match, 0–1 (higher = more confident). */
  matchScore: number;
  /** The two venues involved, in leg order. */
  venues: [Venue, Venue];
  /** The two outcomes to buy. Together they cover both sides of the event. */
  legs: [ArbLeg, ArbLeg];
  /** Combined cost of both legs including upfront trading fees, in dollars. */
  cost: number;
  /** Margin before resolution/profit fees (1 - cost). */
  grossMargin: number;
  /**
   * Worst-case margin after per-venue trading and profit fees — the honest,
   * guaranteed edge. Always ≤ grossMargin.
   */
  netMargin: number;
  /** grossMargin as a percentage. */
  grossMarginPct: number;
  /** netMargin as a percentage. */
  netMarginPct: number;
  /** Underlying matched market on each venue (for inspection). */
  marketA: NormalizedMarket;
  marketB: NormalizedMarket;
  /** Earliest resolution date among the legs, if known. */
  endDate?: string;
}

/** Result of a full scan across all configured venues. */
export interface ScanResult {
  opportunities: Opportunity[];
  /** Number of normalized markets pulled per venue. */
  counts: Partial<Record<Venue, number>>;
  config: { minMargin: number; matchThreshold: number };
  generatedAt: string;
}
