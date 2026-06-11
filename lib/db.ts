/**
 * Supabase (Postgres) data-access layer — the system of record (Phase 3.6).
 *
 * All permanent data lives here. The client uses the service-role key and is
 * only ever imported by server code (route handlers / server components). When
 * Supabase isn't configured, every function degrades gracefully: writes no-op,
 * reads return empty — so live scans still render.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DisagreementRow,
  MatchRow,
  SnapshotRow,
} from "@/lib/dbmap";
import type { ReviewStatus } from "@/lib/types";

function url(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function dbEnabled(): boolean {
  return Boolean(url() && serviceKey());
}

let cached: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!cached) {
    cached = createClient(url()!, serviceKey()!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

// ── Writes ──────────────────────────────────────────────────────────────────

/** Upsert match identities and insert opportunity snapshots for one scan. */
export async function persistScan(
  matches: MatchRow[],
  snapshots: SnapshotRow[],
): Promise<void> {
  if (!dbEnabled() || matches.length === 0) return;
  // Matches first (snapshots FK them).
  const { error: mErr } = await db()
    .from("market_matches")
    .upsert(matches, { onConflict: "opportunity_id" });
  if (mErr) throw new Error(`market_matches upsert: ${mErr.message}`);

  if (snapshots.length) {
    const { error: sErr } = await db().from("opportunity_snapshots").insert(snapshots);
    if (sErr) throw new Error(`opportunity_snapshots insert: ${sErr.message}`);
  }
}

export async function persistDisagreements(rows: DisagreementRow[]): Promise<void> {
  if (!dbEnabled() || rows.length === 0) return;
  const { error } = await db().from("market_disagreements").insert(rows);
  if (error) throw new Error(`market_disagreements insert: ${error.message}`);
}

export interface ReviewUpsert {
  opportunity_id: string;
  status: ReviewStatus;
  note?: string;
  reasons_support?: string[];
  reasons_concern?: string[];
  confidence_at_review?: number;
  suspicion_at_review?: number;
}

export async function upsertReview(input: ReviewUpsert): Promise<void> {
  if (!dbEnabled()) return;
  const { error } = await db()
    .from("match_reviews")
    .upsert(
      {
        opportunity_id: input.opportunity_id,
        status: input.status,
        note: input.note ?? null,
        reasons_support: input.reasons_support ?? null,
        reasons_concern: input.reasons_concern ?? null,
        confidence_at_review: input.confidence_at_review ?? null,
        suspicion_at_review: input.suspicion_at_review ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "opportunity_id" },
    );
  if (error) throw new Error(`match_reviews upsert: ${error.message}`);
}

export interface ResolutionInput {
  opportunity_id: string;
  venue_a_result?: "yes" | "no" | "unknown";
  venue_b_result?: "yes" | "no" | "unknown";
  consistent?: boolean;
  match_valid?: boolean;
  resolved_at?: string;
}

/**
 * Record a final resolution outcome for a matched pair (Priority 5). Populated
 * by a future outcome-collection job once venues report settlement; the schema
 * and writer are in place so no migration is needed later.
 */
export async function recordResolution(input: ResolutionInput): Promise<void> {
  if (!dbEnabled()) return;
  const { error } = await db()
    .from("market_resolutions")
    .upsert(
      {
        opportunity_id: input.opportunity_id,
        venue_a_result: input.venue_a_result ?? null,
        venue_b_result: input.venue_b_result ?? null,
        consistent: input.consistent ?? null,
        match_valid: input.match_valid ?? null,
        resolved_at: input.resolved_at ?? null,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "opportunity_id" },
    );
  if (error) throw new Error(`market_resolutions upsert: ${error.message}`);
}

export interface UserEvent {
  event_type: string;
  opportunity_id?: string;
  venue?: string;
  metadata?: Record<string, unknown>;
}

