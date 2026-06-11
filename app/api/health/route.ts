import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/http";
import { getStore } from "@/lib/store";

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

  const store = getStore();
  let storeWritable = false;
  let storeError: string | undefined;
  try {
    await store.setJSON("__health", { at: new Date().toISOString() });
    const probe = await store.getJSON<{ at: string }>("__health");
    storeWritable = probe != null;
  } catch (e) {
    storeError = e instanceof Error ? e.message : "error";
  }

  const venues = { polymarket, kalshi, predictit };
  const venuesOk = polymarket.ok && kalshi.ok && predictit.ok;
  const ok = venuesOk && storeWritable;

  return NextResponse.json(
    {
      ok,
      at: new Date().toISOString(),
      venues,
      store: { kind: store.kind, writable: storeWritable, persistent: store.kind === "redis", error: storeError },
    },
    { status: ok ? 200 : 503 },
  );
}
