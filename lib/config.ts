/** Runtime configuration, overridable via environment variables on Vercel. */

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const CONFIG = {
  /** Default minimum margin (fraction) the UI filter starts at. 0.05 = 5%. */
  minMargin: numEnv("MIN_MARGIN", 0.05),
  /** Default minimum title-similarity (0–1) the UI confidence filter starts at. */
  matchThreshold: numEnv("MATCH_THRESHOLD", 0.5),
  /**
   * Discovery floor for the server scan — opportunities are collected down to
   * these thresholds so the client can filter (and surface a Top-5 fallback)
   * without re-fetching. The UI never shows below `discoveryMargin` except in
   * the Top-5 fallback.
   */
  discoveryMargin: numEnv("DISCOVERY_MARGIN", 0),
  discoveryMatchThreshold: numEnv("DISCOVERY_MATCH_THRESHOLD", 0.45),
  /** Maximum number of markets to pull from each venue per scan. */
  maxMarkets: numEnv("MAX_MARKETS", 500),
  /** Seconds to cache upstream API responses (Next.js fetch revalidation). */
  revalidateSeconds: numEnv("REVALIDATE_SECONDS", 60),
} as const;
