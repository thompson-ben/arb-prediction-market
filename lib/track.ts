/** Fire-and-forget client-side event tracking (Priority 8). Never throws. */
export function track(
  eventType: "viewed" | "expanded" | "venue_click",
  payload: { opportunityId?: string; venue?: string; metadata?: Record<string, unknown> } = {},
): void {
  try {
    const body = JSON.stringify({ eventType, ...payload });
    // Prefer sendBeacon so navigation (venue link clicks) doesn't cancel it.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* tracking must never affect UX */
  }
}
