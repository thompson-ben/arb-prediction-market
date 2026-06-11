/** Core domain types for cross-venue prediction-market arbitrage. */

export type Venue = "polymarket" | "kalshi" | "predictit";

export type Side = "YES" | "NO";

/** High-level market categories used for filtering. */
export const CATEGORIES = [
  "Politics",
  "Geopolitics",
  "Economics",
  "Crypto",
  "Sports",
  "Tech & Science",
  "Entertainment",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Source of the prices behind an opportunity. */
export type PricingMode = "indicative" | "orderbook";

/** Trust indicator derived from confidence and margin. */
export type OpportunityStatus = "VERIFIED" | "REVIEW_REQUIRED" | "HIGH_RISK";

// ── Priority 5: order-book foundation (data structures only) ──────────────
// These describe executable depth. They are not yet populated by the venue
// clients; see lib/orderbook.ts for the (intentionally stubbed) executable
// arbitrage path that will eventually replace indicative pricing.

export interface OrderBookLevel {
  /** Price per share, in dollars (0–1). */
  price: number;
  /** Number of shares available at this level. */
  size: number;
}

export interface OrderBook {
  /** Resting buy orders, best (highest) price first. */
  bids: OrderBookLevel[];
  /** Resting sell orders, best (lowest) price first. */
  asks: OrderBookLevel[];
  /** When the snapshot was taken (ISO), if known. */
  asOf?: string;
}

/**
 * A binary (Yes/No) market normalized into a common shape across venues.
 * `yesAsk` / `noAsk` are the cost in dollars (0–1) to acquire one share of
 * that outcome. `NaN` means that side is currently not purchasable.
 */
export interface NormalizedMarket {
  venue: Venue;
  /** Venue-specific identifier (Polymarket id / Kalshi ticker / PredictIt id). */
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
  /** Traded volume, if reported (units vary by venue). */
  volume?: number;
  /** Reported liquidity in dollars, if available. */
  liquidity?: number;
  /** Normalized significant tokens used for cross-venue matching. */
  tokens: string[];
  /** Executable depth — reserved for the order-book pricing path (Priority 5). */
  book?: OrderBook;
}

/** One leg of an arbitrage trade: a single outcome to buy on a single venue. */
export interface ArbLeg {
  venue: Venue;
  side: Side;
  /** Price paid for the share, in dollars (0–1). */
  price: number;
  title: string;
  url: string;
  /** Reported liquidity for this leg's market, if available. */
  liquidity?: number;
}

/** A cross-venue arbitrage opportunity between two matched markets. */
export interface Opportunity {
  /** Stable composite id (venueA market id + venueB market id). */
  id: string;
  /** Representative question for the matched event. */
  question: string;
  /** Inferred category for filtering. */
  category: Category;
  /** Title-similarity score of the match, 0–1 (higher = more confident). */
  matchScore: number;
  /** Actionability score, 0–100 (margin + confidence + liquidity + time). */
  score: number;
  /** Trust indicator derived from confidence and margin. */
  status: OpportunityStatus;
  /** Human-readable risk notes for the detail view. */
  riskNotes: string[];
  /** Whether prices are indicative quotes or executable order-book fills. */
  pricing: PricingMode;
  /** The two venues involved, in leg order. */
  venues: [Venue, Venue];
  /** The two outcomes to buy. Together they cover both sides of the event. */
  legs: [ArbLeg, ArbLeg];
  /** Combined cost of both legs including upfront trading fees, in dollars. */
  cost: number;
  /** Margin before resolution/profit fees (1 - raw price spread). */
  grossMargin: number;
  /** Worst-case margin after per-venue trading and profit fees. */
  netMargin: number;
  /** grossMargin as a percentage. */
  grossMarginPct: number;
  /** netMargin as a percentage. */
  netMarginPct: number;
  /** Bottleneck liquidity across the two legs, in dollars, if known. */
  liquidity?: number;
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
  /** Total markets scanned across all venues. */
  marketsScanned: number;
  /** Number of venues that returned data. */
  venuesScanned: number;
  /** Per-venue fetch errors, if any (partial-result mode). */
  errors: Partial<Record<Venue, string>>;
  /** Discovery thresholds used for the scan (display floor, not user filters). */
  config: { minMargin: number; matchThreshold: number };
  generatedAt: string;
}
