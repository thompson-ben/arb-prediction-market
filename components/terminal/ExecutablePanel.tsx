"use client";

import { useEffect, useState } from "react";
import { compactMoney, pct } from "@/lib/format";
import type { ExecutablePricing, NormalizedMarket, Opportunity, Side } from "@/lib/types";

/** Market backing a given leg side (the one whose venue matches the leg). */
function marketForSide(o: Opportunity, side: Side): NormalizedMarket {
  const leg = o.legs.find((l) => l.side === side) ?? o.legs[0];
  return [o.marketA, o.marketB].find((m) => m.venue === leg.venue) ?? o.marketA;
}

function Column({
  title,
  margin,
  sub,
  muted,
}: {
  title: string;
  margin: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{title}</div>
      <div
        className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
          muted ? "text-white/50" : "text-emerald-300"
        }`}
      >
        {margin}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

/**
 * Step 6 — fetches order-book pricing on demand and shows Indicative vs
 * Executable margin side-by-side. Degrades gracefully when books are
 * unavailable (e.g. PredictIt has no public book).
 */
export function ExecutablePanel({ opportunity }: { opportunity: Opportunity }) {
  const [pricing, setPricing] = useState<ExecutablePricing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const yesMarket = marketForSide(opportunity, "YES");
    const noMarket = marketForSide(opportunity, "NO");
    const payload = {
      indicativeMargin: opportunity.netMargin,
      yes: {
        venue: yesMarket.venue,
        marketId: yesMarket.id,
        clobTokenId: yesMarket.clobTokenIds?.[0],
      },
      no: {
        venue: noMarket.venue,
        marketId: noMarket.id,
        clobTokenId: noMarket.clobTokenIds?.[1],
      },
    };

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

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Column title="Indicative margin" margin={pct(opportunity.netMargin)} sub="single quote" />
        <Column
          title="Executable margin"
          margin={
            loading
              ? "…"
              : pricing?.executableMargin != null
                ? pct(pricing.executableMargin)
                : "n/a"
          }
          sub={
            loading
              ? "fetching books"
              : pricing?.maxStake != null
                ? `max ${compactMoney(pricing.maxStake)}`
                : undefined
          }
          muted={!loading && pricing?.executableMargin == null}
        />
      </div>
      {!loading && pricing && !pricing.available && (
        <p className="text-[11px] leading-relaxed text-white/35">
          {pricing.note ??
            "Executable pricing unavailable for this pair."}{" "}
          Order books require live endpoints (Polymarket CLOB / Kalshi); PredictIt
          has no public book.
        </p>
      )}
      {!loading && pricing?.available && pricing.maxSize != null && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Walking live depth, ~{Math.round(pricing.maxSize)} share-pairs fill
          before the edge closes.
        </p>
      )}
    </div>
  );
}
