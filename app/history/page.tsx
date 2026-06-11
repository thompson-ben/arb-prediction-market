import { formatDate, pct } from "@/lib/format";
import { historyStats } from "@/lib/history";
import { getStore, KEYS } from "@/lib/store";
import { venueLabel } from "@/lib/venues";
import type { OpportunityHistory, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default async function HistoryPage() {
  const store = getStore();
  const history =
    (await store.getJSON<Record<string, OpportunityHistory>>(KEYS.history)) ?? {};
  const records = Object.values(history);
  const latestScanAt = records.length
    ? records.map((r) => r.lastSeen).sort().at(-1)
    : undefined;
  const stats = historyStats(history, latestScanAt);

  const top = [...records]
    .sort((a, b) => b.peakMargin - a.peakMargin)
    .slice(0, 100);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Opportunity History</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          Longitudinal record of every opportunity seen across scans. Populated by
          the scheduled scan (<span className="font-mono">/api/cron/scan</span>);
          requires a configured KV store to accumulate on Vercel. Store:{" "}
          <span className="font-mono text-white/60">{store.kind}</span>.
        </p>
      </header>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center text-white/50">
          No history recorded yet. Trigger a scan via{" "}
          <span className="font-mono">/api/cron/scan</span> (configure a KV store
          first for durable history), then refresh.
        </div>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tracked" value={stats.tracked.toLocaleString()} />
            <Stat label="Active Now" value={stats.activeNow.toLocaleString()} sub="latest scan" />
            <Stat label="Avg Appearances" value={stats.averageAppearances.toFixed(1)} />
            <Stat label="Avg Duration" value={fmtHours(stats.averageDurationHours)} />
            <Stat label="Longest" value={fmtHours(stats.longestDurationHours)} />
            <Stat
              label="Best Peak Margin"
              value={stats.bestPeakMargin === null ? "—" : pct(stats.bestPeakMargin)}
            />
          </section>

          <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/80">
              Appearances by venue pair
            </h2>
            <div className="space-y-2">
              {stats.byVenuePair.map((vp) => (
                <div key={vp.pair} className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{vp.pair}</span>
                  <span className="font-mono tabular-nums text-white/60">
                    {vp.count.toLocaleString()} appearances · peak {pct(vp.bestPeakMargin)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Market</th>
                  <th className="px-3 py-2.5 font-medium text-right">Peak</th>
                  <th className="px-3 py-2.5 font-medium text-right">Last</th>
                  <th className="px-3 py-2.5 font-medium text-right">Appearances</th>
                  <th className="px-3 py-2.5 font-medium text-right">First seen</th>
                  <th className="px-3 py-2.5 font-medium text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.key} className="border-t border-white/5">
                    <td className="max-w-sm px-3 py-2.5">
                      <div className="truncate text-white/85" title={r.question}>
                        {r.question}
                      </div>
                      <div className="text-[11px] text-white/40">
                        {(r.venues as Venue[]).map((v) => venueLabel(v)).join(" ↔ ")}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-300">
                      {pct(r.peakMargin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {pct(r.lastMargin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {r.appearances}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/50">
                      {formatDate(r.firstSeen)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/50">
                      {formatDate(r.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
