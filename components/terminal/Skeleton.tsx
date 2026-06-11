/** Loading skeletons for the terminal (used by app/loading.tsx). */

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-6 w-48" />
          <Shimmer className="h-3 w-72" />
        </div>
        <Shimmer className="h-8 w-24" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-full" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="border-b border-white/10 bg-white/[0.03] px-3 py-3">
            <Shimmer className="h-3 w-40" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-white/5 px-3 py-4">
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
