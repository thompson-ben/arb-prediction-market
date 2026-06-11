/** Compact 0–100 actionability score with a colored bar. */
export function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-400"
      : score >= 45
        ? "bg-amber-400"
        : "bg-rose-400";
  const text =
    score >= 70 ? "text-emerald-300" : score >= 45 ? "text-amber-300" : "text-rose-300";

  return (
    <div className="flex items-center gap-2">
      <span className={`w-7 text-right font-mono text-sm font-semibold tabular-nums ${text}`}>
        {score}
      </span>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
