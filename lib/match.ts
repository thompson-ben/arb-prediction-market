import { categorize } from "@/lib/category";
import { jaccard } from "@/lib/normalize";
import { bottleneckLiquidity, deriveStatus, riskNotes } from "@/lib/risk";
import { computeScore } from "@/lib/scoring";
import type { ArbLeg, NormalizedMarket, Opportunity } from "@/lib/types";
import { VENUES } from "@/lib/venues";

/** A price is usable for an arb leg only if it is a real, sub-\$1 cost. */
function isTradeable(price: number): boolean {
  return Number.isFinite(price) && price > 0 && price < 1;
}

function leg(market: NormalizedMarket, side: "YES" | "NO", price: number): ArbLeg {
  return {
    venue: market.venue,
    side,
    price,
    title: market.title,
    url: market.url,
    liquidity: market.liquidity,
  };
}

/** Buy cost for one share including the venue's upfront trading fee. */
function legCost(market: NormalizedMarket, price: number): number {
  return price + VENUES[market.venue].tradingFee(price);
}

export interface ArbResult {
  cost: number;
  grossMargin: number;
  netMargin: number;
  legs: [ArbLeg, ArbLeg];
}

/**
 * Evaluate one arbitrage direction: buy YES on `yesM` and NO on `noM`.
 *
 * Gross margin ignores fees. Net margin is the *worst case* across the two
 * possible resolutions, after subtracting each winning leg's profit fee — i.e.
 * the guaranteed edge you actually keep.
 */
function evaluateDirection(
  yesM: NormalizedMarket,
  yesPrice: number,
  noM: NormalizedMarket,
  noPrice: number,
): ArbResult | null {
  if (!isTradeable(yesPrice) || !isTradeable(noPrice)) return null;

  // Gross margin is the raw price spread, before any fees.
  const grossMargin = 1 - (yesPrice + noPrice);

  // Actual cash outlay includes each venue's upfront trading fee.
  const cost = legCost(yesM, yesPrice) + legCost(noM, noPrice);

  // If the event resolves YES, the YES leg pays \$1 minus its profit fee; the
  // NO leg expires worthless. Vice-versa for a NO resolution. Net margin is the
  // worst of the two — the guaranteed edge after trading and profit fees.
  const yesWinNet = 1 - VENUES[yesM.venue].profitFeeRate * (1 - yesPrice) - cost;
  const noWinNet = 1 - VENUES[noM.venue].profitFeeRate * (1 - noPrice) - cost;
  const netMargin = Math.min(yesWinNet, noWinNet);

  return {
    cost,
    grossMargin,
    netMargin,
    legs: [leg(yesM, "YES", yesPrice), leg(noM, "NO", noPrice)],
  };
}

/**
 * Given two matched markets on different venues, return the better of the two
 * arbitrage directions (by net margin), or null if neither is tradeable.
 */
export function computeArb(
  a: NormalizedMarket,
  b: NormalizedMarket,
): ArbResult | null {
  const directions = [
    evaluateDirection(a, a.yesAsk, b, b.noAsk), // YES on a + NO on b
    evaluateDirection(b, b.yesAsk, a, a.noAsk), // YES on b + NO on a
  ].filter((d): d is ArbResult => d !== null);

  if (directions.length === 0) return null;
  return directions.reduce((best, d) => (d.netMargin > best.netMargin ? d : best));
}

function earliestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export interface MatchOptions {
  /** Minimum net margin fraction to report (e.g. 0.05 for 5%). */
  minMargin: number;
  /** Minimum title similarity to treat two markets as the same event. */
  matchThreshold: number;
}

/**
 * Match markets across venues from a single pooled list and return the
 * cross-venue arbitrage opportunities whose *net* margin meets `minMargin`,
 * sorted by net margin descending.
 *
 * Uses an inverted token index so each market is only compared against
 * candidates that share a significant token, keeping this near-linear rather
 * than O(n²). Each unordered cross-venue pair is evaluated at most once.
 */
export function buildOpportunities(
  markets: NormalizedMarket[],
  options: MatchOptions,
): Opportunity[] {
  // token -> indices of markets containing it
  const index = new Map<string, number[]>();
  markets.forEach((market, i) => {
    for (const token of new Set(market.tokens)) {
      const bucket = index.get(token);
      if (bucket) bucket.push(i);
      else index.set(token, [i]);
    }
  });

  const opportunities: Opportunity[] = [];

  for (let i = 0; i < markets.length; i++) {
    const a = markets[i];

    // Candidate indices sharing at least one token with `a`.
    const candidates = new Set<number>();
    for (const token of new Set(a.tokens)) {
      const bucket = index.get(token);
      if (bucket) for (const j of bucket) if (j > i) candidates.add(j);
    }

    for (const j of candidates) {
      const b = markets[j];
      if (a.venue === b.venue) continue; // arb requires two different venues

      const score = jaccard(a.tokens, b.tokens);
      if (score < options.matchThreshold) continue;

      const arb = computeArb(a, b);
      if (arb === null || arb.netMargin < options.minMargin) continue;

      const venues: [typeof a.venue, typeof b.venue] = [
        arb.legs[0].venue,
        arb.legs[1].venue,
      ];
      const endDate = earliestDate(a.endDate, b.endDate);
      const liquidity = bottleneckLiquidity(a, b);
      const riskInput = {
        confidence: score,
        netMargin: arb.netMargin,
        venues,
        liquidity,
        endDate,
      };

      opportunities.push({
        id: `${a.id}::${b.id}`,
        question: a.title,
        category: categorize(a.title),
        matchScore: score,
        score: computeScore({
          netMargin: arb.netMargin,
          confidence: score,
          liquidity,
          endDate,
        }),
        status: deriveStatus(riskInput),
        riskNotes: riskNotes(riskInput),
        pricing: "indicative",
        venues,
        legs: arb.legs,
        cost: arb.cost,
        grossMargin: arb.grossMargin,
        netMargin: arb.netMargin,
        grossMarginPct: arb.grossMargin * 100,
        netMarginPct: arb.netMargin * 100,
        liquidity,
        marketA: a,
        marketB: b,
        endDate,
      });
    }
  }

  // Default ordering is by actionability score (Priority 6).
  return opportunities.sort((x, y) => y.score - x.score);
}
