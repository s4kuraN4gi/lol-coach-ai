// Async Server Component - fetches its own data with caching
import { getCachedStats, getCachedEnhancedData, getDisplayedRank } from "../../lib/cachedData";
import ProfileCard from "../ProfileCard";

type SummonerInfo = {
    name: string;
    tagLine: string;
    profileIconId: number;
    summonerLevel: number;
    puuid: string;
};

type Props = {
    summoner: SummonerInfo;
};

// Skeleton for Suspense fallback
export function ProfileSkeleton() {
    return (
        <div className="glass-panel p-6 rounded-xl h-[280px] animate-pulse">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-slate-800"></div>
                <div className="flex-1">
                    <div className="h-6 bg-slate-800 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-slate-800 rounded w-20"></div>
                </div>
                <div className="text-right">
                    <div className="h-6 bg-slate-800 rounded w-24 mb-1"></div>
                    <div className="h-5 bg-slate-800 rounded w-16"></div>
                </div>
            </div>
            <div className="h-px bg-slate-700/50 mb-4"></div>
            <div className="space-y-3">
                <div className="h-4 bg-slate-800 rounded w-full"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
            </div>
        </div>
    );
}

// Async Server Component
export async function ProfileSection({ summoner }: Props) {
    // Fetch data using cached functions (deduplicates within request)
    const [stats, enhancedData] = await Promise.all([
        getCachedStats(summoner.puuid),
        getCachedEnhancedData(summoner.puuid),
    ]);

    const displayedRank = getDisplayedRank(stats);

    return (
        <ProfileCard
            summoner={{
                name: summoner.name,
                tagLine: summoner.tagLine,
                profileIconId: summoner.profileIconId,
                summonerLevel: summoner.summonerLevel
            }}
            rankInfo={displayedRank ? {
                tier: displayedRank.tier,
                rank: displayedRank.rank,
                leaguePoints: displayedRank.leaguePoints,
                wins: displayedRank.wins,
                losses: displayedRank.losses
            } : null}
            recentMatches={stats?.recentMatches || []}
            monthlyStats={enhancedData.monthlyStats}
            coachFeedback={enhancedData.coachFeedback}
            roleStats={stats?.roleStats || null}
            topChampions={stats?.championStats?.slice(0, 3) || []}
        />
    );
}
