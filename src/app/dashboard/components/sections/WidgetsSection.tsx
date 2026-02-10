// Async Server Component - fetches data for bottom row widgets with caching
import { getCachedStats } from "../../lib/cachedData";
import ChampionPerformance from "../../widgets/ChampionPerformance";
import WinConditionWidget from "../../widgets/WinConditionWidget";
import NemesisWidget from "../../widgets/NemesisWidget";

type Section = "championPerformance" | "winCondition" | "nemesis";

type Props = {
    puuid: string;
    section: Section;
};

// Skeleton for Suspense fallback
export function WidgetsSkeleton({ height = 200 }: { height?: number }) {
    return (
        <div
            className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 animate-pulse"
            style={{ height: `${height}px` }}
        >
            <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
            <div className="h-20 bg-slate-800 rounded mb-3"></div>
            <div className="h-12 bg-slate-800 rounded"></div>
        </div>
    );
}

// Async Server Component
export async function WidgetsSection({ puuid, section }: Props) {
    // Use cached data fetcher to avoid redundant calls
    const stats = await getCachedStats(puuid);

    if (section === "championPerformance") {
        return <ChampionPerformance stats={stats?.championStats || []} />;
    }

    if (section === "winCondition") {
        return <WinConditionWidget stats={stats?.uniqueStats || null} />;
    }

    if (section === "nemesis") {
        return <NemesisWidget stats={stats?.uniqueStats || null} />;
    }

    return null;
}
