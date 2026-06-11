import { isAuthorizedKey } from "@/lib/admin";
import {
  dbEnabled,
  getCategoryAnalytics,
  getMatchQuality,
  getOpportunities,
  getReviewCounts,
  getVenueAnalytics,
} from "@/lib/db";
import { compactMoney, pct } from "@/lib/format";
import { venuePairLabel } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fmtPct = (v: number | null | undefined) => (v == null ? "—" : pct(v));
const fmtHours = (h: number | null | undefined) => (h == null ? "—" : `${h.toFixed(1)}h`);
const DAY = 86400_000;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="text-[10px] text-white/40">{sub}</div>}
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
          Append <span className="font-mono">?key=YOUR_ADMIN_TOKEN</span> to the URL.
        </p>
      </main>
    );
  }

  if (!dbEnabled()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-lg font-semibold text-white">Supabase not configured</h1>
        <p className="mt-2 text-sm text-white/45">
          Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, apply the migration in
          supabase/migrations, and let the scheduled scan run.
        </p>
      </main>
    );
  }

  const [opps, venues, categories, quality, reviews] = await Promise.all([
    getOpportunities(5000),
    getVenueAnalytics(),
    getCategoryAnalytics(),
    getMatchQuality(),
    getReviewCounts(),
  ]);

  const now = Date.now();
  const since = (ms: number) => opps.filter((o) => now - new Date(o.last_seen).getTime() <= ms);
  const today = since(DAY);
  const week = since(7 * DAY);
  const execWeek = week.filter((o) => (o.peak_executable_margin ?? 0) > 0);

  const execMargins = opps.map((o) => o.avg_executable_margin).filter((v): v is number => v != null);
  const stakes = opps.map((o) => o.avg_executable_stake).filter((v): v is number => v != null);
  const durations = opps.map((o) => o.duration_seconds ?? 0);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const bestVenue = venues[0];
  const bestCategory = [...categories].sort((a, b) => (b.avg_margin ?? 0) - (a.avg_margin ?? 0))[0];
  const decided = reviews.approved + reviews.rejected;
  const approvalRate = decided ? reviews.approved / decided : null;
  const rejectionRate = decided ? reviews.rejected / decided : null;
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Research &amp; BI Dashboard</h1>
          <p className="mt-1 text-sm text-white/45">
            System of record: <span className="font-mono text-white/60">Supabase</span> ·{" "}
            {opps.length.toLocaleString()} tracked opportunities
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["snapshots", "history", "reviews", "venues", "categories"] as const).map((t) => (
            <a
              key={t}
              href={`/api/export?type=${t}${keyParam}`}
              className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
            >
              Export {t}
            </a>
          ))}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Opportunities Today" value={today.length.toLocaleString()} />
        <Stat label="This Week" value={week.length.toLocaleString()} />
        <Stat label="Executable (wk)" value={execWeek.length.toLocaleString()} />
        <Stat label="Avg Exec Margin" value={fmtPct(avg(execMargins))} />
        <Stat label="Largest Exec Margin" value={fmtPct(maxOrNull(opps.map((o) => o.peak_executable_margin)))} />
        <Stat label="Avg Duration" value={durations.length ? `${(avg(durations)! / 3600).toFixed(1)}h` : "—"} />
        <Stat label="Avg Exec Stake" value={compactMoney(avg(stakes) ?? undefined)} />
        <Stat label="Largest Exec Stake" value={compactMoney(maxOrNull(opps.map((o) => o.peak_executable_stake)) ?? undefined)} />
        <Stat label="Best Venue Pair" value={bestVenue ? venuePairLabel(bestVenue.venue_pair) : "—"} sub={bestVenue ? fmtPct(bestVenue.avg_margin) : undefined} />
        <Stat label="Best Category" value={bestCategory?.category ?? "—"} sub={bestCategory ? fmtPct(bestCategory.avg_margin) : undefined} />
        <Stat label="Approval Rate" value={fmtPct(approvalRate)} sub={`${reviews.approved}/${decided || 0}`} />
        <Stat label="Rejection Rate" value={fmtPct(rejectionRate)} sub={`${reviews.rejected}/${decided || 0}`} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Venue Pair Performance</h2>
        <Table
          head={["Venue Pair", "Opps", "Exec", "Avg Margin", "Avg Exec", "Avg Dur", "Avg Stake", "Largest"]}
          rows={venues.map((v) => [
            venuePairLabel(v.venue_pair),
            v.opportunities.toString(),
            v.executable_opportunities.toString(),
            fmtPct(v.avg_margin),
            fmtPct(v.avg_executable_margin),
            fmtHours(v.avg_duration_hours),
            compactMoney(v.avg_executable_stake ?? undefined),
            fmtPct(v.largest_margin),
          ])}
          empty="No venue data yet."
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Category Performance</h2>
        <Table
          head={["Category", "Opps", "Exec", "Avg Margin", "Avg Dur", "Avg Stake", "Approval"]}
          rows={categories.map((c) => [
            c.category,
            c.opportunities.toString(),
            c.executable_opportunities.toString(),
            fmtPct(c.avg_margin),
            fmtHours(c.avg_duration_hours),
            compactMoney(c.avg_executable_stake ?? undefined),
            fmtPct(c.approval_rate),
          ])}
          empty="No category data yet."
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Match Quality by Confidence Band</h2>
        <Table
          head={["Confidence", "Matches", "Approved", "Rejected", "Needs Review"]}
          rows={quality.map((q) => [
            bandLabel(q.band),
            q.matches.toString(),
            q.approved.toString(),
            q.rejected.toString(),
            q.needs_review.toString(),
          ])}
          empty="No match-quality data yet."
        />
      </section>
    </main>
  );
}

function maxOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.max(...nums) : null;
}

/** width_bucket bands over [0.4, 1.0] in 6 steps → readable ranges. */
function bandLabel(band: number | null): string {
  if (band == null || band < 1) return "< 40%";
  if (band > 6) return "100%";
  const lo = 40 + (band - 1) * 10;
  return `${lo}–${lo + 10}%`;
}
