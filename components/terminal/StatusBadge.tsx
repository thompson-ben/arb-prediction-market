import type { OpportunityStatus } from "@/lib/types";

const STYLES: Record<OpportunityStatus, { label: string; cls: string; dot: string }> = {
  VERIFIED: {
    label: "VERIFIED",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  REVIEW_REQUIRED: {
    label: "REVIEW REQUIRED",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  HIGH_RISK: {
    label: "HIGH RISK",
    cls: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
  },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: OpportunityStatus;
  size?: "sm" | "xs";
}) {
  const s = STYLES[status];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium tracking-wide ${pad} ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
