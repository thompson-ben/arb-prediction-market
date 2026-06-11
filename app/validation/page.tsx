import { pct } from "@/lib/format";
import { scanOpportunities } from "@/lib/scan";
import { getStore, KEYS } from "@/lib/store";
import { venueLabel } from "@/lib/venues";
import type { ScanDiagnostics, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function Histogram({ diagnostics }: { diagnostics: ScanDiagnostics }) {
  const bins = diagnostics.match.confidenceHistogram;
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="space-y-1.5">
      {bins.map((bin) => (
        <div key={bin.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right font-mono text-white/50">{bin.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-white/5">
            <div
              className="h-full rounded bg-emerald-500/40"
              style={{ width: `${(bin.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 font-mono tabular-nums text-white/60">{bin.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ValidationPage() {
  const result = await scanOpportunities();
  const d = result.diagnostics;

  const store = getStore();
  const snapshots =
    (await store.getJSON<{ at: string }[]>(KEYS.analytics)) ?? [];

  const matchRate =
    d.match.pairsConsidered > 0
      ? d.match.matchesCreated / d.match.pairsConsidered
      : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Validation &amp; Data Quality</h1>
        <p className="mt-1 text-sm text-white/45">
          Internal diagnostics for the current live scan. Store:{" "}
          <span className="font-mono text-white/60">{store.kind}</span> ·{" "}
          {snapshots.length} recorded snapshot(s) ·{" "}
          {new Date(result.generatedAt).toLocaleString()}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Markets Scanned" value={d.marketsScanned.toLocaleString()} />
        <Stat label="Venues Scanned" value={d.venuesScanned.toString()} />
        <Stat label="Pairs Considered" value={d.match.pairsConsidered.toLocaleString()} />
        <Stat
          label="Matches Created"
          value={d.match.matchesCreated.toLocaleString()}
          sub={`${pct(matchRate, 1)} of pairs`}
        />
        <Stat label="Matches Rejected" value={d.match.matchesRejected.toLocaleString()} />
        <Stat label="Opportunities Found" value={d.opportunitiesFound.toString()} sub="positive margin" />
        <Stat
          label="Above Threshold"
          value={d.opportunitiesAboveThreshold.toString()}
          sub={`≥ ${pct(result.config.minMargin, 0)}`}
        />
        <Stat
          label="Avg / Largest Margin"
          value={`${d.averageMargin === null ? "—" : pct(d.averageMargin)} / ${
            d.largestMargin === null ? "—" : pct(d.largestMargin)
          }`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/80">
            Markets per venue
          </h2>
          <div className="space-y-2">
            {(Object.entries(d.marketsByVenue) as [Venue, number][]).map(([venue, count]) => {
              const err = venue in result.errors;
              return (
                <div key={venue} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        err ? "bg-rose-400" : count > 0 ? "bg-emerald-400" : "bg-white/30"
                      }`}
                    />
                    {venueLabel(venue)}
                  </span>
                  <span className="font-mono tabular-nums text-white/70">
                    {count.toLocaleString()}
                    {err && <span className="ml-2 text-rose-300/80">offline</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/80">
            Match confidence distribution
          </h2>
          <Histogram diagnostics={d} />
        </div>
      </section>

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-white/30">
        These figures evaluate data quality, not trade quality. A high
        rejected-to-created ratio is healthy — it means the matcher is discarding
        weak token overlaps. Persisted snapshots accumulate via the scheduled
        scan (<span className="font-mono">/api/cron/scan</span>) once a KV store
        is configured.
      </p>
    </main>
  );
}
