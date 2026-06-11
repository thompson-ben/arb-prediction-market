"use client";

import { useEffect } from "react";
import { ExecutionCalculator } from "@/components/terminal/ExecutionCalculator";
import { StatusBadge } from "@/components/terminal/StatusBadge";
import { cents, compactMoney, formatDate, pct, relativeExpiry } from "@/lib/format";
import type { ArbLeg, NormalizedMarket, Opportunity } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function VenueCard({ market, leg }: { market: NormalizedMarket; leg: ArbLeg }) {
  const sideColor = leg.side === "YES" ? "text-emerald-300" : "text-rose-300";
  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          {venueLabel(market.venue)}
        </span>
        <span className="text-xs text-white/40">Open ↗</span>
      </div>
      <div className="mt-1 text-sm text-white/80">{market.title}</div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span>
          Buy <span className={`font-semibold ${sideColor}`}>{leg.side}</span> @{" "}
          <span className="font-mono tabular-nums text-white/80">{cents(leg.price)}</span>
        </span>
        <span className="text-white/40">Liq {compactMoney(market.liquidity)}</span>
      </div>
    </a>
  );
}

export function DetailPanel({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!opportunity) return null;
  const o = opportunity;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0a0e17] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0a0e17] px-5 py-4">
          <div>
            <StatusBadge status={o.status} />
            <h2 className="mt-2 text-base font-semibold leading-snug text-white">
              {o.question}
            </h2>
            <div className="mt-1 text-xs text-white/40">
              {o.category} · {venueLabel(o.venues[0])} ↔ {venueLabel(o.venues[1])}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Score" value={o.score.toString()} accent="text-emerald-300" />
            <Metric label="Net margin" value={pct(o.netMargin)} accent="text-emerald-300" />
            <Metric label="Gross margin" value={pct(o.grossMargin)} />
            <Metric label="Confidence" value={pct(o.matchScore, 0)} />
            <Metric label="Liquidity" value={compactMoney(o.liquidity)} />
            <Metric label="Cost / $1" value={`$${o.cost.toFixed(3)}`} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/40">
              Resolution
            </div>
            <div className="text-sm text-white/80">
              {formatDate(o.endDate)}{" "}
              <span className="text-white/40">({relativeExpiry(o.endDate)})</span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
              The two legs
            </div>
            <div className="grid gap-2">
              <VenueCard market={o.marketA} leg={legForMarket(o, o.marketA)} />
              <VenueCard market={o.marketB} leg={legForMarket(o, o.marketB)} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
              Execution calculator
            </div>
            <ExecutionCalculator opportunity={o} />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
              Risk notes
            </div>
            <ul className="space-y-1.5">
              {o.riskNotes.map((note, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-white/55">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Find the leg whose venue matches the given market (legs are YES/NO across venues). */
function legForMarket(o: Opportunity, market: NormalizedMarket): ArbLeg {
  return o.legs.find((l) => l.venue === market.venue) ?? o.legs[0];
}
