import { dbEnabled, getOpportunities, type OpportunityAggRow } from "@/lib/db";
import { compactMoney, pct } from "@/lib/format";
import { venuePairLabel } from "@/lib/venues";

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

function fmtHours(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default async function HistoryPage() {
  const rows = await getOpportunities(200);

  const durations = rows.map((r) => r.duration_seconds ?? 0);
  const avgDuration = rows.length ? durations.reduce((a, b) => a + b, 0) / rows.length : 0;
  const longest = rows.length ? Math.max(...durations) : 0;
  const bestPeak = rows.length ? Math.max(...rows.map((r) => r.peak_margin ?? 0)) : null;
  const avgAppearances = rows.length
    ? rows.reduce((a, r) => a + r.appearances, 0) / rows.length
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Opportunity History &amp; Decay</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          Per-opportunity decay and capital analytics from the{" "}
          <span className="font-mono">opportunities</span> view in Supabase.
          Populated by the scheduled scan.
        </p>
      </header>

      {!dbEnabled() ? (
        <Notice text="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run the scheduled scan." />
      ) : rows.length === 0 ? (
        <Notice text="No history recorded yet. Trigger /api/cron/scan, then refresh." />
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Tracked" value={rows.length.toLocaleString()} />
            <Stat label="Avg Appearances" value={avgAppearances.toFixed(1)} />
            <Stat label="Avg Duration" value={fmtHours(avgDuration)} />
            <Stat label="Longest" value={fmtHours(longest)} />
            <Stat label="Best Peak Margin" value={bestPeak == null ? "—" : pct(bestPeak)} />
          </section>

          <section className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Market</th>
                  <th className="px-3 py-2.5 text-right font-medium">Peak</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg</th>
                  <th className="px-3 py-2.5 text-right font-medium">Exec</th>
                  <th className="px-3 py-2.5 text-right font-medium">Max Stake</th>
                  <th className="px-3 py-2.5 text-right font-medium">Decay/h</th>
                  <th className="px-3 py-2.5 text-right font-medium">Appears</th>
                  <th className="px-3 py-2.5 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: OpportunityAggRow) => (
                  <tr key={r.opportunity_id} className="border-t border-white/5">
                    <td className="max-w-sm px-3 py-2.5">
                      <div className="truncate text-white/85" title={r.question}>
                        {r.question}
                      </div>
                      <div className="text-[11px] text-white/40">
                        {venuePairLabel(r.venue_pair)} · {r.category}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-300">
                      {r.peak_margin == null ? "—" : pct(r.peak_margin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {r.avg_margin == null ? "—" : pct(r.avg_margin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {r.peak_executable_margin == null ? "—" : pct(r.peak_executable_margin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {compactMoney(r.peak_executable_stake ?? undefined)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/50">
                      {r.margin_decay_rate_per_hour == null
                        ? "—"
                        : `${(r.margin_decay_rate_per_hour * 100).toFixed(2)}pp`}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white/70">
                      {r.appearances}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/50">
                      {fmtHours(r.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="mt-3 text-[11px] text-white/30">
            Decay/h is the net-margin change per hour from first to last sighting
            ({"pp = percentage points"}); negative means the edge is widening.
            Resolution dates:{" "}
            {rows.filter((r) => r.resolution_date).length} of {rows.length} known.
          </p>
        </>
      )}
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center text-white/50">
      {text}
    </div>
  );
}
