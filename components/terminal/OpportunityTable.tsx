"use client";

import { ScoreBar } from "@/components/terminal/ScoreBar";
import { StatusBadge } from "@/components/terminal/StatusBadge";
import { cents, compactMoney, pct, relativeExpiry } from "@/lib/format";
import { track } from "@/lib/track";
import type { ArbLeg, Opportunity } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

function LegPill({ leg }: { leg: ArbLeg }) {
  const sideColor = leg.side === "YES" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs">
      <span className="text-white/50">{venueLabel(leg.venue)}</span>
      <span className={`font-semibold ${sideColor}`}>{leg.side}</span>
      <span className="font-mono tabular-nums text-white/70">{cents(leg.price)}</span>
    </div>
  );
}

export function OpportunityTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Opportunity[];
  selectedId: string | null;
  onSelect: (o: Opportunity) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#0c111b] text-[11px] uppercase tracking-wider text-white/40">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2.5 font-medium">Score</th>
            <th className="px-3 py-2.5 font-medium">Market</th>
            <th className="px-3 py-2.5 font-medium text-right">Net / Gross</th>
            <th className="px-3 py-2.5 font-medium">Legs</th>
            <th className="px-3 py-2.5 font-medium text-right">Liquidity</th>
            <th className="px-3 py-2.5 font-medium text-right">Expiry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const selected = o.id === selectedId;
            return (
              <tr
                key={o.id}
                onClick={() => {
                  track("viewed", { opportunityId: o.id });
                  onSelect(o);
                }}
                className={`cursor-pointer border-b border-white/5 transition ${
                  selected ? "bg-emerald-500/[0.07]" : "hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-3 py-3 align-top">
                  <ScoreBar score={o.score} />
                </td>
                <td className="max-w-sm px-3 py-3 align-top">
                  <div className="truncate font-medium text-white/90" title={o.question}>
                    {o.question}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/45">
                      {o.category}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {venueLabel(o.venues[0])} ↔ {venueLabel(o.venues[1])}
                    </span>
                    <StatusBadge status={o.status} size="xs" />
                  </div>
                </td>
                <td className="px-3 py-3 text-right align-top">
                  <div className="font-mono text-base font-semibold tabular-nums text-emerald-300">
                    {pct(o.netMargin)}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-white/40">
                    {pct(o.grossMargin)} gross
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1">
                    {o.legs.map((leg, i) => (
                      <LegPill key={i} leg={leg} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right align-top font-mono tabular-nums text-white/70">
                  {compactMoney(o.liquidity)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right align-top text-white/60">
                  {relativeExpiry(o.endDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
