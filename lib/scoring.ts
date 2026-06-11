/** Opportunity scoring (Priority 6): combine margin, confidence, liquidity, time. */

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Whole days from now until `iso`, or undefined if unknown. */
export function daysToExpiry(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  return (t - Date.now()) / (1000 * 60 * 60 * 24);
}

/**
 * Time-to-expiry preference curve (0–1). Penalizes both imminent resolutions
 * (execution/settlement risk) and very distant ones (capital tied up), favoring
 * a roughly 3-day to 6-week window. Unknown dates score neutral.
 */
function timeScore(days?: number): number {
  if (days === undefined) return 0.5;
  if (days < 0) return 0; // already resolved/expired
  if (days < 2) return 0.5;
  if (days <= 45) return 1;
  if (days <= 180) return 1 - ((days - 45) / (180 - 45)) * 0.6; // 1.0 → 0.4
  return 0.3;
}

/** Liquidity preference (0–1) on a log scale: ~\$100k+ approaches full marks. */
function liquidityScore(liquidity?: number): number {
  if (!liquidity || liquidity <= 0) return 0.1; // unknown/thin → low but non-zero
  return clamp01(Math.log10(liquidity + 1) / 5);
}

export interface ScoreInput {
  netMargin: number;
  confidence: number;
  liquidity?: number;
  endDate?: string;
}

const WEIGHTS = { margin: 0.4, confidence: 0.3, liquidity: 0.2, time: 0.1 };

/**
 * Actionability score in [0, 100]. Surfaces the most *tradeable* opportunities
 * rather than simply the highest margin. Margin saturates at 20% so an
 * implausible 60% spread doesn't dominate a solid, liquid, well-matched 8%.
 */
export function computeScore(input: ScoreInput): number {
  const margin = clamp01(input.netMargin / 0.2);
  const confidence = clamp01(input.confidence);
  const liquidity = liquidityScore(input.liquidity);
  const time = timeScore(daysToExpiry(input.endDate));

  const score =
    100 *
    (WEIGHTS.margin * margin +
      WEIGHTS.confidence * confidence +
      WEIGHTS.liquidity * liquidity +
      WEIGHTS.time * time);

  return Math.round(Math.min(100, Math.max(0, score)));
}
