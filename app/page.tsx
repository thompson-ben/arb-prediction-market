import { Dashboard } from "@/components/terminal/Dashboard";
import { scanOpportunities } from "@/lib/scan";

// Always run the scan fresh on request (upstream fetches are cached separately).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Home() {
  try {
    const data = await scanOpportunities();
    return <Dashboard data={data} />;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <div className="font-semibold">Failed to scan markets</div>
          <div className="mt-1 text-sm text-rose-200/70">{message}</div>
        </div>
      </main>
    );
  }
}
