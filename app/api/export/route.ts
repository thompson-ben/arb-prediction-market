import { dailyMetrics, venuePairAnalytics, type AnalyticsSnapshot } from "@/lib/analytics";
import { isAuthorizedRequest } from "@/lib/admin";
import { toCSV } from "@/lib/csv";
import { getStore, KEYS } from "@/lib/store";
import type { OpportunityHistory, ReviewDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

const HOUR = 1000 * 60 * 60;

/**
 * GET /api/export?type=history|validation|venues[&key=ADMIN_TOKEN]
 * Returns a downloadable CSV for offline analysis (Priority 5).
 */
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return new Response("unauthorized", { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "history";
  const store = getStore();

  let csv: string;
  let filename: string;

  if (type === "history") {
    const history =
      (await store.getJSON<Record<string, OpportunityHistory>>(KEYS.history)) ?? {};
    const rows = Object.values(history).map((r) => ({
      ...r,
      venues: r.venues.join(" | "),
      durationHours: (
        (new Date(r.lastSeen).getTime() - new Date(r.firstSeen).getTime()) / HOUR
      ).toFixed(2),
    }));
    csv = toCSV(rows, [
      { key: "question", label: "Question" },
      { key: "category", label: "Category" },
      { key: "venues", label: "Venues" },
      { key: "firstSeen", label: "First Seen" },
      { key: "lastSeen", label: "Last Seen" },
      { key: "peakMargin", label: "Peak Margin" },
      { key: "lastMargin", label: "Last Margin" },
      { key: "appearances", label: "Appearances" },
      { key: "durationHours", label: "Duration (h)" },
    ]);
    filename = "opportunity-history.csv";
  } else if (type === "validation") {
    const snapshots = (await store.getJSON<AnalyticsSnapshot[]>(KEYS.analytics)) ?? [];
    const reviews =
      (await store.getJSON<Record<string, ReviewDecision>>(KEYS.reviews)) ?? {};
    const rows = dailyMetrics(snapshots, reviews).map((d) => ({
      ...d,
      marketsByVenue: undefined,
    }));
    csv = toCSV(rows, [
      { key: "date", label: "Date" },
      { key: "scans", label: "Scans" },
      { key: "marketsScanned", label: "Markets Scanned (avg/scan)" },
      { key: "matchesGenerated", label: "Matches Generated (avg/scan)" },
      { key: "matchesApproved", label: "Matches Approved" },
      { key: "matchesRejected", label: "Matches Rejected" },
      { key: "opportunitiesDetected", label: "Opportunities Detected (avg/scan)" },
      { key: "opportunitiesAboveThreshold", label: "Above Threshold (avg/scan)" },
      { key: "executableOpportunities", label: "Executable (avg/scan)" },
      { key: "averageMargin", label: "Avg Margin" },
      { key: "averageExecutableMargin", label: "Avg Executable Margin" },
      { key: "largestMargin", label: "Largest Margin" },
      { key: "largestExecutableMargin", label: "Largest Executable Margin" },
    ]);
    filename = "validation-statistics.csv";
  } else if (type === "venues") {
    const snapshots = (await store.getJSON<AnalyticsSnapshot[]>(KEYS.analytics)) ?? [];
    const history =
      (await store.getJSON<Record<string, OpportunityHistory>>(KEYS.history)) ?? {};
    const rows = venuePairAnalytics(history, snapshots);
    csv = toCSV(rows, [
      { key: "pair", label: "Venue Pair" },
      { key: "opportunities", label: "Opportunities" },
      { key: "averageMargin", label: "Avg Margin" },
      { key: "averageExecutableMargin", label: "Avg Executable Margin" },
      { key: "averageDurationHours", label: "Avg Duration (h)" },
      { key: "largestMargin", label: "Largest Margin" },
    ]);
    filename = "venue-analytics.csv";
  } else {
    return new Response("unknown export type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
