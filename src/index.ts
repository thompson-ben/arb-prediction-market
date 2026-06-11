import { findArbitrage } from "./arbitrage.js";
import type { Market } from "./types.js";

/** Demo dataset — replace with live venue feeds. */
const markets: Market[] = [
  {
    eventId: "us-election-2028",
    question: "Will candidate X win?",
    venue: "polymarket",
    yesAsk: 0.62,
    noAsk: 0.4,
  },
  {
    eventId: "us-election-2028",
    question: "Will candidate X win?",
    venue: "kalshi",
    yesAsk: 0.55,
    noAsk: 0.46,
  },
];

function main(): void {
  const opportunities = findArbitrage(markets);

  if (opportunities.length === 0) {
    console.log("No arbitrage opportunities found.");
    return;
  }

  console.log(`Found ${opportunities.length} opportunity(ies):`);
  for (const opp of opportunities) {
    const venues = opp.legs.map((l) => l.venue).join(" + ");
    console.log(
      `  [${opp.kind}] ${opp.eventId} via ${venues}: ` +
        `cost \$${opp.cost.toFixed(2)}, profit \$${opp.profit.toFixed(2)} per \$1`,
    );
  }
}

main();
