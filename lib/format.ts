/** Shared display formatting (safe on both server and client). */

export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function cents(price: number): string {
  if (!Number.isFinite(price)) return "—";
  return `${(price * 100).toFixed(1)}¢`;
}

export function money(n: number, digits = 2): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Compact dollar amount, e.g. $1.2k, $3.4M. */
export function compactMoney(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Days from now until `iso` (can be fractional/negative), or undefined. */
export function daysUntil(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  return (t - Date.now()) / (1000 * 60 * 60 * 24);
}

/** Human relative expiry, e.g. "3d", "2w", "5mo", or "expired". */
export function relativeExpiry(iso?: string): string {
  const days = daysUntil(iso);
  if (days === undefined) return "—";
  if (days < 0) return "expired";
  if (days < 1) return "<1d";
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}
