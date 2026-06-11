import {
  type AnalyticsSnapshot,
  type DailyMetric,
  dailyMetrics,
  dataQuality,
  funnel,
  venuePairAnalytics,
} from "@/lib/analytics";
import { isAuthorizedKey } from "@/lib/admin";
import { pct } from "@/lib/format";
import { getStore, KEYS } from "@/lib/store";
import { venueLabel } from "@/lib/venues";
import type { OpportunityHistory, ReviewDecision, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

const fmtPct = (v: number | null) => (v == null ? "—" : pct(v));
const fmtNum = (v: number | null) => (v == null ? "—" : v.toLocaleString());

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h2>
      {note && <p className="mb-3 text-xs text-white/35">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  if (!isAuthorizedKey(key)) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-lg font-semibold text-white">Admin only</h1>
        <p className="mt-2 text-sm text-white/45">
          This analytics dashboard is gated. Append{" "}
          <span className="font-mono">?key=YOUR_ADMIN_TOKEN</span> to the URL.
        </p>
      </main>
    );
  }

  const store = getStore();
  const [snapshots, history, reviews] = await Promise.all([
    store.getJSON<AnalyticsSnapshot[]>(KEYS.analytics).then((v) => v ?? []),
    store.getJSON<Record<string, OpportunityHistory>>(KEYS.history).then((v) => v ?? {}),
    store.getJSON<Record<string, ReviewDecision>>(KEYS.reviews).then((v) => v ?? {}),
  ]);

  const daily = dailyMetrics(snapshots, reviews);
  const funnelStages = funnel(snapshots);
  const venues = venuePairAnalytics(history, snapshots);
  const quality = dataQuality(snapshots, reviews);
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Platform Analytics</h1>
          <p className="mt-1 text-sm text-white/45">
            Business intelligence · store{" "}
            <span className="font-mono text-white/60">{store.kind}</span> ·{" "}
            {snapshots.length} snapshot(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["history", "validation", "venues"] as const).map((t) => (
            <a
              key={t}
              href={`/api/export?type=${t}${keyParam}`}
              className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
            >
              Export {t} CSV
            </a>
          ))}
        </div>
      </header>

      {snapshots.length === 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          No analytics snapshots yet. They accumulate via{" "}
          <span className="font-mono">/api/cron/scan</span> (configure a KV store
          for persistence on Vercel).
        </div>
      )}

      {/* PRIORITY 2 — FUNNEL */}
      <Section
        title="Opportunity Funnel"
        note="Per-scan averages across all snapshots, with stage-to-stage conversion."
      >
        <div className="space-y-2">
          {funnelStages.map((stage) => {
            const widthBase = funnelStages[0].value || 1;
            const width = Math.max(2, (stage.value / widthBase) * 100);
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className="w-44 shrink-0 text-sm text-white/70">{stage.label}</div>
                <div className="h-7 flex-1 overflow-hidden rounded bg-white/5">
                  <div
                    className="flex h-full items-center rounded bg-emerald-500/30 px-2 font-mono text-xs text-white/80"
                    style={{ width: `${width}%` }}
                  >
                    {stage.value.toFixed(stage.value < 10 ? 1 : 0)}
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-xs text-white/50">
                  {stage.conversion == null ? "—" : pct(stage.conversion, 2)}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* PRIORITY 4 — DATA QUALITY */}
      <Section title="Data Quality" note="Confidence, decision split, false-match rate, and order-book coverage.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Avg Confidence" value={fmtPct(quality.averageConfidence)} />
          <Stat label="Approved" value={`${quality.approved}`} sub={fmtPct(quality.approvedPct)} />
          <Stat label="Rejected" value={`${quality.rejected}`} sub={fmtPct(quality.rejectedPct)} />
          <Stat label="Needs Review" value={`${quality.needsReview}`} />
          <Stat label="False-match Rate" value={fmtPct(quality.falseMatchRate)} sub="rejected / decided" />
          <Stat label="Missing Order Book" value={fmtPct(quality.missingOrderBookPct)} sub="of sampled" />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
            Confidence distribution
          </div>
          <ConfidenceHistogram bins={quality.confidenceHistogram} />
        </div>
      </Section>

      {/* PRIORITY 3 — VENUE ANALYTICS */}
      <Section title="Venue Analytics" note="Per venue pair, from accumulated history + sampled executable pricing.">
        <Table
          head={["Venue Pair", "Opps", "Avg Margin", "Avg Exec Margin", "Avg Duration", "Largest"]}
          rows={venues.map((v) => [
            v.pair,
            v.opportunities.toString(),
            fmtPct(v.averageMargin),
            fmtPct(v.averageExecutableMargin),
            v.averageDurationHours == null ? "—" : `${v.averageDurationHours.toFixed(1)}h`,
            fmtPct(v.largestMargin),
          ])}
          empty="No venue history yet."
        />
      </Section>

      {/* PRIORITY 1 — DAILY METRICS */}
      <Section title="Daily Metrics" note="Volume figures are per-scan averages; approvals/rejections are decision counts for the day.">
        <DailyTable rows={daily} />
      </Section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="text-[10px] text-white/40">{sub}</div>}
    </div>
  );
}

