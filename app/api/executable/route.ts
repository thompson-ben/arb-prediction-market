import { NextResponse } from "next/server";
import { type LegRef, priceLegs } from "@/lib/executable";

export const dynamic = "force-dynamic";

/**
 * POST /api/executable — compute executable pricing for one opportunity by
 * fetching both legs' order books on demand. Body:
 *   { indicativeMargin, yes: LegRef, no: LegRef }
 * Degrades gracefully: returns available:false when books can't be fetched.
 */
export async function POST(request: Request) {
  let body: { indicativeMargin?: number; yes?: LegRef; no?: LegRef };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { indicativeMargin = 0, yes, no } = body;
  if (!yes || !no) {
    return NextResponse.json({ error: "yes and no legs required" }, { status: 400 });
  }

  const pricing = await priceLegs(yes, no, indicativeMargin);
  return NextResponse.json(pricing);
}