export async function recordEvent(event: UserEvent): Promise<void> {
  if (!dbEnabled()) return;
  const { error } = await db().from("user_events").insert({
    event_type: event.event_type,
    opportunity_id: event.opportunity_id ?? null,
    venue: event.venue ?? null,
    metadata: event.metadata ?? null,
  });
  if (error) throw new Error(`user_events insert: ${error.message}`);
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function rows<T>(table: string, build: (q: ReturnType<SupabaseClient["from"]>) => unknown): Promise<T[]> {
  if (!dbEnabled()) return [];
  const query = build(db().from(table)) as Promise<{ data: T[] | null; error: unknown }>;
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export interface ReviewRow {
  opportunity_id: string;
  status: ReviewStatus;
  note: string | null;
  updated_at: string;
}

export async function getReviews(): Promise<Record<string, ReviewRow>> {
  const data = await rows<ReviewRow>("match_reviews", (q) =>
    q.select("opportunity_id, status, note, updated_at"),
  );
  const out: Record<string, ReviewRow> = {};
  for (const r of data) out[r.opportunity_id] = r;
  return out;
}

export async function getReviewCounts(): Promise<{
  approved: number;
  rejected: number;
  needs_review: number;
}> {
  const data = await rows<{ status: ReviewStatus }>("match_reviews", (q) => q.select("status"));
  const counts = { approved: 0, rejected: 0, needs_review: 0 };
  for (const r of data) counts[r.status] += 1;
  return counts;
}

export interface OpportunityAggRow {
  opportunity_id: string;
  question: string;
  category: string;
  venue_pair: string;
  match_confidence: number | null;
  suspicion_score: number | null;
  trust_status: string | null;
  appearances: number;
  first_seen: string;
  last_seen: string;
  duration_seconds: number | null;
  peak_margin: number | null;
  lowest_margin: number | null;
  avg_margin: number | null;
  peak_executable_margin: number | null;
  avg_executable_margin: number | null;
  peak_executable_stake: number | null;
  avg_executable_stake: number | null;
  median_executable_stake: number | null;
  margin_decay_rate_per_hour: number | null;
  resolution_date: string | null;
}

export function getOpportunities(limit = 200): Promise<OpportunityAggRow[]> {
  return rows<OpportunityAggRow>("opportunities", (q) =>
    q.select("*").order("peak_margin", { ascending: false }).limit(limit),
  );
}

export interface VenueAnalyticsRow {
  venue_pair: string;
  opportunities: number;
  executable_opportunities: number;
  avg_margin: number | null;
  avg_executable_margin: number | null;
  avg_duration_hours: number | null;
  avg_executable_stake: number | null;
  largest_margin: number | null;
}

export function getVenueAnalytics(): Promise<VenueAnalyticsRow[]> {
  return rows<VenueAnalyticsRow>("venue_analytics", (q) => q.select("*"));
}

export interface CategoryAnalyticsRow {
  category: string;
  opportunities: number;
  executable_opportunities: number;
  avg_margin: number | null;
  avg_duration_hours: number | null;
  avg_executable_stake: number | null;
  approval_rate: number | null;
}

export function getCategoryAnalytics(): Promise<CategoryAnalyticsRow[]> {
  return rows<CategoryAnalyticsRow>("category_analytics", (q) =>
    q.select("*").order("opportunities", { ascending: false }),
  );
}

export interface ConfidenceBandRow {
  band: number | null;
  matches: number;
  approved: number;
  rejected: number;
  needs_review: number;
}

export function getMatchQuality(): Promise<ConfidenceBandRow[]> {
  return rows<ConfidenceBandRow>("match_quality_by_confidence", (q) => q.select("*"));
}

export interface DailyRow {
  day: string;
  opportunities: number;
  executable_opportunities: number;
  avg_margin: number | null;
  avg_executable_margin: number | null;
  largest_executable_margin: number | null;
  avg_executable_stake: number | null;
  largest_executable_stake: number | null;
}

export function getBiDaily(limit = 60): Promise<DailyRow[]> {
  return rows<DailyRow>("bi_daily", (q) =>
    q.select("*").order("day", { ascending: false }).limit(limit),
  );
}

export function getSnapshots(limit = 10000): Promise<SnapshotRow[]> {
  return rows<SnapshotRow>("opportunity_snapshots", (q) =>
    q.select("*").order("scan_at", { ascending: false }).limit(limit),
  );
}

/** True if Supabase is reachable and the schema responds. */
export async function dbHealthy(): Promise<boolean> {
  if (!dbEnabled()) return false;
  try {
    const { error } = await db()
      .from("opportunity_snapshots")
      .select("id", { count: "exact", head: true });
    return !error;
  } catch {
    return false;
  }
}
