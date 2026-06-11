"use client";

import { useState } from "react";
import { money, pct } from "@/lib/format";
import type { Opportunity } from "@/lib/types";
import { VENUES, venueLabel } from "@/lib/venues";

/** Cash to buy one share on a leg, including the venue's trading fee. */
function legCash(venue: Opportunity["legs"][number]["venue"], price: number): number {
  return price + VENUES[venue].tradingFee(price);
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Execution calculator. A "pair" is one share on each leg, which guarantees a
 * \$1 payout. Given a target capital, we deploy whole-dollar fractional pairs
 * and show allocation, guaranteed (worst-case) net profit, and net ROI — all
 * live as the stake changes.
 *
 * Profit figures are gated behind trust disclaimers (Phase 4, Priority 7): low
 * confidence or missing executable pricing makes these estimates unreliable.
 */
export function ExecutionCalculator({
  opportunity,
  executableAvailable,
  loading,
}: {
  opportunity: Opportunity;
  executableAvailable?: boolean;
  loading?: boolean;
}) {
  const [stake, setStake] = useState(1000);

  const confidence = opportunity.matchScore;
  // Priority 7 disclaimers, strongest first.
  const mismatch = confidence < 0.7;
  const indicativeOnly =
    !mismatch && (confidence < 0.85 || (!loading && executableAvailable === false));

  const costPerPair = opportunity.cost; // YES cash + NO cash (incl. trading fees)
  const pairs = costPerPair > 0 ? stake / costPerPair : 0;

  const [legA, legB] = opportunity.legs;
  const allocA = pairs * legCash(legA.venue, legA.price);
  const allocB = pairs * legCash(legB.venue, legB.price);
  const totalCapital = allocA + allocB;

  const netProfit = pairs * opportunity.netMargin;
  const netRoi = costPerPair > 0 ? opportunity.netMargin / costPerPair : 0;

  return (
    <div className="space-y-3">
      {mismatch && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Potential market mismatch detected. Profit estimates may be invalid.
        </div>
      )}
      {indicativeOnly && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Profit estimates are based on indicative pricing and may not be
          achievable in practice.
        </div>
      )}

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
          Stake (total capital)
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-3">
          <span className="text-white/40">$</span>
          <input
            type="number"
            min={0}
            step={100}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
            className="w-full bg-transparent px-2 py-2 font-mono text-white outline-none tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {venueLabel(legA.venue)} {legA.side}
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
            {money(allocA)}
          </div>
          <div className="text-[10px] text-white/40">{pairs.toFixed(0)} shares</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {venueLabel(legB.venue)} {legB.side}
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
            {money(allocB)}
          </div>
          <div className="text-[10px] text-white/40">{pairs.toFixed(0)} shares</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Capital" value={money(totalCapital)} />
        <Stat
          label="Net profit"
          value={money(netProfit)}
          accent={netProfit >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <Stat
          label="Net ROI"
          value={pct(netRoi)}
          accent={netRoi >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-white/30">
        Profit is the guaranteed worst-case after trading and profit fees,
        assuming both legs fill at the quoted prices. It does not account for
        slippage, order-book depth, or position caps.
      </p>
    </div>
  );
}
