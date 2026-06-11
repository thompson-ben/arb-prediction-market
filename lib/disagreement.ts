import { categorize } from "@/lib/category";
import { jaccard } from "@/lib/normalize";
import type {
  Disagreement,
  NormalizedMarket,
  Venue,
  VenueProbability,
} from "@/lib/types";

/**
 * Implied YES probability (0–1) from a market's quotes. Uses the midpoint of
 * the YES ask and (1 − NO ask) when both are available, which is closer to the
 * true probability than the ask alone. Returns NaN when no usable quote exists.
 */
export function impliedYesProbability(market: NormalizedMarket): number {
  const estimates: number[] = [];
  if (Number.isFinite(market.yesAsk) && market.yesAsk > 0 && market.yesAsk < 1) {
    estimates.push(market.yesAsk);
  }
  if (Number.isFinite(market.noAsk) && market.noAsk > 0 && market.noAsk < 1) {
    estimates.push(1 - market.noAsk);
  }
  if (estimates.length === 0) return Number.NaN;
  return estimates.reduce((a, b) => a + b, 0) / estimates.length;
}

/** Preference order for choosing a cluster anchor. */
const ANCHOR_ORDER: Venue[] = ["polymarket", "kalshi", "predictit"];

/**
 * Identify markets where venues disagree on probability. Builds anchor-centered
 * clusters (one best-matching market per other venue) to avoid the transitive
 * over-merging that full union-find would cause, then computes the per-venue
 * implied probabilities and the spread.
 *
 * Distinct from arbitrage: a disagreement need not be tradeable (the prices may
 * still sum above \$1), but a large, confident spread is a signal in itself.
 */
export function buildDisagreements(
  markets: NormalizedMarket[],
  matchThreshold: number,
  minSpread = 0.05,
): Disagreement[] {
  const index = new Map<string, number[]>();
  markets.forEach((market, i) => {
    for (const token of new Set(market.tokens)) {
      const bucket = index.get(token);
      if (bucket) bucket.push(i);
      else index.set(token, [i]);
    }
  });

  const seen = new Map<string, Disagreement>();

  for (const anchor of markets) {
    // Best-matching market per *other* venue.
    const bestByVenue = new Map<Venue, { market: NormalizedMarket; score: number }>();
    const candidates = new Set<number>();
    for (const token of new Set(anchor.tokens)) {
      const bucket = index.get(token);
      if (bucket) for (const j of bucket) candidates.add(j);
    }
    for (const j of candidates) {
      const other = markets[j];
      if (other.venue === anchor.venue) continue;
      const score = jaccard(anchor.tokens, other.tokens);
      if (score < matchThreshold) continue;
      const current = bestByVenue.get(other.venue);
      if (!current || score > current.score) {
        bestByVenue.set(other.venue, { market: other, score });
      }
    }
    if (bestByVenue.size === 0) continue; // needs ≥ 2 venues total

    const members: NormalizedMarket[] = [anchor, ...[...bestByVenue.values()].map((v) => v.market)];
    const confidence = Math.min(...[...bestByVenue.values()].map((v) => v.score));

    const quotes: VenueProbability[] = members
      .map((m) => ({ venue: m.venue, impliedYes: impliedYesProbability(m), market: m }))
      .filter((q) => Number.isFinite(q.impliedYes))
      .sort((a, b) => b.impliedYes - a.impliedYes);

    if (quotes.length < 2) continue;

    const probs = quotes.map((q) => q.impliedYes);
    const spread = Math.max(...probs) - Math.min(...probs);
    if (spread < minSpread) continue;

    const id = members
      .map((m) => m.id)
      .sort()
      .join("::");

    const disagreement: Disagreement = {
      id,
      question: anchor.title,
      category: categorize(anchor.title),
      quotes,
      spread,
      confidence,
      endDate: anchor.endDate,
    };

    const existing = seen.get(id);
    if (!existing || disagreement.confidence > existing.confidence) {
      seen.set(id, disagreement);
    }
  }

  // Drop clusters whose member set is a strict subset of a larger cluster.
  const all = [...seen.values()];
  const keys = all.map((d) => new Set(d.id.split("::")));
  const kept = all.filter((d, i) => {
    return !all.some((other, k) => {
      if (k === i) return false;
      if (keys[k].size <= keys[i].size) return false;
      return [...keys[i]].every((id) => keys[k].has(id));
    });
  });

  return kept.sort((a, b) => b.spread - a.spread);
}
