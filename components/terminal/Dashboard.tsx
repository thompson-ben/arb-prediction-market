"use client";

import { useMemo, useState } from "react";
import { DetailPanel } from "@/components/terminal/DetailPanel";
import { EmptyState } from "@/components/terminal/EmptyState";
import { Filters } from "@/components/terminal/Filters";
import { OpportunityTable } from "@/components/terminal/OpportunityTable";
import { SummaryCards, type SummaryStats } from "@/components/terminal/SummaryCards";
import { RefreshButton } from "@/components/RefreshButton";
import { applyFilters, defaultFilters, type FilterState } from "@/lib/filters";
import type { ScanResult, Venue } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

function VenueStatus({ data }: { data: ScanResult }) {
  const venues: Venue[] = ["polymarket", "kalshi", "predictit"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40">
      {venues.map((v) => {
        const count = data.counts[v] ?? 0;
        const errored = v in data.errors;
        return (
          <span key={v} className="inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                errored ? "bg-rose-400" : count > 0 ? "bg-emerald-400" : "bg-white/30"
              }`}
            />
            {venueLabel(v)}
            <span className="font-mono tabular-nums text-white/30">{count}</span>
          </span>
        );
      })}
    </div>
  );
}

export function Dashboard({ data }: { data: ScanResult }) {
  const [filters, setFilters] = useState<FilterState>(() =>
    defaultFilters(data.config.minMargin, data.config.matchThreshold),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const result = useMemo(() => applyFilters(data.opportunities, filters), [data, filters]);

  const stats: SummaryStats = useMemo(() => {
    const matched = result.fallback ? [] : result.rows;
    const margins = matched.map((o) => o.netMargin);
    return {
      opportunitiesFound: result.fallback ? 0 : result.matchedCount,
      bestMargin: margins.length ? Math.max(...margins) : null,
      averageMargin: margins.length
        ? margins.reduce((a, b) => a + b, 0) / margins.length
        : null,
      marketsScanned: data.marketsScanned,
      venuesScanned: data.venuesScanned,
    };
  }, [result, data]);

  const selected = useMemo(
    () => data.opportunities.find((o) => o.id === selectedId) ?? null,
    [data, selectedId],
  );

  const hasOutage = Object.keys(data.errors).length > 0;
  const reset = () =>
    setFilters(defaultFilters(data.config.minMargin, data.config.matchThreshold));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight text-white">
            ARB<span className="text-emerald-400">·</span>TERMINAL
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Cross-venue prediction-market arbitrage · Polymarket · Kalshi · PredictIt
          </p>
          <div className="mt-2">
            <VenueStatus data={data} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RefreshButton />
          <span className="text-[11px] text-white/30">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        </div>
      </header>

      {hasOutage && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
          Partial results — couldn&apos;t reach:{" "}
          {(Object.keys(data.errors) as Venue[]).map((v) => venueLabel(v)).join(", ")}.
        </div>
      )}

      <div className="mb-6">
        <SummaryCards stats={stats} />
      </div>

      {data.opportunities.length === 0 ? (
        <EmptyState hasOutage={hasOutage} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* Sticky sidebar on desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <Filters filters={filters} onChange={setFilters} onReset={reset} />
            </div>
          </aside>

          {/* Mobile filter toggle */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80"
            >
              {mobileFiltersOpen ? "Hide filters" : "Show filters"}
            </button>
            {mobileFiltersOpen && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <Filters filters={filters} onChange={setFilters} onReset={reset} />
              </div>
            )}
          </div>

          <section className="min-w-0">
            {result.fallback && (
              <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/55">
                No opportunities match your filters — showing the top{" "}
                {result.rows.length} by score.
              </div>
            )}
            <OpportunityTable
              rows={result.rows}
              selectedId={selectedId}
              onSelect={(o) => setSelectedId(o.id)}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-white/30">
              Indicative quotes, not guaranteed fills. Net margin subtracts
              estimated trading/profit fees; matches are automated — verify
              resolution terms before trading.
            </p>
          </section>
        </div>
      )}

      <DetailPanel opportunity={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}
