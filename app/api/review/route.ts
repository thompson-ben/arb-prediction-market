import { NextResponse } from "next/server";
import { dbEnabled, getReviews, recordEvent, upsertReview } from "@/lib/db";
import type { ReviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: ReviewStatus[] = ["approved", "rejected", "needs_review"];

/** GET /api/review — all persisted decisions, keyed by opportunity id. */
export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json({ reviews, store: dbEnabled() ? "supabase" : "disabled" });
}

/** POST /api/review — upsert a decision and log the review event. */
export async function POST(request: Request) {
  let body: {
    pairId?: string;
    status?: string;
    note?: string;
    confidence?: number;
    suspicion?: number;
    reasonsSupport?: string[];
    reasonsConcern?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { pairId, status } = body;
  if (!pairId || !status || !VALID.includes(status as ReviewStatus)) {
    return NextResponse.json(
      { error: "pairId and a valid status (approved|rejected|needs_review) required" },
      { status: 400 },
    );
  }

  if (!dbEnabled()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  await upsertReview({
    opportunity_id: pairId,
    status: status as ReviewStatus,
    note: body.note,
    confidence_at_review: body.confidence,
    suspicion_at_review: body.suspicion,
    reasons_support: body.reasonsSupport,
    reasons_concern: body.reasonsConcern,
  });
  await recordEvent({ event_type: status, opportunity_id: pairId });

  return NextResponse.json({ ok: true });
}
