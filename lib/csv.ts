/** Minimal, dependency-free CSV serialization. */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : String(value);
  // Quote when the value contains a comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize an array of records to CSV. `columns` fixes the order and headers
 * (key = field, label = header text).
 */
export function toCSV<T>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(","),
  );
  return [header, ...lines].join("\n");
}
