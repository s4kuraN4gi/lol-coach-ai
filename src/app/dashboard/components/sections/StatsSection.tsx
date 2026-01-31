// Async Server Component - fetches stats data for various widgets with caching
import { getCachedStats, getCachedEnhancedData, getCachedRankHistory, getQueueType, getDisplayedRank } from "../../lib/cachedData";
import RankGraph from "../RankGraph";
import RankGoalTracker from "../../widgets/RankGoalTracker";
import QuickStats from "../../widgets/QuickStats";
import NextGameFocus from "../../widgets/NextGameFocus";
import SkillRadar from "../../widgets/SkillRadar";

type Section = "rankGraph" | "rankGoal" | "quickStats" | "nextGameFocus" | "skillRadar";

type Props = {
    puuid: string;
    section: Section;
};

// Skeleton for Suspense fallback
export function StatsSkeleton() {
    return (
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
            <div className="h-24 bg-slate-800 rounded"></div>
        </div>
    );
}

// Async Server Component
export async function StatsSection({ puuid, section }: Props) {
    // Use cached data fetchers to avoid redundant calls
    if (section === "rankGraph") {
        const stats = await getCachedStats(puuid);
        const queueType = getQueueType(stats);
        const rankHistory = await getCachedRankHistory(puuid, queueType, 30);
        return <RankGraph rankHistory={rankHistory} />;
    }

    if (section === "rankGoal") {
        const stats = await getCachedStats(puuid);
        const displayedRank = getDisplayedRank(stats);

        return (
            <RankGoalTracker
                puuid={puuid}
                currentRank={displayedRank ? {
                    tier: displayedRank.tier,
                    rank: displayedRank.rank,
                    leaguePoints: displayedRank.leaguePoints
                } : null}
            />
        );
    }

    if (section === "quickStats") {
        const stats = await getCachedStats(puuid);
        return <QuickStats stats={stats?.quickStats || null} />;
    }

    if (section === "nextGameFocus") {
        const [stats, enhancedData] = await Promise.all([
            getCachedStats(puuid),
            getCachedEnhancedData(puuid),
        ]);
        const recentWinRate = stats?.recentMatches
            ? Math.round((stats.recentMatches.slice(0, 10).filter((m: any) => m.win).length / Math.min(10, stats.recentMatches.length)) * 100)
            : 50;

        return (
            <NextGameFocus
                radarStats={stats?.radarStats || null}
                coachFeedback={enhancedData.coachFeedback}
                recentWinRate={recentWinRate}
            />
        );
    }

    if (section === "skillRadar") {
        const stats = await getCachedStats(puuid);
        return <SkillRadar stats={stats?.radarStats || null} />;
    }

    return null;
}
