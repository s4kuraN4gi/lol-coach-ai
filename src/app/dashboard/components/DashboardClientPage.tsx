"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import ProfileCard from "./ProfileCard";
import { useRouter } from "next/navigation";

// Lazy load non-critical widgets for faster initial page load
const RankGraph = dynamic(() => import("./RankGraph"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

const RankGoalTracker = dynamic(() => import("../widgets/RankGoalTracker"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[150px] animate-pulse" />,
    ssr: false
});

const QuickStats = dynamic(() => import("../widgets/QuickStats"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

const NextGameFocus = dynamic(() => import("../widgets/NextGameFocus"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

const SkillRadar = dynamic(() => import("../widgets/SkillRadar"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

const ChampionPerformance = dynamic(() => import("../widgets/ChampionPerformance"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[300px] animate-pulse" />,
    ssr: false
});

const WinConditionWidget = dynamic(() => import("../widgets/WinConditionWidget"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

const NemesisWidget = dynamic(() => import("../widgets/NemesisWidget"), {
    loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" />,
    ssr: false
});

import DashboardUpdater from "./DashboardUpdater";
import { useTranslation } from "@/contexts/LanguageContext";
import { useSummoner } from "../../Providers/SummonerProvider";
import type { MatchStatsDTO, BasicStatsDTO, RankHistoryEntry, MonthlyStats, CoachFeedbackSummary } from "@/app/actions/stats";

type DashboardStatsDTO = MatchStatsDTO & BasicStatsDTO;

type SummonerInfo = {
    name: string;
    tagLine: string;
    profileIconId: number;
    summonerLevel: number;
    puuid: string;
};

type Props = {
    initialStats: DashboardStatsDTO;
    initialRankHistory: RankHistoryEntry[];
    initialMonthlyStats: MonthlyStats | null;
    initialCoachFeedback: CoachFeedbackSummary | null;
    summoner: SummonerInfo;
};

export default function DashboardClientPage({
    initialStats,
    initialRankHistory,
    initialMonthlyStats,
    initialCoachFeedback,
    summoner
}: Props) {
    const [stats, setStats] = useState<DashboardStatsDTO>(initialStats);
    const [rankHistory, setRankHistory] = useState<RankHistoryEntry[]>(initialRankHistory);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(initialMonthlyStats);
    const [coachFeedback, setCoachFeedback] = useState<CoachFeedbackSummary | null>(initialCoachFeedback);
    const [isFetching, setIsFetching] = useState(false);
    const [currentQueue, setCurrentQueue] = useState<"SOLO" | "FLEX">(() => {
        // Auto-select queue based on initial data
        const hasSolo = initialStats.ranks.some((r: any) => r.queueType === "RANKED_SOLO_5x5");
        const hasFlex = initialStats.ranks.some((r: any) => r.queueType === "RANKED_FLEX_SR");
        if (!hasSolo && hasFlex) return "FLEX";
        return "SOLO";
    });
    const { t } = useTranslation();
    const { refreshSummoner } = useSummoner();

    const router = useRouter();
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Manual Refresh Handler (Force Full Update)
    const handleManualRefresh = async () => {
        if (!summoner.puuid) return;
        setIsFetching(true);
        try {
            const { performFullUpdate, getStatsFromCache, fetchRankHistory, fetchProfileEnhancedData } = await import('@/app/actions/stats');
            await performFullUpdate(summoner.puuid);

            // Reload all data
            const [newStats, history, enhanced] = await Promise.all([
                getStatsFromCache(summoner.puuid),
                fetchRankHistory(summoner.puuid, currentQueue === "SOLO" ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR', 30),
                fetchProfileEnhancedData(summoner.puuid)
            ]);

            if (isMounted.current) {
                setStats(newStats);
                setRankHistory(history);
                setMonthlyStats(enhanced.monthlyStats);
                setCoachFeedback(enhanced.coachFeedback);
            }

            await refreshSummoner();
            router.refresh();
        } catch (e) {
            console.error(e);
        }
        if (isMounted.current) setIsFetching(false);
    };

    // Filter Rank based on Queue Selection
    const displayedRank = stats?.ranks?.find(r =>
        currentQueue === "SOLO" ? r.queueType === "RANKED_SOLO_5x5" : r.queueType === "RANKED_FLEX_SR"
    ) || null;

    // Check if matches have loaded
    const matchesLoaded = stats !== null;

    // Handle empty matches case
    if (matchesLoaded && stats.recentMatches.length === 0) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                    <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg w-full">
                        <div className="text-4xl mb-4">📬</div>
                        <h2 className="text-xl font-bold text-white mb-2">{t('dashboard.noData.title')}</h2>
                        <p className="text-slate-400 mb-6">
                            {t('dashboard.noData.description')}
                        </p>

                        <button
                            onClick={handleManualRefresh}
                            disabled={isFetching}
                            className="bg-primary-500 hover:bg-primary-600 px-6 py-2 rounded-lg text-white font-bold transition-colors w-full"
                        >
                            {isFetching ? t('dashboard.refreshing') : t('dashboard.noData.button')}
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <>
            <DashboardLayout>
                {summoner.puuid && <DashboardUpdater puuid={summoner.puuid} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">{t('dashboard.title')}</h1>
                        <p className="text-slate-400 text-sm">{t('dashboard.subtitle')}</p>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleManualRefresh}
                            className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg transition shadow-lg hover:shadow-blue-500/10 flex items-center gap-2"
                            disabled={isFetching}
                        >
                            {isFetching ? (
                                <>
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span> {t('dashboard.refreshing')}
                                </>
                            ) : (
                                `↻ ${t('dashboard.refresh')}`
                            )}
                        </button>
                    </div>
                </div>


                {/* Row 1: Hero Profile + Stacked Right (RankGraph + RankGoal) */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                    {/* Profile Card - Hero (3/5 width) */}
                    <div className="lg:col-span-3">
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
                            monthlyStats={monthlyStats}
                            coachFeedback={coachFeedback}
                            roleStats={stats?.roleStats || null}
                            topChampions={stats?.championStats?.slice(0, 3) || []}
                        />
                    </div>

                    {/* Right Stack - RankGraph + RankGoalTracker (2/5 width) */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        {matchesLoaded ? (
                            <RankGraph rankHistory={rankHistory} />
                        ) : (
                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 flex-1 animate-pulse"></div>
                        )}

                        {summoner.puuid && (
                            <RankGoalTracker
                                puuid={summoner.puuid}
                                currentRank={displayedRank ? {
                                    tier: displayedRank.tier,
                                    rank: displayedRank.rank,
                                    leaguePoints: displayedRank.leaguePoints
                                } : null}
                            />
                        )}
                    </div>
                </div>

                {/* Row 2: QuickStats + NextGameFocus + SkillRadar (3 equal columns) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {matchesLoaded ? (
                        <QuickStats stats={stats?.quickStats || null} />
                    ) : (
                        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 animate-pulse"></div>
                    )}
                    <NextGameFocus
                        radarStats={stats?.radarStats || null}
                        coachFeedback={coachFeedback}
                        recentWinRate={stats?.recentMatches
                            ? Math.round((stats.recentMatches.slice(0, 10).filter(m => m.win).length / Math.min(10, stats.recentMatches.length)) * 100)
                            : 50
                        }
                    />
                    {matchesLoaded ? (
                        <SkillRadar stats={stats?.radarStats || null} />
                    ) : (
                        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 animate-pulse"></div>
                    )}
                </div>

                {/* Row 3: ChampionPerformance (50%) + WinCondition (25%) + Nemesis (25%) */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2">
                        {matchesLoaded ? (
                            <ChampionPerformance stats={stats?.championStats || []} />
                        ) : (
                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-full animate-pulse"></div>
                        )}
                    </div>
                    {matchesLoaded ? (
                        <WinConditionWidget stats={stats?.uniqueStats || null} />
                    ) : (
                        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 animate-pulse"></div>
                    )}
                    {matchesLoaded ? (
                        <NemesisWidget stats={stats?.uniqueStats || null} />
                    ) : (
                        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 animate-pulse"></div>
                    )}
                </div>

            </DashboardLayout>
        </>
    );
}
