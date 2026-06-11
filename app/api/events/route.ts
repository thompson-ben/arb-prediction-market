import { NextResponse } from "next/server";
import { dbEnabled, recordEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID = new Set([
  "viewed",
  "expanded",
  "venue_click",
  "approved",
  "rejected",
  "needs_review",
]);

/** POST /api/events — record a user-interaction event (Priority 8). */
export async function POST(request: Request) {
  let body: {
    eventType?: string;
    opportunityId?: string;
    venue?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.eventType || !VALID.has(body.eventType)) {
    return NextResponse.json({ error: "valid eventType required" }, { status: 400 });
  }
  if (!dbEnabled()) return NextResponse.json({ ok: false, skipped: true });

  await recordEvent({
    event_type: body.eventType,
    opportunity_id: body.opportunityId,
    venue: body.venue,
    metadata: body.metadata,
  });
  return NextResponse.json({ ok: true });
}
