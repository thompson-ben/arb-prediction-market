import { CONFIG } from "@/lib/config";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket } from "@/lib/types";

const KALSHI_URL = "https://api.elections.kalshi.com/trade-api/v2/markets";
const PAGE_SIZE = 200;

function toNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Kalshi quotes prices in integer cents (1–99); convert to a 0–1 dollar price. */
function centsToPrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Number.NaN;
  return n / 100;
}

interface KalshiMarket {
  ticker?: string;
  event_ticker?: string;
  title?: string;
  subtitle?: string;
  yes_ask?: number;
  no_ask?: number;
  close_time?: string;
  volume?: number;
  status?: string;
}

interface KalshiResponse {
  markets?: KalshiMarket[];
  cursor?: string;
}

/** Normalize a single Kalshi market, or return null if it lacks a title. */
export function normalizeKalshiMarket(m: KalshiMarket): NormalizedMarket | null {
  const title = (m.title ?? "").trim();
  if (!title) return null;

  // Subtitle often holds the specific threshold/answer; include it for matching.
  const matchText = [m.title, m.subtitle].filter(Boolean).join(" ").trim();

  const url = m.event_ticker
    ? `https://kalshi.com/markets/${m.event_ticker.toLowerCase()}`
    : "https://kalshi.com";

  return {
    venue: "kalshi",
    id: m.ticker ?? title,
    title: m.subtitle ? `${title} — ${m.subtitle}` : title,
    yesAsk: centsToPrice(m.yes_ask),
    noAsk: centsToPrice(m.no_ask),
    endDate: m.close_time,
    url,
    volume: toNumber(m.volume),
    tokens: normalizeTokens(matchText),
  };
}

/**
 * Fetch open binary markets from Kalshi, paging via cursor until `limit`
 * markets have been collected or there are no more pages.
 */
export async function fetchKalshiMarkets(
  limit: number = CONFIG.maxMarkets,
): Promise<NormalizedMarket[]> {
  const out: NormalizedMarket[] = [];
  let cursor: string | undefined;

  while (out.length < limit) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      status: "open",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${KALSHI_URL}?${params.toString()}`, {
      headers: { accept: "application/json" },
      next: { revalidate: CONFIG.revalidateSeconds },
    });
    if (!res.ok) {
      throw new Error(`Kalshi request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as KalshiResponse;
    const markets = data.markets ?? [];
    for (const raw of markets) {
      const market = normalizeKalshiMarket(raw);
      if (market) out.push(market);
    }

    cursor = data.cursor;
    if (!cursor || markets.length === 0) break;
  }

  return out;
}