function ConfidenceHistogram({ bins }: { bins: AnalyticsSnapshot["confidenceHistogram"] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="space-y-1.5">
      {bins.map((bin) => (
        <div key={bin.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right font-mono text-white/50">{bin.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-white/5">
            <div className="h-full rounded bg-emerald-500/40" style={{ width: `${(bin.count / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono tabular-nums text-white/60">{bin.count}</span>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center text-sm text-white/45">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/40">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2.5 font-medium ${i === 0 ? "" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-white/5">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`px-3 py-2.5 ${c === 0 ? "text-white/80" : "text-right font-mono tabular-nums text-white/70"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyTable({ rows }: { rows: DailyMetric[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center text-sm text-white/45">
        No daily data yet.
      </div>
    );
  }
  const venues: Venue[] = ["polymarket", "kalshi", "predictit"];
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[1000px] text-left text-xs">
        <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
          <tr>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5 text-right font-medium">Scans</th>
            <th className="px-3 py-2.5 text-right font-medium">Markets</th>
            {venues.map((v) => (
              <th key={v} className="px-3 py-2.5 text-right font-medium">
                {venueLabel(v).slice(0, 4)}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-medium">Matches</th>
            <th className="px-3 py-2.5 text-right font-medium">Appr</th>
            <th className="px-3 py-2.5 text-right font-medium">Rej</th>
            <th className="px-3 py-2.5 text-right font-medium">Opps</th>
            <th className="px-3 py-2.5 text-right font-medium">≥Thr</th>
            <th className="px-3 py-2.5 text-right font-medium">Exec</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg M</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg E</th>
            <th className="px-3 py-2.5 text-right font-medium">Max M</th>
            <th className="px-3 py-2.5 text-right font-medium">Max E</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums text-white/70">
          {rows.map((d) => (
            <tr key={d.date} className="border-t border-white/5">
              <td className="px-3 py-2 font-sans text-white/80">{d.date}</td>
              <td className="px-3 py-2 text-right">{d.scans}</td>
              <td className="px-3 py-2 text-right">{d.marketsScanned.toLocaleString()}</td>
              {venues.map((v) => (
                <td key={v} className="px-3 py-2 text-right">
                  {(d.marketsByVenue[v] ?? 0).toLocaleString()}
                </td>
              ))}
              <td className="px-3 py-2 text-right">{d.matchesGenerated}</td>
              <td className="px-3 py-2 text-right text-emerald-300/80">{d.matchesApproved}</td>
              <td className="px-3 py-2 text-right text-rose-300/80">{d.matchesRejected}</td>
              <td className="px-3 py-2 text-right">{d.opportunitiesDetected}</td>
              <td className="px-3 py-2 text-right">{d.opportunitiesAboveThreshold}</td>
              <td className="px-3 py-2 text-right">{d.executableOpportunities}</td>
              <td className="px-3 py-2 text-right">{fmtPct(d.averageMargin)}</td>
              <td className="px-3 py-2 text-right">{fmtPct(d.averageExecutableMargin)}</td>
              <td className="px-3 py-2 text-right">{fmtPct(d.largestMargin)}</td>
              <td className="px-3 py-2 text-right">{fmtPct(d.largestExecutableMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
