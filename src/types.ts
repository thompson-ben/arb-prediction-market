/** Core domain types for prediction-market arbitrage. */

/** A named venue/exchange that hosts prediction markets. */
export type Venue = string;

/**
 * A binary prediction market for a single event outcome.
 * Prices are expressed in dollars per share, in the range [0, 1].
 */
export interface Market {
  /** Stable identifier for the underlying event (shared across venues). */
  eventId: string;
  /** Human-readable question, e.g. "Will it rain in NYC on 2026-07-04?". */
  question: string;
  /** Venue hosting this market. */
  venue: Venue;
  /** Best ask for the YES share, in dollars (0–1). */
  yesAsk: number;
  /** Best ask for the NO share, in dollars (0–1). */
  noAsk: number;
}

/** A detected arbitrage opportunity. */
export interface Opportunity {
  /** Event the opportunity relates to. */
  eventId: string;
  /** Kind of arbitrage. */
  kind: "single-market" | "cross-venue";
  /** Markets/legs involved in the trade. */
  legs: Market[];
  /**
   * Total cost to acquire a full set of outcomes that pays out exactly \$1.
   * An opportunity exists when this is below 1.
   */
  cost: number;
  /** Risk-free profit per \$1 payout (1 - cost). */
  profit: number;
}
