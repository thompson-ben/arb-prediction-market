import type { Opportunity } from "@/lib/types";

function formatCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const venueLabel: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
};

function LegPill({
  venue,
  side,
  price,
  url,
}: {
  venue: string;
  side: string;
  price: number;
  url: string;
}) {
  const sideColor =
    side === "YES" ? "text-emerald-300" : "text-rose-300";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-sm hover:bg-white/10"
    >
      <span className="text-white/60">{venueLabel[venue] ?? venue}</span>
      <span className={`font-semibold ${sideColor}`}>{side}</span>
      <span className="tabular-nums text-white/80">{formatCents(price)}</span>
    </a>
  );
}

/** Confidence badge based on title-match similarity. */
function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let cls = "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (score >= 0.8) cls = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  else if (score < 0.6) cls = "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {pct}% match
    </span>
  );
}

export function OpportunityTable({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
        No arbitrage opportunities at or above the configured margin right now.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full border-collapse text-left">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Margin</th>
            <th className="px-4 py-3 font-medium">Market</th>
            <th className="px-4 py-3 font-medium">Buy these legs</th>
            <th className="px-4 py-3 font-medium">Cost</th>
            <th className="px-4 py-3 font-medium">Resolves</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {opportunities.map((opp) => (
            <tr key={opp.id} className="align-top hover:bg-white/[0.03]">
              <td className="px-4 py-4">
                <div className="text-lg font-semibold tabular-nums text-emerald-300">
                  {opp.marginPct.toFixed(1)}%
                </div>
                {opp.marginPct >= 25 && (
                  <div className="mt-1 text-xs text-amber-400/80">verify — large</div>
                )}
              </td>
              <td className="max-w-md px-4 py-4">
                <div className="font-medium text-white/90">{opp.question}</div>
                <div className="mt-1.5">
                  <ConfidenceBadge score={opp.matchScore} />
                </div>
                <div className="mt-1 text-xs text-white/40">
                  Kalshi: {opp.kalshi.title}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  {opp.legs.map((leg, i) => (
                    <LegPill key={i} {...leg} />
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 tabular-nums text-white/80">
                ${opp.cost.toFixed(3)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60">
                {formatDate(opp.endDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
