import { isAuthorizedRequest } from "@/lib/admin";
import { toCSV } from "@/lib/csv";
import {
  dbEnabled,
  getCategoryAnalytics,
  getOpportunities,
  getReviews,
  getSnapshots,
  getVenueAnalytics,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/export?type=snapshots|history|reviews|venues|categories[&key=ADMIN_TOKEN]
 * Returns a downloadable CSV for offline analysis (Excel / Power BI / Python).
 */
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!dbEnabled()) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "history";
  let csv: string;
  let filename: string;

  switch (type) {
    case "snapshots": {
      const rows = await getSnapshots(50000);
      csv = toCSV(rows, [
        { key: "scan_at", label: "Scan At" },
        { key: "opportunity_id", label: "Opportunity ID" },
        { key: "venue_pair", label: "Venue Pair" },
        { key: "category", label: "Category" },
        { key: "match_confidence", label: "Match Confidence" },
        { key: "suspicion_score", label: "Suspicion" },
        { key: "trust_status", label: "Trust" },
        { key: "gross_margin", label: "Gross Margin" },
        { key: "net_margin", label: "Net Margin" },
        { key: "executable_margin", label: "Executable Margin" },
        { key: "liquidity", label: "Liquidity" },
        { key: "max_executable_stake", label: "Max Executable Stake" },
        { key: "resolution_date", label: "Resolution Date" },
      ]);
      filename = "opportunity-snapshots.csv";
      break;
    }
    case "history": {
      const rows = await getOpportunities(50000);
      csv = toCSV(rows, [
        { key: "opportunity_id", label: "Opportunity ID" },
        { key: "question", label: "Question" },
        { key: "category", label: "Category" },
        { key: "venue_pair", label: "Venue Pair" },
        { key: "appearances", label: "Appearances" },
        { key: "first_seen", label: "First Seen" },
        { key: "last_seen", label: "Last Seen" },
        { key: "duration_seconds", label: "Duration (s)" },
        { key: "peak_margin", label: "Peak Margin" },
        { key: "avg_margin", label: "Avg Margin" },
        { key: "lowest_margin", label: "Lowest Margin" },
        { key: "peak_executable_margin", label: "Peak Exec Margin" },
        { key: "avg_executable_margin", label: "Avg Exec Margin" },
        { key: "peak_executable_stake", label: "Peak Exec Stake" },
        { key: "avg_executable_stake", label: "Avg Exec Stake" },
        { key: "median_executable_stake", label: "Median Exec Stake" },
        { key: "margin_decay_rate_per_hour", label: "Margin Decay/h" },
      ]);
      filename = "opportunity-history.csv";
      break;
    }
    case "reviews": {
      const rows = Object.values(await getReviews());
      csv = toCSV(rows, [
        { key: "opportunity_id", label: "Opportunity ID" },
        { key: "status", label: "Status" },
        { key: "note", label: "Note" },
        { key: "updated_at", label: "Updated At" },
      ]);
      filename = "match-reviews.csv";
      break;
    }
    case "venues": {
      const rows = await getVenueAnalytics();
      csv = toCSV(rows, [
        { key: "venue_pair", label: "Venue Pair" },
        { key: "opportunities", label: "Opportunities" },
        { key: "executable_opportunities", label: "Executable" },
        { key: "avg_margin", label: "Avg Margin" },
        { key: "avg_executable_margin", label: "Avg Exec Margin" },
        { key: "avg_duration_hours", label: "Avg Duration (h)" },
        { key: "avg_executable_stake", label: "Avg Exec Stake" },
        { key: "largest_margin", label: "Largest Margin" },
      ]);
      filename = "venue-analytics.csv";
      break;
    }
    case "categories": {
      const rows = await getCategoryAnalytics();
      csv = toCSV(rows, [
        { key: "category", label: "Category" },
        { key: "opportunities", label: "Opportunities" },
        { key: "executable_opportunities", label: "Executable" },
        { key: "avg_margin", label: "Avg Margin" },
        { key: "avg_duration_hours", label: "Avg Duration (h)" },
        { key: "avg_executable_stake", label: "Avg Exec Stake" },
        { key: "approval_rate", label: "Approval Rate" },
      ]);
      filename = "category-analytics.csv";
      break;
    }
    default:
      return new Response("unknown export type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
