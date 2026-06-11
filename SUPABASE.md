# Supabase — System of Record

Phase 3.6 makes **Supabase Postgres** the permanent datastore for the research
dataset. Vercel KV is no longer used. This doc covers the schema and how to
deploy it.

## Why Supabase

The project is becoming a prediction-market **intelligence/research** platform,
so the database is a strategic asset. Postgres gives us SQL, views, indexes, and
direct connectivity for **Power BI / Excel / Python**, plus a dashboard to
inspect raw data during the live-evaluation window.

## Design

**Immutable facts + derived views.** The app only writes raw facts; all
aggregates are SQL **views** so they never drift and can be extended later
without re-collecting data.

| Object | Type | Purpose |
| --- | --- | --- |
| `market_matches` | table | Identity of each cross-venue pairing (markets, titles, category, latest confidence/suspicion/trust). |
| `opportunity_snapshots` | table | **Fact table** — one row per opportunity per scan (margins, executable margin/stake, liquidity, confidence, suspicion, trust). |
| `match_reviews` | table | Human review decisions (approved / rejected / needs_review) + reasons. |
| `market_disagreements` | table | Per-scan disagreement snapshots (per-venue implied probabilities, spread). |
| `market_resolutions` | table | Final outcomes per pairing (Priority 5; populated where available). |
| `user_events` | table | Interaction log (viewed / expanded / venue_click / review actions). |
| `opportunities` | **view** | Per-opportunity decay + capital analytics (first/last seen, duration, peak/avg/lowest margin, decay rate, exec margin/stake, median stake). |
| `venue_analytics` | **view** | Per venue-pair performance. |
| `category_analytics` | **view** | Per category performance + approval rate. |
| `match_quality_by_confidence` | **view** | Review outcomes bucketed by confidence band. |
| `bi_daily` | **view** | Daily rollup for the BI dashboard. |

**Indexes** cover timestamps (`scan_at`, `last_seen`, `created_at`), venue pairs,
opportunity ids, categories, and confidence scores.

## Deploy the schema

1. Create a Supabase project (free tier is fine for the evaluation window).
2. Apply the migration — either:
   - **Dashboard:** SQL Editor → paste `supabase/migrations/0001_initial_schema.sql` → Run.
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. In Vercel → Project → Settings → Environment Variables, set:
   - `SUPABASE_URL` (Project Settings → API → Project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role key)
   The app connects with the **service role** key (server-side only), which
   bypasses RLS — so no row-level policies are required. Do **not** expose this
   key to the browser (it never is: all DB access is server-side).
4. Redeploy. Verify at `/api/health` → `database.reachable: true`.
5. Seed: hit `/api/cron/scan` once, then check `/history` and `/analytics`.

## Connecting BI tools

- **Power BI / Excel / Python:** connect directly to Postgres (Supabase →
  Settings → Database → connection string) and read the views/tables, or pull
  the CSV exports from `/api/export?type=…`.
- Recommended starting points: the `opportunities`, `venue_analytics`,
  `category_analytics`, and `bi_daily` views.

## Capacity

Each scan writes up to `MAX_SNAPSHOTS` (default 250) snapshot rows plus a handful
of match upserts. At hourly cadence that's ~6k rows/day — comfortably within the
free tier (500 MB) for the 30-day window. Lower `MAX_SNAPSHOTS` to reduce volume.
