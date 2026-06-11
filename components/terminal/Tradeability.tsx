import { compactMoney, pct } from "@/lib/format";
import { liquidityTier } from "@/lib/trust";
import type { ExecutablePricing, Opportunity } from "@/lib/types";

type Tone = "good" | "warn" | "bad" | "muted";

const TONE: Record<Tone, string> = {
  good: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
  muted: "text-white/50",
};

function Row({ label, value, tone, sub }: { label: string; value: string; tone: Tone; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-right">
        <span className={`font-mono text-sm font-semibold ${TONE[tone]}`}>{value}</span>
        {sub && <span className="ml-2 text-[11px] text-white/40">{sub}</span>}
      </span>
    </div>
  );
}

/**
 * Tradeability — can this realistically be traded? Appears before the profit
 * calculator (Priority 6). Reflects live order-book pricing when available.
 */
export function Tradeability({
  opportunity,
  pricing,
  loading,
}: {
  opportunity: Opportunity;
  pricing: ExecutablePricing | null;
  loading: boolean;
}) {
  const tier = liquidityTier(opportunity.liquidity);
  const liqTone: Tone = tier === "High" ? "good" : tier === "Medium" ? "warn" : "bad";

  const bookAvailable = pricing?.available ?? false;
  const execKnown = pricing?.executableMargin != null;
  const stakeKnown = pricing?.maxStake != null;

  return (
    <div className="space-y-2">
      <Row
        label="Liquidity"
        value={tier}
        tone={liqTone}
        sub={compactMoney(opportunity.liquidity)}
      />
      <Row
        label="Order Book"
        value={loading ? "Checking…" : bookAvailable ? "Available" : "Unavailable"}
        tone={loading ? "muted" : bookAvailable ? "good" : "bad"}
      />
      <Row
        label="Executable Margin"
        value={
          loading ? "…" : execKnown ? `Known · ${pct(pricing!.executableMargin!)}` : "Unknown"
        }
        tone={loading ? "muted" : execKnown ? "good" : "warn"}
      />
      <Row
        label="Max Executable Stake"
        value={
          loading ? "…" : stakeKnown ? `Known · ${compactMoney(pricing!.maxStake!)}` : "Unknown"
        }
        tone={loading ? "muted" : stakeKnown ? "good" : "warn"}
      />

      {/* Indicative vs executable, side-by-side. */}
      <div className="mt-2 flex gap-2">
        <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Indicative margin</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white/70">
            {pct(opportunity.netMargin)}
          </div>
          <div className="text-[10px] text-white/40">single quote</div>
        </div>
        <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Executable margin</div>
          <div
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              execKnown ? "text-emerald-300" : "text-white/40"
            }`}
          >
            {loading ? "…" : execKnown ? pct(pricing!.executableMargin!) : "n/a"}
          </div>
          <div className="text-[10px] text-white/40">
            {execKnown && pricing!.maxSize != null
              ? `~${Math.round(pricing!.maxSize)} pairs`
              : "live order book"}
          </div>
        </div>
      </div>

      {!loading && pricing && !pricing.available && (
        <p className="text-[11px] leading-relaxed text-white/35">
          {pricing.note ?? "Executable pricing unavailable."} Order books require
          live venue endpoints (Polymarket CLOB / Kalshi); PredictIt has no public
          book.
        </p>
      )}
    </div>
  );
}
