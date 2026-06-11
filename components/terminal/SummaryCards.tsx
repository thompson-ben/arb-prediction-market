import { pct } from "@/lib/format";

export interface SummaryStats {
  opportunitiesFound: number;
  bestMargin: number | null;
  averageMargin: number | null;
  marketsScanned: number;
  venuesScanned: number;
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${accent ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

export function SummaryCards({ stats }: { stats: SummaryStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card
        label="Opportunities"
        value={stats.opportunitiesFound.toString()}
        sub="match current filters"
        accent="text-emerald-300"
      />
      <Card
        label="Best Margin"
        value={stats.bestMargin === null ? "—" : pct(stats.bestMargin)}
        sub="net of fees"
      />
      <Card
        label="Avg Margin"
        value={stats.averageMargin === null ? "—" : pct(stats.averageMargin)}
        sub="net of fees"
      />
      <Card
        label="Markets Scanned"
        value={stats.marketsScanned.toLocaleString()}
        sub="across all venues"
      />
      <Card
        label="Venues Scanned"
        value={stats.venuesScanned.toString()}
        sub="live sources"
      />
    </div>
  );
}
