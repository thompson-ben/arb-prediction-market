# arb-prediction-market

A cross-venue **arbitrage scanner** for prediction markets. It pulls active
binary (Yes/No) markets from **Polymarket**, **Kalshi**, and **PredictIt**,
matches the same event across venues, and surfaces opportunities where you can
buy YES on one venue and NO on another for a combined cost below \$1 — i.e. a
risk-free **margin ≥ 5%**. Margins are **fee-adjusted** (net of each venue's
trading and profit fees), with the raw gross spread shown alongside.

> Example event: *"Is the Strait of Hormuz likely to close in July?"* — if
> Polymarket prices YES at 42¢ and Kalshi prices NO at 50¢, buying both locks
> in a \$1 payout for 92¢ → an 8% margin.

It ships as a **professional trading terminal** (Bloomberg-style, dark by
default), built with Next.js so it deploys to **Vercel** out of the box.

## Terminal features

- **Dashboard summary cards** — opportunities found, best margin, average
  margin, markets scanned, venues scanned (live with the filters).
- **Dynamic filtering** (all client-side, instant): minimum margin, match
  confidence, venue, expiry window, and category, plus sort control. Defaults
  to a 5% margin filter; **always shows the Top 5 by score** when nothing meets
  the filters, so the dashboard is never empty.
- **Opportunity detail panel** — click any row for full metrics (gross/net
  margin, confidence, liquidity, resolution date), risk notes, both venue legs
  with direct links, and a **VERIFIED / REVIEW REQUIRED / HIGH RISK** indicator.
- **Execution calculator** — enter a stake and see per-leg allocation, total
  capital, guaranteed net profit, and net ROI, updating live.
- **Opportunity Score (0–100)** — blends margin, confidence, liquidity, and
  time-to-expiry to surface the most *actionable* trades; default sort.
- **Order-book foundation** (`lib/orderbook.ts`) — data structures and a stubbed
  executable-pricing path, ready to replace indicative quotes later.
- Loading skeletons, empty states, partial-outage handling, mobile-responsive.

## How it works

```
Polymarket Gamma API ─┐
Kalshi v2 API ────────┼─► normalize ─► pool ─► match (inverted index) ─► fee-adjusted arb ─► filter net ≥ 5% ─► UI
PredictIt API ────────┘
```

- **`lib/polymarket.ts` / `lib/kalshi.ts` / `lib/predictit.ts`** — fetch and
  normalize each venue's markets into a common `NormalizedMarket` shape (cost in
  dollars to buy YES/NO).
- **`lib/venues.ts`** — per-venue metadata and **fee model** (trading fee +
  profit fee) used to compute net margin.
- **`lib/normalize.ts`** — tokenizes questions (drops stopwords, keeps years)
  and scores similarity with Jaccard overlap.
- **`lib/match.ts`** — venue-agnostic: pools all markets, matches across venues
  via an inverted token index, and takes the best of the two arb directions per
  pair by net margin.
- **`lib/scan.ts`** — orchestrates a full scan (parallel, fault-tolerant per venue).
- **`lib/category.ts` / `lib/scoring.ts` / `lib/risk.ts`** — classify, score
  (0–100), and assess each opportunity (status + risk notes).
- **`lib/filters.ts`** — pure, tested filtering/sorting with Top-5 fallback.
- **`app/page.tsx`** renders the `components/terminal/*` client dashboard;
  **`app/api/opportunities`** exposes the same enriched data as JSON.

## Venues & fees

Net margin subtracts an estimate of each venue's fees per \$1 of payout. Add a
new venue by adding a fetcher and an entry in `lib/venues.ts`.

| Venue      | Trading fee (approx)     | Profit fee | Notes                                  |
| ---------- | ------------------------ | ---------- | -------------------------------------- |
| Polymarket | 0%                       | 0%         | Gas on deposit/withdraw not modeled    |
| Kalshi     | ≈ 0.07·P·(1−P) per share | 0%         | Approximation of published schedule    |
| PredictIt  | 0%                       | 5%         | +5% withdrawal fee (not modeled); caps |

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

- **Indicative prices.** Venue quotes (Polymarket `outcomePrices`, Kalshi asks,
  PredictIt best-buy costs) are not guaranteed fills. Real execution needs live
  order-book depth.
- **Automated matching is approximate.** Pairs are matched by question
  similarity; always confirm both markets resolve on *identical* terms and
  dates. The displayed match score and a "verify — large" flag on outsized
  margins are there to help you sanity-check.
- **Fees partially modeled.** Net margin subtracts estimated trading and profit
  fees, but slippage, gas, withdrawal fees, and PredictIt's per-contract caps
  ($850) are not. PredictIt's fees often erase a nominal 5% edge — treat its
  opportunities with extra care.

## Roadmap

- Order-book-aware pricing (Polymarket CLOB, Kalshi orderbook endpoints).
- Curated/known-pair mapping to eliminate false matches.
- Slippage- and cap-aware sizing on top of the existing fee model.
- More venues (e.g. on-chain real-money venues; a Manifold "fair value" reference column).
- Auto-refresh and historical opportunity tracking.

## License

MIT — see [LICENSE](./LICENSE).
