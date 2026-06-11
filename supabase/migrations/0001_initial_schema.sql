-- ============================================================================
-- Phase 3.6 — Supabase (Postgres) as system of record
-- Research-grade schema for prediction-market arbitrage / intelligence.
--
-- Design: immutable fact tables (opportunity_snapshots, market_disagreements,
-- user_events) + identity/decision tables (market_matches, match_reviews,
-- market_resolutions). All aggregates are VIEWS so they never drift and BI
-- tools (Power BI / Excel / Python) can read them like tables.
-- ============================================================================

-- ── Identity of a cross-venue market pairing (the "match") ──────────────────
create table if not exists market_matches (
  opportunity_id     text primary key,          -- stable sorted pair key: "<idA>::<idB>"
  question           text not null,
  category           text not null,
  venue_pair         text not null,             -- sorted, e.g. "kalshi ↔ polymarket"
  venue_a            text not null,
  market_a_id        text not null,
  market_a_title     text not null,
  market_a_url       text,
  venue_b            text not null,
  market_b_id        text not null,
  market_b_title     text not null,
  market_b_url       text,
  resolution_date    timestamptz,
  latest_confidence  double precision,
  latest_suspicion   integer,
  latest_trust       text,
  first_seen         timestamptz not null default now(),
  last_seen          timestamptz not null default now()
);

create index if not exists idx_matches_venue_pair  on market_matches (venue_pair);
create index if not exists idx_matches_category    on market_matches (category);
create index if not exists idx_matches_confidence  on market_matches (latest_confidence);
create index if not exists idx_matches_last_seen   on market_matches (last_seen);

-- ── Time-series fact table: one row per opportunity per scan ─────────────────
create table if not exists opportunity_snapshots (
  id                    bigint generated always as identity primary key,
  scan_at               timestamptz not null,
  opportunity_id        text not null references market_matches(opportunity_id) on delete cascade,
  venue_pair            text not null,
  category              text not null,
  match_confidence      double precision,
  suspicion_score       integer,
  trust_status          text,
  gross_margin          double precision,
  net_margin            double precision,
  executable_margin     double precision,        -- null unless this opp was sampled
  liquidity             double precision,
  max_executable_stake  double precision,        -- null unless sampled
  order_book_depth      double precision,        -- null unless sampled
  resolution_date       timestamptz
);

create index if not exists idx_snap_scan_at     on opportunity_snapshots (scan_at);
create index if not exists idx_snap_opportunity on opportunity_snapshots (opportunity_id);
create index if not exists idx_snap_venue_pair  on opportunity_snapshots (venue_pair);
create index if not exists idx_snap_category    on opportunity_snapshots (category);
create index if not exists idx_snap_confidence  on opportunity_snapshots (match_confidence);

-- ── Human review decisions (curated trusted pairings) ───────────────────────
create table if not exists match_reviews (
  opportunity_id        text primary key references market_matches(opportunity_id) on delete cascade,
  status                text not null check (status in ('approved','rejected','needs_review')),
  note                  text,
  reasons_support       jsonb,
  reasons_concern       jsonb,
  confidence_at_review  double precision,
  suspicion_at_review   integer,
  updated_at            timestamptz not null default now()
);

create index if not exists idx_reviews_status on match_reviews (status);

-- ── Market disagreement snapshots (intelligence signal, time series) ─────────
create table if not exists market_disagreements (
  id               bigint generated always as identity primary key,
  scan_at          timestamptz not null,
  disagreement_key text not null,
  question         text not null,
  category         text not null,
  quotes           jsonb not null,                -- [{ "venue": "...", "implied_yes": 0.42 }]
  spread           double precision not null,
  confidence       double precision,
  resolution_date  timestamptz
);

create index if not exists idx_disagree_scan_at  on market_disagreements (scan_at);
create index if not exists idx_disagree_key      on market_disagreements (disagreement_key);
create index if not exists idx_disagree_spread   on market_disagreements (spread);
create index if not exists idx_disagree_category on market_disagreements (category);

-- ── Resolution outcomes (Priority 5 — populated where available) ─────────────
create table if not exists market_resolutions (
  opportunity_id  text primary key references market_matches(opportunity_id) on delete cascade,
  venue_a_result  text,                            -- 'yes' | 'no' | 'unknown'
  venue_b_result  text,
  consistent      boolean,                          -- both venues resolved the same way
  match_valid     boolean,                          -- the pairing was ultimately valid
  resolved_at     timestamptz,
  recorded_at     timestamptz not null default now()
);

-- ── User interaction events (Priority 8) ─────────────────────────────────────
create table if not exists user_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  event_type     text not null,                     -- viewed | expanded | venue_click | approved | rejected | needs_review
  opportunity_id text,
  venue          text,
  metadata       jsonb
);

