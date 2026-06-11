"use client";

import { useEffect, useState } from "react";
import { ExecutionCalculator } from "@/components/terminal/ExecutionCalculator";
import { MatchAnalysis } from "@/components/terminal/MatchAnalysis";
import { Tradeability } from "@/components/terminal/Tradeability";
import { TrustBadge } from "@/components/terminal/TrustBadge";
import { cents, formatDate, pct, relativeExpiry } from "@/lib/format";
import { track } from "@/lib/track";
import { assessMatch } from "@/lib/trust";
import type { ArbLeg, ExecutablePricing, NormalizedMarket, Opportunity, Side } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

/** Market backing a given leg side (the one whose venue matches the leg). */
function marketForSide(o: Opportunity, side: Side): NormalizedMarket {
  const leg = o.legs.find((l) => l.side === side) ?? o.legs[0];
  return [o.marketA, o.marketB].find((m) => m.venue === leg.venue) ?? o.marketA;
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/45">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/50">
          {step}
        </span>
        {title}
      </div>
      {children}
    </section>
  );
}

function LegPill({ leg, opportunityId }: { leg: ArbLeg; opportunityId: string }) {
  const sideColor = leg.side === "YES" ? "text-emerald-300" : "text-rose-300";
  return (
    <a
      href={leg.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("venue_click", { opportunityId, venue: leg.venue })}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm hover:bg-white/10"
    >
      <span className="text-white/55">{venueLabel(leg.venue)}</span>
      <span className={`font-semibold ${sideColor}`}>{leg.side}</span>
      <span className="font-mono tabular-nums text-white/80">{cents(leg.price)}</span>
    </a>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" }) {
  const color = tone === "good" ? "bg-emerald-400" : "bg-rose-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-mono tabular-nums text-white/70">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export function DetailPanel({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
}) {
  const [pricing, setPricing] = useState<ExecutablePricing | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!opportunity) return;
    let cancelled = false;
    track("expanded", { opportunityId: opportunity.id });
    const yesMarket = marketForSide(opportunity, "YES");
    const noMarket = marketForSide(opportunity, "NO");
    const payload = {
      indicativeMargin: opportunity.netMargin,
      yes: { venue: yesMarket.venue, marketId: yesMarket.id, clobTokenId: yesMarket.clobTokenIds?.[0] },
      no: { venue: noMarket.venue, marketId: noMarket.id, clobTokenId: noMarket.clobTokenIds?.[1] },
    };
    setPricing(null);
    setLoading(true);
    fetch("/api/executable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data: ExecutablePricing) => {
        if (!cancelled) setPricing(data);
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opportunity]);

  if (!opportunity) return null;
  const o = opportunity;
  const assessment = assessMatch({
    marketA: o.marketA,
    marketB: o.marketB,
    netMargin: o.netMargin,
    matchScore: o.matchScore,
  });

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0a0e17] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0a0e17] px-5 py-3">
          <div className="min-w-0">
            <div className="text-xs text-white/40">
              {o.category} · {venueLabel(o.venues[0])} ↔ {venueLabel(o.venues[1])}
            </div>
            <h2 className="mt-0.5 truncate text-sm font-medium text-white/90" title={o.question}>
              {o.question}
            </h2>
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

        <div className="space-y-6 px-5 py-5">
          {/* Trust score — most prominent (Priority 3) */}
          <TrustBadge status={o.status} />

          {/* Plain-English summary (Priority 5) */}
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-white/75">
            {assessment.summary}
          </p>

          {/* 1 — Match Analysis (Priority 2) */}
          <Section step={1} title="Match Analysis">
            <MatchAnalysis assessment={assessment} marketA={o.marketA} marketB={o.marketB} />
          </Section>

          {/* 2 — Confidence Assessment */}
          <Section step={2} title="Confidence Assessment">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <Bar label="Match confidence" value={o.matchScore * 100} tone="good" />
              <Bar label="Suspicion score" value={assessment.suspicionScore} tone="bad" />
              <p className="text-xs leading-relaxed text-white/50">
                {assessment.suspicionScore >= 60
                  ? "Multiple signals suggest these markets may not be equivalent."
                  : assessment.suspicionScore >= 25
                    ? "Some differences detected — worth a manual check."
                    : "Few warning signals; the markets look consistent."}
              </p>
            </div>
          </Section>

          {/* 3 — Arbitrage Summary */}
          <Section step={3} title="Arbitrage Summary">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap gap-2">
                {o.legs.map((leg, i) => (
                  <LegPill key={i} leg={leg} opportunityId={o.id} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-mono text-base font-semibold tabular-nums text-emerald-300">
                    {pct(o.netMargin)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">net</div>
                </div>
                <div>
                  <div className="font-mono text-base font-semibold tabular-nums text-white/70">
                    {pct(o.grossMargin)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">gross</div>
                </div>
                <div>
                  <div className="font-mono text-base font-semibold tabular-nums text-white/70">
                    ${o.cost.toFixed(3)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">cost/$1</div>
                </div>
              </div>
              <div className="text-xs text-white/45">
                Resolves {formatDate(o.endDate)}{" "}
                <span className="text-white/30">({relativeExpiry(o.endDate)})</span>
              </div>
            </div>
          </Section>

          {/* 4 — Tradeability (Priority 6) */}
          <Section step={4} title="Tradeability">
            <Tradeability opportunity={o} pricing={pricing} loading={loading} />
          </Section>

          {/* 5 — Profit Calculator (with disclaimers, Priority 7) */}
          <Section step={5} title="Profit Calculator">
            <ExecutionCalculator
              opportunity={o}
              executableAvailable={pricing?.available}
              loading={loading}
            />
          </Section>
        </div>
      </aside>
    </div>
  );
}
