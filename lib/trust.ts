/**
 * Phase 4 — trust-first opportunity analysis.
 *
 * Turns a matched market pair into a human-readable assessment: detect the
 * signals that suggest the two markets may NOT describe the same event, score
 * the overall suspicion, derive a trust level, and write a plain-English
 * summary. The goal is not to reject opportunities but to make the user
 * understand *why* one exists before they look at any profit figure.
 */

import { categorize } from "@/lib/category";
import { daysUntil, pct } from "@/lib/format";
import type {
  Category,
  NormalizedMarket,
  OpportunityStatus,
} from "@/lib/types";
import { venueLabel } from "@/lib/venues";

export type TrustLevel = "verified" | "review" | "bad_match";

/** Words that look capitalized but aren't entity names. */
const NON_NAME_WORDS = new Set([
  "Will", "Who", "What", "When", "Where", "Which", "Does", "Did", "Do", "Are",
  "Is", "Was", "Were", "The", "A", "An", "In", "On", "By", "For", "And", "Or",
  "To", "Of", "Be", "Win", "Reach", "Above", "Below", "Before", "After",
]);

/** Extract likely proper nouns (entity/candidate names) from a raw title. */
export function properNouns(title: string): string[] {
  const matches = title.match(/[A-ZÀ-Ý][a-zà-ÿ'’-]{2,}/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of matches) {
    if (NON_NAME_WORDS.has(word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

interface Signals {
  onlyA: string[];
  onlyB: string[];
  sharedProper: string[];
  namesDiffer: boolean;
  categoryA: Category;
  categoryB: Category;
  categoriesDiffer: boolean;
  dateGapDays?: number;
  missingDate: boolean;
  wording: "low" | "some" | "ok";
  marginLevel: "extreme" | "high" | "elevated" | "normal";
  involvesPredictIt: boolean;
  sharedYear?: string;
  sharedTokens: string[];
}

function analyze(
  a: NormalizedMarket,
  b: NormalizedMarket,
  netMargin: number,
  matchScore: number,
): Signals {
  const propA = properNouns(a.title);
  const propB = properNouns(b.title);
  const lowerB = new Set(propB.map((w) => w.toLowerCase()));
  const lowerA = new Set(propA.map((w) => w.toLowerCase()));
  const onlyA = propA.filter((w) => !lowerB.has(w.toLowerCase()));
  const onlyB = propB.filter((w) => !lowerA.has(w.toLowerCase()));
  const sharedProper = propA.filter((w) => lowerB.has(w.toLowerCase()));

  const categoryA = categorize(a.title);
  const categoryB = categorize(b.title);

  const aDays = daysUntil(a.endDate);
  const bDays = daysUntil(b.endDate);
  const missingDate = a.endDate === undefined || b.endDate === undefined;
  const dateGapDays =
    aDays !== undefined && bDays !== undefined ? Math.abs(aDays - bDays) : undefined;

  const wording: Signals["wording"] =
    matchScore < 0.6 ? "low" : matchScore < 0.75 ? "some" : "ok";

  const marginLevel: Signals["marginLevel"] =
    netMargin > 0.25 ? "extreme" : netMargin > 0.15 ? "high" : netMargin > 0.1 ? "elevated" : "normal";

  const sharedTokens = a.tokens.filter((t) => b.tokens.includes(t));
  const sharedYear = sharedTokens.find((t) => /^(19|20)\d{2}$/.test(t));

  return {
    onlyA,
    onlyB,
    sharedProper,
    // Both sides carrying a *distinct* name strongly suggests different entities.
    namesDiffer: onlyA.length > 0 && onlyB.length > 0,
    categoryA,
    categoryB,
    categoriesDiffer: categoryA !== categoryB,
    dateGapDays,
    missingDate,
    wording,
    marginLevel,
    involvesPredictIt: a.venue === "predictit" || b.venue === "predictit",
    sharedYear,
    sharedTokens,
  };
}

/** Suspicion score in [0, 100] (Priority 4). Higher = verify harder. */
function suspicionFrom(s: Signals): number {
  let score = 0;
  if (s.namesDiffer) score += 35;
  if (s.categoriesDiffer) score += 20;
  if (s.dateGapDays !== undefined && s.dateGapDays > 30) score += 25;
  else if (s.dateGapDays !== undefined && s.dateGapDays > 14) score += 15;
  else if (s.missingDate) score += 10;
  if (s.wording === "low") score += 20;
  else if (s.wording === "some") score += 10;
  if (s.marginLevel === "extreme") score += 40;
  else if (s.marginLevel === "high") score += 25;
  else if (s.marginLevel === "elevated") score += 10;
  if (s.involvesPredictIt) score += 5;
  return Math.min(100, score);
}

function trustFrom(matchScore: number, suspicion: number): TrustLevel {
  if (suspicion >= 60 || matchScore < 0.6) return "bad_match";
  if (matchScore >= 0.85 && suspicion < 25) return "verified";
  return "review";
}

const STATUS_OF: Record<TrustLevel, OpportunityStatus> = {
  verified: "VERIFIED",
  review: "REVIEW_REQUIRED",
  bad_match: "HIGH_RISK",
};

function list(items: string[], n = 3): string {
  return items.slice(0, n).join(", ");
}

function buildSupport(s: Signals): string[] {
  const reasons: string[] = [];
  if (s.sharedProper.length) reasons.push(`Both reference ${list(s.sharedProper)}`);
  if (s.sharedYear) reasons.push(`Same year (${s.sharedYear})`);
  if (!s.categoriesDiffer) reasons.push(`Same category (${s.categoryA})`);
  if (s.dateGapDays !== undefined && s.dateGapDays <= 7) reasons.push("Resolution timing aligns");
  const nonProperShared = s.sharedTokens.filter(
    (t) => !/^(19|20)\d{2}$/.test(t) && !s.sharedProper.some((p) => p.toLowerCase() === t),
  );
  if (reasons.length < 2 && nonProperShared.length) {
    reasons.push(`Shared terms: ${list(nonProperShared, 4)}`);
  }
  if (reasons.length === 0) reasons.push("Some overlapping terminology");
  return reasons;
}

function buildConcerns(s: Signals, netMargin: number): string[] {
  const reasons: string[] = [];
  if (s.namesDiffer) {
    reasons.push(`Different names referenced (${list(s.onlyA, 2)} vs ${list(s.onlyB, 2)})`);
  }
  if (s.categoriesDiffer) {
    reasons.push(`Different categories (${s.categoryA} vs ${s.categoryB})`);
  }
  if (s.dateGapDays !== undefined && s.dateGapDays > 14) {
    reasons.push(`Resolution dates differ (~${Math.round(s.dateGapDays)}d apart)`);
  } else if (s.missingDate) {
    reasons.push("Resolution date missing on at least one venue");
  }
  if (s.wording === "low") reasons.push("Substantial differences in market wording");
  else if (s.wording === "some") reasons.push("Some differences in market wording");
  if (s.marginLevel === "extreme") {
    reasons.push(`Unusually large margin (${pct(netMargin)}) — typically signals a mismatch or stale quote`);
  } else if (s.marginLevel === "high") {
    reasons.push(`Large margin (${pct(netMargin)}) — higher than genuine arbitrage usually offers`);
  }
  if (s.involvesPredictIt) reasons.push("PredictIt resolution terms can differ subtly from other venues");
  if (reasons.length === 0) reasons.push("No major red flags, but resolution terms still need confirmation");
  return reasons;
}

function buildSummary(
  a: NormalizedMarket,
  b: NormalizedMarket,
  s: Signals,
  trust: TrustLevel,
  netMargin: number,
): string {
  const vA = venueLabel(a.venue);
  const vB = venueLabel(b.venue);
  const s1 = `This opportunity appears because ${vA} and ${vB} are pricing this market differently.`;

  let s2: string;
  if (s.namesDiffer) {
    s2 = `However, the two markets reference different names (${list(s.onlyA, 1)} vs ${list(s.onlyB, 1)}), so they may not describe the same outcome.`;
  } else if (s.categoriesDiffer) {
    s2 = `However, the markets fall into different categories (${s.categoryA} vs ${s.categoryB}), so they may not be the same event.`;
  } else if (s.marginLevel === "extreme" || s.marginLevel === "high") {
    s2 = `The unusually large ${pct(netMargin)} margin is itself a warning sign that the markets may not be equivalent.`;
  } else if (s.wording === "low") {
    s2 = "However, the wording differs enough that the underlying events may not be identical.";
  } else {
    s2 = "The markets look closely related and likely describe the same event.";
  }

  const s3 =
    trust === "verified"
      ? "They appear equivalent, but always confirm the resolution criteria before trading."
      : trust === "review"
        ? "Manual verification is recommended before treating this as genuine arbitrage."
        : "Manual verification is strongly recommended; treat the profit figures with caution.";

  return `${s1} ${s2} ${s3}`;
}

export interface MatchAssessment {
  status: OpportunityStatus;
  trust: TrustLevel;
  matchConfidence: number;
  suspicionScore: number;
  headline: string;
  supportReasons: string[];
  concernReasons: string[];
  summary: string;
}

/** Full trust assessment of a matched pair. */
export function assessMatch(input: {
  marketA: NormalizedMarket;
  marketB: NormalizedMarket;
  netMargin: number;
  matchScore: number;
}): MatchAssessment {
  const s = analyze(input.marketA, input.marketB, input.netMargin, input.matchScore);
  const suspicionScore = suspicionFrom(s);
  const trust = trustFrom(input.matchScore, suspicionScore);

  const headline =
    trust === "bad_match"
      ? "Likely bad match — significant differences detected."
      : trust === "review"
        ? "Potential mismatch detected."
        : "Markets appear to describe the same event.";

  return {
    status: STATUS_OF[trust],
    trust,
    matchConfidence: input.matchScore,
    suspicionScore,
    headline,
    supportReasons: buildSupport(s),
    concernReasons: buildConcerns(s, input.netMargin),
    summary: buildSummary(input.marketA, input.marketB, s, trust, input.netMargin),
  };
}

/** Coarse liquidity tier for the tradeability panel (Priority 6). */
export function liquidityTier(liquidity?: number): "Low" | "Medium" | "High" {
  if (!liquidity || liquidity < 1000) return "Low";
  if (liquidity < 25000) return "Medium";
  return "High";
}
