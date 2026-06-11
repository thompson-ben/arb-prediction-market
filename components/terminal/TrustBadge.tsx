import type { OpportunityStatus } from "@/lib/types";

const TRUST: Record<
  OpportunityStatus,
  { emoji: string; label: string; desc: string; cls: string }
> = {
  VERIFIED: {
    emoji: "🟢",
    label: "VERIFIED",
    desc: "High confidence. Resolution criteria appear equivalent.",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  },
  REVIEW_REQUIRED: {
    emoji: "🟡",
    label: "REVIEW REQUIRED",
    desc: "Potential differences detected. You should verify manually before trading.",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  },
  HIGH_RISK: {
    emoji: "🔴",
    label: "LIKELY BAD MATCH",
    desc: "Significant differences detected. Arbitrage calculations may be invalid.",
    cls: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  },
};

/** The most prominent element on the detail page (Priority 3). */
export function TrustBadge({ status }: { status: OpportunityStatus }) {
  const t = TRUST[status];
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${t.cls}`}>
      <div className="flex items-center gap-2.5 text-lg font-bold tracking-wide">
        <span aria-hidden>{t.emoji}</span>
        {t.label}
      </div>
      <p className="mt-1 text-sm opacity-80">{t.desc}</p>
    </div>
  );
}
