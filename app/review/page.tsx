import { ReviewQueue, type ReviewItem } from "@/components/terminal/ReviewQueue";
import { dbEnabled, getReviews } from "@/lib/db";
import { opportunityKey } from "@/lib/history";
import { scanOpportunities } from "@/lib/scan";
import { assessMatch } from "@/lib/trust";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITEMS = 150;

export default async function ReviewPage() {
  const [result, reviews] = await Promise.all([scanOpportunities(), getReviews()]);
  const storeKind = dbEnabled() ? "supabase" : "disabled";

  const items: ReviewItem[] = result.opportunities.map((o) => {
    const pairId = opportunityKey(o);
    const assessment = assessMatch({
      marketA: o.marketA,
      marketB: o.marketB,
      netMargin: o.netMargin,
      matchScore: o.matchScore,
    });
    return {
      pairId,
      question: o.question,
      venues: o.venues,
      confidence: o.matchScore,
      netMarginPct: o.netMarginPct,
      marketA: { venue: o.marketA.venue, title: o.marketA.title, url: o.marketA.url },
      marketB: { venue: o.marketB.venue, title: o.marketB.title, url: o.marketB.url },
      confidenceReasons: assessment.supportReasons,
      concernReasons: assessment.concernReasons,
      status: reviews[pairId]?.status ?? null,
    };
  });

  // Surface the most questionable, still-undecided matches first.
  items.sort((a, b) => {
    const aDecided = a.status === null ? 0 : 1;
    const bDecided = b.status === null ? 0 : 1;
    if (aDecided !== bDecided) return aDecided - bDecided;
    return a.confidence - b.confidence;
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Match Review</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          Curate a trusted dataset of market pairings. Lowest-confidence,
          undecided matches are shown first. Decisions persist and feed back into
          which matches you trust.
        </p>
      </header>
      <ReviewQueue initialItems={items.slice(0, MAX_ITEMS)} storeKind={storeKind} />
    </main>
  );
}
