import { OpportunityTable } from "@/components/OpportunityTable";
import { RefreshButton } from "@/components/RefreshButton";
import { scanOpportunities } from "@/lib/scan";
import type { Venue } from "@/lib/types";
import { venueLabel } from "@/lib/venues";

// Always run the scan fresh on request (upstream fetches are cached separately).
export const dynamic = "force-dynamic";

export default async function Home() {
  let result: Awaited<ReturnType<typeof scanOpportunities>> | null = null;
  let error: string | null = null;

  try {
    result = await scanOpportunities();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const venueErrors = result
    ? (Object.entries(result.errors) as [Venue, string][])
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Prediction Market Arbitrage
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Cross-venue opportunities between Polymarket and Kalshi, margin ≥{" "}
            {result ? (result.config.minMargin * 100).toFixed(0) : "5"}%.
          </p>
        </div>
        <RefreshButton />
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <div className="font-medium">Failed to scan markets</div>
          <div className="mt-1 text-sm text-rose-200/70">{error}</div>
        </div>
      ) : result ? (
        <>
          {venueErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
              Some venues could not be reached (showing partial results):{" "}
              {venueErrors.map(([v]) => venueLabel(v)).join(", ")}.
            </div>
          )}
          <OpportunityTable opportunities={result.opportunities} />
          <footer className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-white/40">
            <span>{result.opportunities.length} opportunities</span>
            {(Object.entries(result.counts) as [Venue, number][]).map(
              ([venue, count]) => (
                <span key={venue}>
                  {venueLabel(venue)}: {count} markets
                </span>
              ),
            )}
            <span>
              Match threshold: {(result.config.matchThreshold * 100).toFixed(0)}%
            </span>
            <span>
              Updated {new Date(result.generatedAt).toLocaleTimeString()}
            </span>
          </footer>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-white/30">
            Net margin subtracts an estimate of each venue&apos;s trading and
            profit fees (gross is shown beneath it). Prices are indicative quotes
            from each venue&apos;s public API, not guaranteed fills. Matches are
            made automatically by question similarity — always confirm both
            markets resolve on identical terms before trading. Slippage, order-book
            depth, withdrawal fees, and resolution-source differences are not
            modeled.
          </p>
        </>
      ) : null}
    </main>
  );
}
