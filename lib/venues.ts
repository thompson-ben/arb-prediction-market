import type { Venue } from "@/lib/types";

/**
 * Per-venue metadata and fee model. Fees are approximations of each venue's
 * published schedule, expressed per \$1 of payout notional (1 contract that
 * settles at \$1). They are used to compute a fee-adjusted *net* margin — the
 * honest, after-cost edge — alongside the raw gross margin.
 */
export interface VenueInfo {
  id: Venue;
  label: string;
  /** Whether opportunities on this venue are real-money tradable. */
  tradable: boolean;
  /**
   * Upfront trading fee charged when buying a share, per \$1 notional, as a
   * function of the share price (0–1). Added to the cost basis.
   */
  tradingFee: (price: number) => number;
  /**
   * Fraction of a *winning* leg's profit taken at resolution (e.g. PredictIt
   * charges 5% of profit). Applied to the winning side in each outcome.
   */
  profitFeeRate: number;
}

export const VENUES: Record<Venue, VenueInfo> = {
  polymarket: {
    id: "polymarket",
    label: "Polymarket",
    tradable: true,
    // Currently 0% maker/taker trading fees (gas on deposit/withdraw ignored).
    tradingFee: () => 0,
    profitFeeRate: 0,
  },
  kalshi: {
    id: "kalshi",
    label: "Kalshi",
    tradable: true,
    // Approx. general trading fee: ceil(0.07 × C × P × (1−P)); per \$1 ≈ 0.07·P·(1−P).
    tradingFee: (p) => 0.07 * p * (1 - p),
    profitFeeRate: 0,
  },
  predictit: {
    id: "predictit",
    label: "PredictIt",
    tradable: true,
    // No per-trade fee, but 5% of profit on winning positions (+5% withdrawal,
    // not modeled per-trade — see README caveats).
    tradingFee: () => 0,
    profitFeeRate: 0.05,
  },
};

export function venueLabel(venue: Venue): string {
  return VENUES[venue]?.label ?? venue;
}

/** Pretty-print a stored venue_pair key like "kalshi ↔ polymarket". */
export function venuePairLabel(pair: string): string {
  return pair
    .split(" ↔ ")
    .map((v) => venueLabel(v as Venue))
    .join(" ↔ ");
}
