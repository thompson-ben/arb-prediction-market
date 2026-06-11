import { jaccard } from "@/lib/normalize";
import type { ArbLeg, NormalizedMarket, Opportunity } from "@/lib/types";

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
  };
}

/**
 * Given two matched markets, find the cheaper of the two arbitrage directions
 * (buy YES on one venue + NO on the other). Returns null if neither direction
 * is tradeable.
 */
export function computeArb(
  pm: NormalizedMarket,
  kalshi: NormalizedMarket,
): { cost: number; margin: number; legs: [ArbLeg, ArbLeg] } | null {
  const directions: { cost: number; legs: [ArbLeg, ArbLeg] }[] = [];

  // Direction A: YES on Polymarket + NO on Kalshi.
  if (isTradeable(pm.yesAsk) && isTradeable(kalshi.noAsk)) {
    directions.push({
      cost: pm.yesAsk + kalshi.noAsk,
      legs: [leg(pm, "YES", pm.yesAsk), leg(kalshi, "NO", kalshi.noAsk)],
    });
  }
  // Direction B: YES on Kalshi + NO on Polymarket.
  if (isTradeable(kalshi.yesAsk) && isTradeable(pm.noAsk)) {
    directions.push({
      cost: kalshi.yesAsk + pm.noAsk,
      legs: [leg(kalshi, "YES", kalshi.yesAsk), leg(pm, "NO", pm.noAsk)],
    });
  }

  if (directions.length === 0) return null;

  const best = directions.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { cost: best.cost, margin: 1 - best.cost, legs: best.legs };
}

function earliestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export interface MatchOptions {
  /** Minimum margin fraction to report (e.g. 0.05 for 5%). */
  minMargin: number;
  /** Minimum title similarity to treat two markets as the same event. */
  matchThreshold: number;
}

/**
 * Match Polymarket markets against Kalshi markets and return the cross-venue
 * arbitrage opportunities whose margin meets `minMargin`, sorted by margin
 * descending. Uses an inverted token index so matching stays roughly linear
 * rather than O(n × m).
 */
export function buildOpportunities(
  polymarket: NormalizedMarket[],
  kalshi: NormalizedMarket[],
  options: MatchOptions,
): Opportunity[] {
  // token -> indices of kalshi markets containing it
  const index = new Map<string, number[]>();
  kalshi.forEach((market, i) => {
    for (const token of new Set(market.tokens)) {
      const bucket = index.get(token);
      if (bucket) bucket.push(i);
      else index.set(token, [i]);
    }
  });

  const opportunities: Opportunity[] = [];

  for (const pm of polymarket) {
    // Gather candidate kalshi markets that share at least one token.
    const candidateIndices = new Set<number>();
    for (const token of new Set(pm.tokens)) {
      const bucket = index.get(token);
      if (bucket) for (const i of bucket) candidateIndices.add(i);
    }

    // Pick the best-scoring candidate above the threshold.
    let best: { market: NormalizedMarket; score: number } | null = null;
    for (const i of candidateIndices) {
      const candidate = kalshi[i];
      const score = jaccard(pm.tokens, candidate.tokens);
      if (score >= options.matchThreshold && (best === null || score > best.score)) {
        best = { market: candidate, score };
      }
    }
    if (best === null) continue;

    const arb = computeArb(pm, best.market);
    if (arb === null || arb.margin < options.minMargin) continue;

    opportunities.push({
      id: `${pm.id}::${best.market.id}`,
      question: pm.title,
      matchScore: best.score,
      legs: arb.legs,
      cost: arb.cost,
      margin: arb.margin,
      marginPct: arb.margin * 100,
      polymarket: pm,
      kalshi: best.market,
      endDate: earliestDate(pm.endDate, best.market.endDate),
    });
  }

  return opportunities.sort((a, b) => b.margin - a.margin);
}
