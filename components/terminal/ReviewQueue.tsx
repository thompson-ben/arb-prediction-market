"use client";

import { useMemo, useState } from "react";
import { venueLabel } from "@/lib/venues";
import type { ReviewStatus, Venue } from "@/lib/types";

export interface ReviewItem {
  pairId: string;
  question: string;
  venues: [Venue, Venue];
  confidence: number;
  netMarginPct: number;
  marketA: { venue: Venue; title: string; url: string };
  marketB: { venue: Venue; title: string; url: string };
  confidenceReasons: string[];
  concernReasons: string[];
  status: ReviewStatus | null;
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: "Approved",
  rejected: "Rejected",
  needs_review: "Needs Review",
};

const STATUS_CLS: Record<ReviewStatus, string> = {
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  needs_review: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

type FilterTab = "all" | "undecided" | ReviewStatus;

export function ReviewQueue({
  initialItems,
  storeKind,
}: {
  initialItems: ReviewItem[];
  storeKind: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("undecided");

  const counts = useMemo(() => {
    const c = { all: items.length, undecided: 0, approved: 0, rejected: 0, needs_review: 0 };
    for (const it of items) {
      if (it.status === null) c.undecided += 1;
      else c[it.status] += 1;
    }
    return c;
  }, [items]);

  const visible = items.filter((it) =>
    tab === "all" ? true : tab === "undecided" ? it.status === null : it.status === tab,
  );

  async function decide(pairId: string, status: ReviewStatus) {
    setPending(pairId);
    const item = items.find((it) => it.pairId === pairId);
    // Optimistic update.
    setItems((prev) => prev.map((it) => (it.pairId === pairId ? { ...it, status } : it)));
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairId,
          status,
          confidence: item?.confidence,
          reasonsSupport: item?.confidenceReasons,
          reasonsConcern: item?.concernReasons,
        }),
      });
    } finally {
      setPending(null);
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "undecided", label: `Undecided (${counts.undecided})` },
    { key: "needs_review", label: `Needs Review (${counts.needs_review})` },
    { key: "approved", label: `Approved (${counts.approved})` },
    { key: "rejected", label: `Rejected (${counts.rejected})` },
    { key: "all", label: `All (${counts.all})` },
  ];

  const ephemeral = storeKind !== "supabase";

  return (
    <div className="space-y-4">
      {ephemeral && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
          Supabase is not configured — review decisions will not persist. Set
          SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded border px-2.5 py-1 text-xs transition ${
              tab === t.key
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 text-white/45 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-white/45">
          Nothing in this queue.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((it) => (
            <div key={it.pairId} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white/90">{it.question}</div>
                  <div className="mt-0.5 text-xs text-white/40">
                    {venueLabel(it.venues[0])} ↔ {venueLabel(it.venues[1])} · confidence{" "}
                    {Math.round(it.confidence * 100)}% · net {it.netMarginPct.toFixed(1)}%
                  </div>
                </div>
                {it.status && (
                  <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_CLS[it.status]}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <a href={it.marketA.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 hover:border-white/20">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    {venueLabel(it.marketA.venue)} (A)
                  </div>
                  <div className="mt-0.5 text-sm text-white/80">{it.marketA.title}</div>
                </a>
                <a href={it.marketB.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 hover:border-white/20">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    {venueLabel(it.marketB.venue)} (B)
                  </div>
                  <div className="mt-0.5 text-sm text-white/80">{it.marketB.title}</div>
                </a>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/70">
                    Reasons for confidence
                  </div>
                  <ul className="mt-1 space-y-1">
                    {it.confidenceReasons.map((r, i) => (
                      <li key={i} className="text-xs text-white/55">+ {r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-rose-300/70">
                    Reasons for concern
                  </div>
                  <ul className="mt-1 space-y-1">
                    {it.concernReasons.map((r, i) => (
                      <li key={i} className="text-xs text-white/55">− {r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {(["approved", "needs_review", "rejected"] as ReviewStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending === it.pairId}
                    onClick={() => decide(it.pairId, s)}
                    className={`rounded border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                      it.status === s
                        ? STATUS_CLS[s]
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
