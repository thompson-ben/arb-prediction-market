# Deployment & Live Validation Guide

This covers deploying the arbitrage terminal to Vercel, connecting it to live
market data, and the operational facts needed to evaluate data quality.

## 1. Quick deployment checklist

- [ ] Import `thompson-ben/arb-prediction-market` into Vercel (framework
      auto-detects as **Next.js** — no build settings needed).
- [ ] Create a **KV store** (Vercel KV or Upstash Redis) and link it to the
      project. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically.
      *Required for durable history and review decisions.*
- [ ] (Optional) Set `CRON_SECRET` to protect the scheduled scan.
- [ ] (Optional) Tune `MIN_MARGIN`, `MATCH_THRESHOLD`, `MAX_MARKETS` in
      **Settings → Environment Variables** (see `.env.example`).
- [ ] Deploy. Visit `/` (terminal), `/validation`, `/disagreements`, `/review`,
      `/history`.
- [ ] Confirm the cron job appears under **Settings → Cron Jobs** (defined in
      `vercel.json`, **once daily** — the Hobby-plan max; more frequent on Pro).
- [ ] Manually hit `/api/cron/scan` once to seed history, then check `/history`.
- [ ] Verify live data is flowing on `/validation` (markets per venue > 0).

## 2. Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | For persistence | — | Vercel KV / Upstash Redis REST endpoint. Without it, storage is ephemeral. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | alt | — | Alternative names for the same. |
| `CRON_SECRET` | No | — | If set, `/api/cron/scan` requires a matching Bearer token. |
| `ADMIN_TOKEN` | No | — | If set, `/analytics` and `/api/export` require `?key=` (or `x-admin-token` header). |
| `MIN_MARGIN` | No | `0.05` | Default UI margin filter (5%). |
| `MATCH_THRESHOLD` | No | `0.5` | Default UI confidence filter. |
| `DISCOVERY_MARGIN` | No | `0` | Server scan margin floor. |
| `DISCOVERY_MATCH_THRESHOLD` | No | `0.45` | Server scan confidence floor. |
| `MAX_MARKETS` | No | `500` | Markets pulled per venue per scan. Lower if the cron scan times out. |
| `REVALIDATE_SECONDS` | No | `60` | Upstream API cache lifetime. |
| `DATA_DIR` | No | `./.data` (or `/tmp` on Vercel) | File-store directory when no KV is set. |

## 3. API endpoints used (upstream)

| Venue | Endpoint | Auth | Notes |
| --- | --- | --- | --- |
| Polymarket | `GET https://gamma-api.polymarket.com/markets` | None | Market list + indicative `outcomePrices`. Paginated via `limit`/`offset`. |
| Polymarket | `GET https://clob.polymarket.com/book?token_id=…` | None | Order book for executable pricing (on-demand only). |
| Kalshi | `GET https://api.elections.kalshi.com/trade-api/v2/markets` | None (public list) | Market list + `yes_ask`/`no_ask` in cents. Cursor-paginated. |
| Kalshi | `GET …/markets/{ticker}/orderbook` | May require auth | Order book for executable pricing (on-demand). Degrades gracefully if blocked. |
| PredictIt | `GET https://www.predictit.org/api/marketdata/all/` | None | Entire market book in one call. No order book available. |

## 4. Rate limits & known restrictions

- **Polymarket Gamma**: no published hard limit; be polite. The scan pages
  `MAX_MARKETS / 100` requests per run. Cached for `REVALIDATE_SECONDS`.
- **Polymarket CLOB**: rate-limited; we fetch books **on demand** (one
  opportunity at a time), never in bulk.
- **Kalshi**: public market data is open; the **orderbook** endpoint may require
  an authenticated session — if it 401s, executable pricing for Kalshi legs
  simply shows "n/a" (the app does not break).
- **PredictIt**: single endpoint, lightly rate-limited (~1 req/min recommended);
  cached. **Being wound down** — availability is not guaranteed. Has **no order
  book** and a **$850 position cap**; treat its edges cautiously.
- **CORS / region**: all upstream calls are made **server-side** (route handlers
  / server components), so browser CORS does not apply. Some venues geo-restrict
  trading but not public market data.
- **Vercel function duration**: the cron scan must finish within the function
  limit (10–60s depending on plan). If it times out, lower `MAX_MARKETS`.

## 5. Expected refresh frequency

- **On-demand**: every page load runs a fresh scan (upstream responses cached
  for `REVALIDATE_SECONDS = 60s`, so rapid reloads are cheap).
- **Scheduled**: `vercel.json` runs `/api/cron/scan` **once daily** (`0 0 * * *`).
  This is the **Hobby-plan limit** — Vercel rejects (fails the deployment for)
  any cron more frequent than daily on Hobby. On **Pro**, you can increase the
  frequency (e.g. hourly `0 * * * *`) for finer-grained history.
- **Higher frequency on Hobby (optional)**: keep the daily Vercel cron and *also*
  hit `/api/cron/scan` from an **external scheduler** (e.g. cron-job.org, GitHub
  Actions) every hour, passing `Authorization: Bearer $CRON_SECRET`. External
  HTTP calls are not subject to Vercel's cron-frequency limit. Hourly for ~1–2
  weeks yields enough data to answer the success-criteria questions on
  opportunity duration and frequency; daily still works but resolves duration
  only to day granularity.

## 6. Answering the success-criteria questions

Once live for a few days with the cron running:

| Question | Where to look |
| --- | --- |
| How many opportunities found daily? | `/validation` (per scan) + `/history` appearances |
| How many survive validation? | `/review` (approved vs rejected) |
| How many survive executable pricing? | Opportunity detail → Indicative vs Executable |
| How large are the opportunities? | `/validation` avg/largest margin; `/history` peak margin |
| How long do they last? | `/history` avg/longest duration |
| Which venues generate the best opportunities? | `/history` "appearances by venue pair" |
| Are disagreements more common than arbitrage? | Compare `/disagreements` count vs `/validation` opportunities-above-threshold |

## 7. Admin analytics & export (Phase 3.5)

`/analytics?key=$ADMIN_TOKEN` is an internal business-intelligence dashboard
(kept out of the main nav). It renders:

- **Opportunity funnel** — Markets → Potential Matches → Accepted Matches →
  Arbitrage → Executable, with conversion rates between stages.
- **Data quality** — average confidence, confidence distribution, approved vs
  rejected %, false-match rate, missing-order-book %.
- **Venue analytics** — per venue pair: opportunities, avg margin, avg
  executable margin, avg duration, largest margin.
- **Daily metrics** — per-scan averages and decision counts by day.

CSV export (for offline analysis):
`/api/export?type=history|validation|venues&key=$ADMIN_TOKEN`.

Executable metrics come from sampling the **top 8** opportunities' live order
books each scan (bounded for rate limits), so they are representative rather
than exhaustive.
