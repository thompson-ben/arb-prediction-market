import { CONFIG } from "@/lib/config";
import { normalizeTokens } from "@/lib/normalize";
import type { NormalizedMarket } from "@/lib/types";

// PredictIt exposes its entire market book in a single public read-only call.
const PREDICTIT_URL = "https://www.predictit.org/api/marketdata/all/";

/** A buy price is usable only if it is a real, positive number. */
function buyPrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

/** PredictIt dates look like "2026-07-31T00:00:00" or "N/A". */
function parseDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface PredictItContract {
  id?: number;
  name?: string;
  bestBuyYesCost?: number | null;
  bestBuyNoCost?: number | null;
  dateEnd?: string;
}

interface PredictItMarket {
  id?: number;
  name?: string;
  url?: string;
  contracts?: PredictItContract[];
}

interface PredictItResponse {
  markets?: PredictItMarket[];
}

/**
 * Normalize a PredictIt market into one binary `NormalizedMarket` per contract.
 * Multi-contract markets (e.g. "Which party wins?") become one Yes/No market
 * per candidate, with the contract name folded into the title for matching.
 */
export function normalizePredictItMarket(m: PredictItMarket): NormalizedMarket[] {
  const contracts = m.contracts ?? [];
  if (contracts.length === 0) return [];

  const marketName = (m.name ?? "").trim();
  const multi = contracts.length > 1;
  const url = m.url ?? "https://www.predictit.org";
  const out: NormalizedMarket[] = [];

  for (const c of contracts) {
    const contractName = (c.name ?? "").trim();
    const title =
      multi && contractName ? `${marketName} — ${contractName}` : marketName;
    if (!title) continue;

    const matchText = `${marketName} ${contractName}`.trim();

    out.push({
      venue: "predictit",
      id: `${m.id ?? "m"}-${c.id ?? out.length}`,
      title,
      yesAsk: buyPrice(c.bestBuyYesCost),
      noAsk: buyPrice(c.bestBuyNoCost),
      endDate: parseDate(c.dateEnd),
      url,
      tokens: normalizeTokens(matchText),
    });
  }

  return out;
}

/** Fetch and normalize all PredictIt binary contracts. */
export async function fetchPredictItMarkets(): Promise<NormalizedMarket[]> {
  const res = await fetch(PREDICTIT_URL, {
    headers: { accept: "application/json" },
    next: { revalidate: CONFIG.revalidateSeconds },
  });
  if (!res.ok) {
    throw new Error(`PredictIt request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PredictItResponse;
  const markets = data.markets ?? [];

  const out: NormalizedMarket[] = [];
  for (const m of markets) out.push(...normalizePredictItMarket(m));
  return out;
}
