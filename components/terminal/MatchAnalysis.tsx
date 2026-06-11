import { pct } from "@/lib/format";
import type { MatchAssessment } from "@/lib/trust";
import type { NormalizedMarket } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

function MarketBlock({ label, market }: { label: string; market: NormalizedMarket }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        Market {label} · {venueLabel(market.venue)}
      </div>
      <a
        href={market.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-sm text-white/85 hover:text-white"
      >
        {market.title}
      </a>
    </div>
  );
}

/** Match Analysis — the prominent "are these the same event?" section (Priority 2). */
export function MatchAnalysis({
  assessment,
  marketA,
  marketB,
}: {
  assessment: MatchAssessment;
  marketA: NormalizedMarket;
  marketB: NormalizedMarket;
}) {
  const headlineCls =
    assessment.trust === "verified"
      ? "text-emerald-300"
      : assessment.trust === "review"
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.02] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">
        Match Analysis
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <MarketBlock label="A" market={marketA} />
        <MarketBlock label="B" market={marketB} />
      </div>

      <div className={`mt-3 text-sm font-medium ${headlineCls}`}>
        {assessment.headline}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-rose-300/70">
            Reasons for concern
          </div>
          <ul className="mt-1.5 space-y-1">
            {assessment.concernReasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-white/60">
                <span className="text-rose-400">✗</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/70">
            Reasons supporting match
          </div>
          <ul className="mt-1.5 space-y-1">
            {assessment.supportReasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-white/60">
                <span className="text-emerald-400">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm text-white/60">Overall Match Confidence</span>
        <span className="font-mono text-2xl font-semibold tabular-nums text-white">
          {pct(assessment.matchConfidence, 0)}
        </span>
      </div>
    </div>
  );
}
