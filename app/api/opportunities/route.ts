import { NextResponse } from "next/server";
import { scanOpportunities } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/opportunities — JSON feed of current cross-venue opportunities. */
export async function GET() {
  try {
    const result = await scanOpportunities();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
