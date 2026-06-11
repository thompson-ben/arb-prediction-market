import { NextResponse } from "next/server";
import { getStore, KEYS } from "@/lib/store";
import type { ReviewDecision, ReviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: ReviewStatus[] = ["approved", "rejected", "needs_review"];

/** GET /api/review — all persisted decisions, keyed by pairId. */
export async function GET() {
  const store = getStore();
  const reviews =
    (await store.getJSON<Record<string, ReviewDecision>>(KEYS.reviews)) ?? {};
  return NextResponse.json({ reviews, store: store.kind });
}

/** POST /api/review — upsert a decision: { pairId, status, note? }. */
export async function POST(request: Request) {
  let body: { pairId?: string; status?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { pairId, status, note } = body;
  if (!pairId || !status || !VALID.includes(status as ReviewStatus)) {
    return NextResponse.json(
      { error: "pairId and a valid status (approved|rejected|needs_review) required" },
      { status: 400 },
    );
  }

  const store = getStore();
  const reviews =
    (await store.getJSON<Record<string, ReviewDecision>>(KEYS.reviews)) ?? {};
  reviews[pairId] = {
    pairId,
    status: status as ReviewStatus,
    note,
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(KEYS.reviews, reviews);

  return NextResponse.json({ ok: true, decision: reviews[pairId], store: store.kind });
}
