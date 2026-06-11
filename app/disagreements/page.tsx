import { pct, relativeExpiry } from "@/lib/format";
import { scanDisagreements } from "@/lib/scan";
import { venueLabel } from "@/lib/venues";
import type { Disagreement } from "@/lib/types";

export const dynamic = "force-dynamic";

function SpreadBar({ d }: { d: Disagreement }) {
  // Plot each venue's implied probability on a 0–100% track.
  return (
    <div className="relative h-8 w-full rounded bg-white/5">
      {d.quotes.map((q) => (
        <div
          key={q.venue}
          className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center justify-center"
          style={{ left: `${Math.min(100, Math.max(0, q.impliedYes * 100))}%` }}
          title={`${venueLabel(q.venue)} ${pct(q.impliedYes, 0)}`}
        >
          <span className="h-4 w-0.5 bg-emerald-300/80" />
          <span className="mt-0.5 whitespace-nowrap font-mono text-[9px] text-white/50">
            {q.venue.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function DisagreementsPage() {
  const { disagreements, generatedAt, errors } = await scanDisagreements();
  const hasOutage = Object.keys(errors).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Market Disagreements</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          Where venues materially disagree on the same event&apos;s probability.
          This is <span className="text-white/70">distinct from arbitrage</span> —
          a disagreement need not be tradeable, but a large, confident spread is a
          signal in its own right. Ranked by spread.
        </p>
        <p className="mt-1 text-xs text-white/30">
          {disagreements.length} disagreements · {new Date(generatedAt).toLocaleTimeString()}
        </p>
      </header>

      {hasOutage && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
          Partial results — some venues were unreachable, so cross-venue clusters may be incomplete.
        </div>
      )}

      {disagreements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center text-white/50">
          No material cross-venue disagreements found in this scan.
        </div>
      ) : (
        <div className="space-y-3">
          {disagreements.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white/90">{d.question}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 uppercase tracking-wide">
                      {d.category}
                    </span>
                    <span>confidence {pct(d.confidence, 0)}</span>
                    <span>resolves {relativeExpiry(d.endDate)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-semibold tabular-nums text-amber-300">
                    {pct(d.spread, 0)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    spread
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {d.quotes.map((q) => (
                  <span
                    key={q.venue}
                    className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs"
                  >
                    <span className="text-white/50">{venueLabel(q.venue)}</span>
                    <span className="font-mono font-semibold tabular-nums text-white/85">
                      {pct(q.impliedYes, 0)}
                    </span>
                  </span>
                ))}
              </div>

              <div className="mt-3">
                <SpreadBar d={d} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-white/30">
        Implied probability is the midpoint of each venue&apos;s YES ask and
        (1 − NO ask). Clusters are anchor-matched by question similarity; verify
        that venues are pricing the <em>same</em> resolution criteria before
        drawing conclusions.
      </p>
    </main>
  );
}
