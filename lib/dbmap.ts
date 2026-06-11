/**
 * Pure mappers from domain objects to Supabase row shapes. Kept separate from
 * the network client (lib/db.ts) so they're unit-testable without a database.
 */

import { opportunityKey } from "@/lib/history";
import type { Disagreement, ExecutablePricing, Opportunity, Venue } from "@/lib/types";

/** Sorted, order-independent venue-pair key, e.g. "kalshi ↔ polymarket". */
export function venuePairKey(venues: Venue[]): string {
  return [...venues].sort().join(" ↔ ");
}

export interface MatchRow {
  opportunity_id: string;
  question: string;
  category: string;
  venue_pair: string;
  venue_a: string;
  market_a_id: string;
  market_a_title: string;
  market_a_url: string | null;
  venue_b: string;
  market_b_id: string;
  market_b_title: string;
  market_b_url: string | null;
  resolution_date: string | null;
  latest_confidence: number;
  latest_suspicion: number;
  latest_trust: string;
  last_seen: string;
}

export interface SnapshotRow {
  scan_at: string;
  opportunity_id: string;
  venue_pair: string;
  category: string;
  match_confidence: number;
  suspicion_score: number;
  trust_status: string;
  gross_margin: number;
  net_margin: number;
  executable_margin: number | null;
  liquidity: number | null;
  max_executable_stake: number | null;
  order_book_depth: number | null;
  resolution_date: string | null;
}

export interface DisagreementRow {
  scan_at: string;
  disagreement_key: string;
  question: string;
  category: string;
  quotes: { venue: Venue; implied_yes: number }[];
  spread: number;
  confidence: number;
  resolution_date: string | null;
}

/** Identity/“latest state” row for the market_matches table (upserted). */
export function matchRow(o: Opportunity, lastSeen: string): MatchRow {
  return {
    opportunity_id: opportunityKey(o),
    question: o.question,
    category: o.category,
    venue_pair: venuePairKey(o.venues),
    venue_a: o.marketA.venue,
    market_a_id: o.marketA.id,
    market_a_title: o.marketA.title,
    market_a_url: o.marketA.url ?? null,
    venue_b: o.marketB.venue,
    market_b_id: o.marketB.id,
    market_b_title: o.marketB.title,
    market_b_url: o.marketB.url ?? null,
    resolution_date: o.endDate ?? null,
    latest_confidence: o.matchScore,
    latest_suspicion: o.suspicionScore,
    latest_trust: o.status,
    last_seen: lastSeen,
  };
}

/** Fact row for opportunity_snapshots. `pricing` fills executable fields when sampled. */
export function snapshotRow(
  o: Opportunity,
  scanAt: string,
  pricing?: ExecutablePricing,
): SnapshotRow {
  const exec = pricing?.available ? pricing : undefined;
  const depth = exec?.legs?.reduce((sum, l) => sum + (l.depth ?? 0), 0) ?? null;
  return {
    scan_at: scanAt,
    opportunity_id: opportunityKey(o),
    venue_pair: venuePairKey(o.venues),
    category: o.category,
    match_confidence: o.matchScore,
    suspicion_score: o.suspicionScore,
    trust_status: o.status,
    gross_margin: o.grossMargin,
    net_margin: o.netMargin,
    executable_margin: exec?.executableMargin ?? null,
    liquidity: o.liquidity ?? null,
    max_executable_stake: exec?.maxStake ?? null,
    order_book_depth: exec ? depth : null,
    resolution_date: o.endDate ?? null,
  };
}

export function disagreementRow(d: Disagreement, scanAt: string): DisagreementRow {
  return {
    scan_at: scanAt,
    disagreement_key: d.id,
    question: d.question,
    category: d.category,
    quotes: d.quotes.map((q) => ({ venue: q.venue, implied_yes: q.impliedYes })),
    spread: d.spread,
    confidence: d.confidence,
    resolution_date: d.endDate ?? null,
  };
}
