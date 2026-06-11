import { NextResponse } from "next/server";
import { dbEnabled, dbHealthy } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface VenueHealth {
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
}

/** Lightweight reachability check for one upstream (no body read). */
async function ping(url: string): Promise<VenueHealth> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { accept: "application/json" }, cache: "no-store" },
      6000,
    );
    return { ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e instanceof Error ? e.message : "error" };
  }
}

/**
 * GET /api/health — operational check that all venue APIs and the store are
 * functioning. Returns 200 when everything is reachable, 503 otherwise. Safe to
 * point an uptime monitor at during the live-data collection window.
 */
export async function GET() {
  const [polymarket, kalshi, predictit] = await Promise.all([
    ping("https://gamma-api.polymarket.com/markets?closed=false&limit=1"),
    ping("https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open"),
    ping("https://www.predictit.org/api/marketdata/all/"),
  ]);

  const configured = dbEnabled();
  const dbOk = configured ? await dbHealthy() : false;

  const venues = { polymarket, kalshi, predictit };
  const venuesOk = polymarket.ok && kalshi.ok && predictit.ok;
  const ok = venuesOk && dbOk;

  return NextResponse.json(
    {
      ok,
      at: new Date().toISOString(),
      venues,
      database: { provider: "supabase", configured, reachable: dbOk },
    },
    { status: ok ? 200 : 503 },
  );
}
