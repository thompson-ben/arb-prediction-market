/** Runtime configuration, overridable via environment variables on Vercel. */

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const CONFIG = {
  /** Minimum margin (as a fraction) for an opportunity to be reported. 0.05 = 5%. */
  minMargin: numEnv("MIN_MARGIN", 0.05),
  /** Minimum title-similarity (0–1) required to treat two markets as the same event. */
  matchThreshold: numEnv("MATCH_THRESHOLD", 0.5),
  /** Maximum number of markets to pull from each venue per scan. */
  maxMarkets: numEnv("MAX_MARKETS", 500),
  /** Seconds to cache upstream API responses (Next.js fetch revalidation). */
  revalidateSeconds: numEnv("REVALIDATE_SECONDS", 60),
} as const;
