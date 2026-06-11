export function EmptyState({ hasOutage }: { hasOutage: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl">
        ◎
      </div>
      <h3 className="mt-4 text-base font-semibold text-white/80">
        No arbitrage opportunities right now
      </h3>
      <p className="mt-1 max-w-sm text-sm text-white/45">
        {hasOutage
          ? "One or more venues couldn't be reached, so cross-venue matches may be incomplete. Try refreshing in a moment."
          : "The scan completed but found no cross-venue matches with a positive edge. Markets move constantly — refresh to scan again."}
      </p>
    </div>
  );
}
