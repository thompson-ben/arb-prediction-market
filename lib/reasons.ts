import { daysUntil } from "@/lib/format";
import type { NormalizedMarket } from "@/lib/types";

/** Title-case-ish join of tokens for display. */
function list(tokens: string[], limit = 6): string {
  return tokens.slice(0, limit).join(", ");
}

/** Reasons that support the match (Step 3: "reasons for confidence"). */
export function confidenceReasons(a: NormalizedMarket, b: NormalizedMarket): string[] {
  const reasons: string[] = [];
  const setB = new Set(b.tokens);
  const shared = [...new Set(a.tokens)].filter((t) => setB.has(t));

  if (shared.length > 0) {
    reasons.push(`Both questions mention: ${list(shared)}.`);
  }
  const years = shared.filter((t) => /^(19|20)\d{2}$/.test(t));
  if (years.length > 0) {
    reasons.push(`Same year referenced (${list(years, 3)}).`);
  }

  const aDays = daysUntil(a.endDate);
  const bDays = daysUntil(b.endDate);
  if (aDays !== undefined && bDays !== undefined && Math.abs(aDays - bDays) <= 7) {
    reasons.push("Resolution dates are within a week of each other.");
  }
  if (reasons.length === 0) {
    reasons.push("Some token overlap, but limited shared context.");
  }
  return reasons;
}

/** Reasons to doubt the match (Step 3: "reasons for concern"). */
export function concernReasons(
  a: NormalizedMarket,
  b: NormalizedMarket,
  netMargin?: number,
): string[] {
  const reasons: string[] = [];
  const setA = new Set(a.tokens);
  const setB = new Set(b.tokens);
  const onlyA = [...setA].filter((t) => !setB.has(t));
  const onlyB = [...setB].filter((t) => !setA.has(t));

  if (onlyA.length > 0) reasons.push(`Only ${a.venue} mentions: ${list(onlyA)}.`);
  if (onlyB.length > 0) reasons.push(`Only ${b.venue} mentions: ${list(onlyB)}.`);

  const aDays = daysUntil(a.endDate);
  const bDays = daysUntil(b.endDate);
  if (aDays !== undefined && bDays !== undefined && Math.abs(aDays - bDays) > 30) {
    reasons.push("Resolution dates differ by more than a month — may be different events.");
  } else if (a.endDate === undefined || b.endDate === undefined) {
    reasons.push("Resolution date missing on at least one venue — can't confirm same window.");
  }

  if (netMargin !== undefined && netMargin > 0.25) {
    reasons.push("Margin is implausibly large — strongly suggests a mismatch or stale quote.");
  }
  if (a.venue === "predictit" || b.venue === "predictit") {
    reasons.push("PredictIt resolution criteria can differ subtly from other venues.");
  }
  if (reasons.length === 0) {
    reasons.push("No major red flags, but resolution terms still need manual confirmation.");
  }
  return reasons;
}
