import type { Category } from "@/lib/types";

/**
 * Keyword-based classifier. Checked in priority order; the first category with
 * a keyword hit wins. Intentionally simple and self-contained — venue-provided
 * tags can refine this later.
 */
const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: "Geopolitics",
    keywords: [
      "war", "ceasefire", "hormuz", "strait", "nato", "ukraine", "russia",
      "israel", "gaza", "iran", "china", "taiwan", "nuclear", "missile",
      "invade", "invasion", "sanction", "hostage", "troops", "airstrike",
      "north korea", "venezuela",
    ],
  },
  {
    category: "Politics",
    keywords: [
      "election", "senate", "president", "presidential", "congress", "governor",
      "primary", "parliament", "vote", "democrat", "republican", "gop",
      "nominee", "nomination", "cabinet", "minister", "impeach", "supreme court",
      "poll", "ballot", "speaker", "referendum", "prime minister",
    ],
  },
  {
    category: "Crypto",
    keywords: [
      "bitcoin", "btc", "ethereum", "eth", "crypto", "solana", "sol",
      "dogecoin", "doge", "token", "blockchain", "coinbase", "binance",
      "stablecoin", "etf", "satoshi", "memecoin", "altcoin",
    ],
  },
  {
    category: "Economics",
    keywords: [
      "fed", "inflation", "cpi", "gdp", "rate", "rates", "recession",
      "unemployment", "jobs", "interest", "treasury", "powell", "economy",
      "stock", "nasdaq", "dow", "earnings", "tariff", "debt ceiling",
    ],
  },
  {
    category: "Sports",
    keywords: [
      "nba", "nfl", "mlb", "nhl", "soccer", "premier league", "champions",
      "world cup", "super bowl", "championship", "playoff", "playoffs", "ufc",
      "tennis", "golf", "f1", "formula", "olympic", "wins the", "win the",
      "finals", "series",
    ],
  },
  {
    category: "Tech & Science",
    keywords: [
      "ai", "agi", "openai", "anthropic", "gpt", "spacex", "nasa", "launch",
      "rocket", "climate", "temperature", "vaccine", "fda", "model", "chip",
      "quantum", "fusion", "asteroid", "hurricane", "earthquake",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "oscar", "grammy", "movie", "box office", "album", "emmy", "rotten",
      "celebrity", "person of the year", "billboard", "netflix", "taylor swift",
      "song", "film", "tv", "show",
    ],
  },
];

/** Classify a market question into a high-level category. */
export function categorize(title: string): Category {
  const text = ` ${title.toLowerCase()} `;
  for (const { category, keywords } of RULES) {
    for (const kw of keywords) {
      // Word-boundary-ish check to avoid matching inside larger words.
      if (text.includes(` ${kw} `) || text.includes(`${kw} `) || text.includes(` ${kw}`)) {
        return category;
      }
    }
  }
  return "Other";
}
