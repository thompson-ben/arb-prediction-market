import type { Market, Opportunity } from "./types.js";

/**
 * Detect single-market arbitrage: buying both YES and NO on the same market
 * for a combined cost below \$1 guarantees a \$1 payout.
 */
export function findSingleMarketArbs(
  markets: Market[],
  minProfit = 0,
): Opportunity[] {
  const opportunities: Opportunity[] = [];

  for (const market of markets) {
    const cost = market.yesAsk + market.noAsk;
    const profit = 1 - cost;
    if (profit > minProfit) {
      opportunities.push({
        eventId: market.eventId,
        kind: "single-market",
        legs: [market],
        cost,
        profit,
      });
    }
  }

  return opportunities;
}

/**
 * Detect cross-venue arbitrage: buying YES on one venue and NO on another for
 * the same event, where the combined cost is below \$1.
 */
export function findCrossVenueArbs(
  markets: Market[],
  minProfit = 0,
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const byEvent = new Map<string, Market[]>();

  for (const market of markets) {
    const group = byEvent.get(market.eventId);
    if (group) group.push(market);
    else byEvent.set(market.eventId, [market]);
  }

  for (const group of byEvent.values()) {
    if (group.length < 2) continue;

    // Cheapest YES and cheapest NO may come from different venues.
    let bestYes = group[0]!;
    let bestNo = group[0]!;
    for (const market of group) {
      if (market.yesAsk < bestYes.yesAsk) bestYes = market;
      if (market.noAsk < bestNo.noAsk) bestNo = market;
    }

    if (bestYes.venue === bestNo.venue) continue;

    const cost = bestYes.yesAsk + bestNo.noAsk;
    const profit = 1 - cost;
    if (profit > minProfit) {
      opportunities.push({
        eventId: bestYes.eventId,
        kind: "cross-venue",
        legs: [bestYes, bestNo],
        cost,
        profit,
      });
    }
  }

  return opportunities;
}

/** Run all detectors and return opportunities sorted by descending profit. */
export function findArbitrage(
  markets: Market[],
  minProfit = 0,
): Opportunity[] {
  return [
    ...findSingleMarketArbs(markets, minProfit),
    ...findCrossVenueArbs(markets, minProfit),
  ].sort((a, b) => b.profit - a.profit);
}
