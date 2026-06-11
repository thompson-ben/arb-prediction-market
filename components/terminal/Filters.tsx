"use client";

import { pct } from "@/lib/format";
import {
  ALL_VENUES,
  type ExpiryWindow,
  type FilterState,
  type SortKey,
} from "@/lib/filters";
import { CATEGORIES, type Category, type Venue } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

const EXPIRY_OPTIONS: { value: ExpiryWindow; label: string }[] = [
  { value: "all", label: "All" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Opportunity score" },
  { value: "netMargin", label: "Net margin" },
  { value: "confidence", label: "Confidence" },
  { value: "expiry", label: "Soonest expiry" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {title}
      </div>
      {children}
    </div>
  );
}

export function Filters({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleVenue = (venue: Venue) => {
    const has = filters.venues.includes(venue);
    const next = has
      ? filters.venues.filter((v) => v !== venue)
      : [...filters.venues, venue];
    set("venues", next.length === 0 ? [...ALL_VENUES] : next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80">Filters</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Reset
        </button>
      </div>

      <Section title={`Min net margin · ${pct(filters.minMargin, 0)}`}>
        <input
          type="range"
          min={0}
          max={0.3}
          step={0.01}
          value={filters.minMargin}
          onChange={(e) => set("minMargin", Number(e.target.value))}
          className="w-full accent-emerald-400"
        />
      </Section>

      <Section title={`Min confidence · ${pct(filters.minConfidence, 0)}`}>
        <input
          type="range"
          min={0.45}
          max={1}
          step={0.05}
          value={filters.minConfidence}
          onChange={(e) => set("minConfidence", Number(e.target.value))}
          className="w-full accent-emerald-400"
        />
      </Section>

      <Section title="Venues">
        <div className="flex flex-wrap gap-1.5">
          {ALL_VENUES.map((v) => {
            const active = filters.venues.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleVenue(v)}
                className={`rounded border px-2 py-1 text-xs transition ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-transparent text-white/40 hover:text-white/70"
                }`}
              >
                {venueLabel(v)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Expiry within">
        <div className="flex gap-1.5">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("expiry", opt.value)}
              className={`flex-1 rounded border px-2 py-1 text-xs transition ${
                filters.expiry === opt.value
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Category">
        <select
          value={filters.category}
          onChange={(e) => set("category", e.target.value as Category | "all")}
          className="w-full rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/80 outline-none focus:border-emerald-500/40"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Sort by">
        <select
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value as SortKey)}
          className="w-full rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white/80 outline-none focus:border-emerald-500/40"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Section>
    </div>
  );
}
