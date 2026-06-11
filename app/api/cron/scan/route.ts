import { NextResponse } from "next/server";
import { recordScan, scanOpportunities } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled scan (Vercel Cron). Runs a scan and persists it into the
 * opportunity-history + diagnostics store so the success-criteria questions can
 * be answered over time.
 *
 * Protected by CRON_SECRET when set (Vercel Cron sends it as a Bearer token).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await scanOpportunities();
    await recordScan(result);
    return NextResponse.json({
      ok: true,
      generatedAt: result.generatedAt,
      marketsScanned: result.marketsScanned,
      opportunitiesFound: result.diagnostics.opportunitiesFound,
      opportunitiesAboveThreshold: result.diagnostics.opportunitiesAboveThreshold,
      errors: result.errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