create index if not exists idx_events_created_at  on user_events (created_at);
create index if not exists idx_events_type        on user_events (event_type);
create index if not exists idx_events_opportunity on user_events (opportunity_id);

-- ============================================================================
-- VIEWS (derived aggregates — read by the dashboard, exports, and BI tools)
-- ============================================================================

-- Per-opportunity decay + capital analytics (Priorities 2 & 3).
create or replace view opportunities as
select
  m.opportunity_id,
  m.question,
  m.category,
  m.venue_pair,
  m.resolution_date,
  m.latest_confidence as match_confidence,
  m.latest_suspicion  as suspicion_score,
  m.latest_trust      as trust_status,
  count(s.id)                                              as appearances,
  min(s.scan_at)                                           as first_seen,
  max(s.scan_at)                                           as last_seen,
  extract(epoch from (max(s.scan_at) - min(s.scan_at)))    as duration_seconds,
  max(s.net_margin)                                        as peak_margin,
  min(s.net_margin)                                        as lowest_margin,
  avg(s.net_margin)                                        as avg_margin,
  (array_agg(s.net_margin order by s.scan_at asc))[1]      as first_margin,
  (array_agg(s.net_margin order by s.scan_at desc))[1]     as last_margin,
  max(s.executable_margin)                                 as peak_executable_margin,
  avg(s.executable_margin)                                 as avg_executable_margin,
  max(s.max_executable_stake)                              as peak_executable_stake,
  avg(s.max_executable_stake)                              as avg_executable_stake,
  percentile_cont(0.5) within group (order by s.max_executable_stake) as median_executable_stake,
  max(s.liquidity)                                         as liquidity,
  case
    when extract(epoch from (max(s.scan_at) - min(s.scan_at))) > 0
    then ((array_agg(s.net_margin order by s.scan_at asc))[1]
          - (array_agg(s.net_margin order by s.scan_at desc))[1])
         / (extract(epoch from (max(s.scan_at) - min(s.scan_at))) / 3600.0)
    else 0
  end as margin_decay_rate_per_hour
from market_matches m
left join opportunity_snapshots s on s.opportunity_id = m.opportunity_id
group by m.opportunity_id, m.question, m.category, m.venue_pair, m.resolution_date,
         m.latest_confidence, m.latest_suspicion, m.latest_trust;

-- Per venue-pair performance (Priority 6).
create or replace view venue_analytics as
select
  venue_pair,
  count(*)                                                  as opportunities,
  count(*) filter (where peak_executable_margin > 0)        as executable_opportunities,
  avg(avg_margin)                                           as avg_margin,
  avg(avg_executable_margin)                                as avg_executable_margin,
  avg(duration_seconds) / 3600.0                            as avg_duration_hours,
  avg(avg_executable_stake)                                 as avg_executable_stake,
  max(peak_margin)                                          as largest_margin
from opportunities
group by venue_pair
order by avg(avg_margin) desc nulls last;

-- Per category performance (Priority 7), with review approval rate.
create or replace view category_analytics as
select
  o.category,
  count(*)                                                  as opportunities,
  count(*) filter (where o.peak_executable_margin > 0)      as executable_opportunities,
  avg(o.avg_margin)                                         as avg_margin,
  avg(o.duration_seconds) / 3600.0                          as avg_duration_hours,
  avg(o.avg_executable_stake)                               as avg_executable_stake,
  count(r.opportunity_id) filter (where r.status = 'approved')::float
    / nullif(count(r.opportunity_id) filter (where r.status in ('approved','rejected')), 0) as approval_rate
from opportunities o
left join match_reviews r on r.opportunity_id = o.opportunity_id
group by o.category;

-- Match quality by confidence band (Priority 4).
create or replace view match_quality_by_confidence as
select
  width_bucket(m.latest_confidence, 0.4, 1.0, 6)            as band,
  count(*)                                                  as matches,
  count(r.opportunity_id) filter (where r.status = 'approved')     as approved,
  count(r.opportunity_id) filter (where r.status = 'rejected')     as rejected,
  count(r.opportunity_id) filter (where r.status = 'needs_review') as needs_review
from market_matches m
left join match_reviews r on r.opportunity_id = m.opportunity_id
group by band
order by band;

-- Daily BI rollup (Priority 9).
create or replace view bi_daily as
select
  date_trunc('day', scan_at)                               as day,
  count(distinct opportunity_id)                           as opportunities,
  count(distinct opportunity_id) filter (where executable_margin > 0) as executable_opportunities,
  avg(net_margin)                                          as avg_margin,
  avg(executable_margin)                                   as avg_executable_margin,
  max(executable_margin)                                   as largest_executable_margin,
  avg(max_executable_stake)                                as avg_executable_stake,
  max(max_executable_stake)                                as largest_executable_stake
from opportunity_snapshots
group by 1
order by 1 desc;
