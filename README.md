# arb-prediction-market

A cross-venue **arbitrage scanner** for prediction markets. It pulls active
binary (Yes/No) markets from **Polymarket** and **Kalshi**, matches the same
event across both venues, and surfaces opportunities where you can buy YES on
one venue and NO on the other for a combined cost below \$1 — i.e. a risk-free
**margin ≥ 5%**.

> Example event: *"Is the Strait of Hormuz likely to close in July?"* — if
> Polymarket prices YES at 42¢ and Kalshi prices NO at 50¢, buying both locks
> in a \$1 payout for 92¢ → an 8% margin.

The initial delivery is a basic app that **presents all opportunities**, sorted
by margin, with a match-confidence score on each pairing. Built with Next.js so
it deploys to **Vercel** out of the box.

## How it works

```
Polymarket Gamma API ─┐
                      ├─► normalize ─► match by title similarity ─► compute arb ─► filter ≥ 5% ─► UI
Kalshi v2 API ────────┘
```

- **`lib/polymarket.ts` / `lib/kalshi.ts`** — fetch and normalize each venue's
  markets into a common `NormalizedMarket` shape (cost in dollars to buy YES/NO).
- **`lib/normalize.ts`** — tokenizes questions (drops stopwords, keeps years)
  and scores similarity with Jaccard overlap.
- **`lib/match.ts`** — matches markets across venues using an inverted token
  index, then takes the cheaper of the two arb directions per pair.
- **`lib/scan.ts`** — orchestrates a full scan.
- **`app/page.tsx`** — renders the opportunities table; **`app/api/opportunities`**
  exposes the same data as JSON.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Script          | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Run the Next.js dev server               |
| `npm run build` | Production build                         |
| `npm start`     | Serve the production build               |
| `npm run lint`  | Type-check with `tsc --noEmit`           |
| `npm test`      | Run the matching/arbitrage unit tests    |

## Configuration

All thresholds are environment variables (set them in the Vercel dashboard):

| Variable             | Default | Meaning                                            |
| -------------------- | ------- | -------------------------------------------------- |
| `MIN_MARGIN`         | `0.05`  | Minimum margin to report (0.05 = 5%)               |
| `MATCH_THRESHOLD`    | `0.5`   | Minimum title similarity to pair two markets (0–1) |
| `MAX_MARKETS`        | `500`   | Max markets pulled per venue per scan              |
| `REVALIDATE_SECONDS` | `60`    | Upstream API cache lifetime                        |

## Deploying to Vercel

1. Push this repo to GitHub (done).
2. In Vercel, **New Project → import this repo**. Framework auto-detects as
   Next.js; no build settings needed.
3. (Optional) set the env vars above under **Settings → Environment Variables**.
4. Deploy. The scan runs server-side on each page load.

## Caveats (read before trading real money)

- **Indicative prices.** Polymarket `outcomePrices` and Kalshi asks are public
  quotes, not guaranteed fills. Real execution needs live order-book depth.
- **Automated matching is approximate.** Pairs are matched by question
  similarity; always confirm both markets resolve on *identical* terms and
  dates. The displayed match score and a "verify — large" flag on outsized
  margins are there to help you sanity-check.
- **Costs not modeled.** Trading fees, gas, slippage, and withdrawal costs are
  not yet subtracted from the margin.

## Roadmap

- Order-book-aware pricing (Polymarket CLOB, Kalshi orderbook endpoints).
- Curated/known-pair mapping to eliminate false matches.
- Fee- and slippage-adjusted net margin.
- Auto-refresh and historical opportunity tracking.

## License

MIT — see [LICENSE](./LICENSE).
