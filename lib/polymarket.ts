import { CONFIG } from "@/lib/config";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket } from "@/lib/types";

const GAMMA_URL = "https://gamma-api.polymarket.com/markets";
const PAGE_SIZE = 100;

/** Polymarket Gamma returns arrays as either real arrays or JSON strings. */
function parseStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

interface GammaMarket {
  id?: string | number;
  conditionId?: string;
  slug?: string;
  question?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  endDate?: string;
  volume?: unknown;
}

/** Normalize a single Gamma market, or return null if it isn't a usable binary market. */
export function normalizePolymarketMarket(m: GammaMarket): NormalizedMarket | null {
  const outcomes = parseStringArray(m.outcomes);
  const prices = parseStringArray(m.outcomePrices);
  if (!outcomes || !prices || outcomes.length !== 2 || prices.length !== 2) {
    return null;
  }

  const lower = outcomes.map((o) => o.toLowerCase());
  const yesIdx = lower.indexOf("yes");
  const noIdx = lower.indexOf("no");
  if (yesIdx === -1 || noIdx === -1) return null;

  const yesAsk = Number(prices[yesIdx]);
  const noAsk = Number(prices[noIdx]);
  if (!Number.isFinite(yesAsk) || !Number.isFinite(noAsk)) return null;

  const title = String(m.question ?? "").trim();
  if (!title) return null;

  const id = String(m.id ?? m.conditionId ?? m.slug ?? title);
  const url = m.slug
    ? `https://polymarket.com/event/${m.slug}`
    : "https://polymarket.com";

  return {
    venue: "polymarket",
    id,
    title,
    yesAsk,
    noAsk,
    endDate: m.endDate,
    url,
    volume: toNumber(m.volume),
    tokens: normalizeTokens(title),
  };
}

/**
 * Fetch active, open binary markets from Polymarket's Gamma API, most-traded
 * first. Pages until `limit` markets have been collected or results run out.
 */
export async function fetchPolymarketMarkets(
  limit: number = CONFIG.maxMarkets,
): Promise<NormalizedMarket[]> {
  const out: NormalizedMarket[] = [];

  for (let offset = 0; offset < limit; offset += PAGE_SIZE) {
    const url =
      `${GAMMA_URL}?closed=false&active=true&limit=${PAGE_SIZE}` +
      `&offset=${offset}&order=volume&ascending=false`;

    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: CONFIG.revalidateSeconds },
    });
    if (!res.ok) {
      throw new Error(`Polymarket request failed: ${res.status} ${res.statusText}`);
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const raw of data as GammaMarket[]) {
      const market = normalizePolymarketMarket(raw);
      if (market) out.push(market);
    }

    if (data.length < PAGE_SIZE) break;
  }

  return out;
}
