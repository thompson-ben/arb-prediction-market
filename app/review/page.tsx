import { ReviewQueue, type ReviewItem } from "@/components/terminal/ReviewQueue";
import { opportunityKey } from "@/lib/history";
import { confidenceReasons, concernReasons } from "@/lib/reasons";
import { scanOpportunities } from "@/lib/scan";
import { getStore, KEYS } from "@/lib/store";
import type { ReviewDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 150;

export default async function ReviewPage() {
  const result = await scanOpportunities();
  const store = getStore();
  const reviews =
    (await store.getJSON<Record<string, ReviewDecision>>(KEYS.reviews)) ?? {};

  const items: ReviewItem[] = result.opportunities.map((o) => {
    const pairId = opportunityKey(o);
    return {
      pairId,
      question: o.question,
      venues: o.venues,
      confidence: o.matchScore,
      netMarginPct: o.netMarginPct,
      marketA: { venue: o.marketA.venue, title: o.marketA.title, url: o.marketA.url },
      marketB: { venue: o.marketB.venue, title: o.marketB.title, url: o.marketB.url },
      confidenceReasons: confidenceReasons(o.marketA, o.marketB),
      concernReasons: concernReasons(o.marketA, o.marketB, o.netMargin),
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
      <ReviewQueue initialItems={items.slice(0, MAX_ITEMS)} storeKind={store.kind} />
    </main>
  );
}
