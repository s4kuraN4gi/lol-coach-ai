"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/contexts/LanguageContext";
import { useSummoner } from "@/app/Providers/SummonerProvider";
import { useDashboard } from "@/hooks/useDashboardData";

import DashboardUpdater from "./DashboardUpdater";
import ProfileCard from "./ProfileCard";
import RankGraph from "./RankGraph";
import RankGoalTracker from "../widgets/RankGoalTracker";
import QuickStats from "../widgets/QuickStats";
import NextGameFocus from "../widgets/NextGameFocus";
import SkillRadar from "../widgets/SkillRadar";
import ChampionPerformance from "../widgets/ChampionPerformance";
import WinConditionWidget from "../widgets/WinConditionWidget";
import NemesisWidget from "../widgets/NemesisWidget";
import DashboardSkeleton from "./DashboardSkeleton";

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

export default function DashboardContent({ summoner }: Props) {
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { refreshSummoner } = useSummoner();
    const [isPending, startTransition] = useTransition();
    const syncCalledRef = useRef(false);

    // After checkout success, sync subscription tier from Stripe
    useEffect(() => {
        if (searchParams.get('checkout') === 'success' && !syncCalledRef.current) {
            syncCalledRef.current = true;
            console.log('[Dashboard] Detected checkout=success, calling syncSubscriptionStatus...');
            import('@/app/actions/analysis').then(({ syncSubscriptionStatus }) => {
                syncSubscriptionStatus().then((result) => {
                    console.log('[Dashboard] Post-checkout sync result:', JSON.stringify(result, null, 2));
                    if (result && 'debug' in result) {
                        console.log('[Dashboard] Sync debug info:', JSON.stringify(result.debug, null, 2));
                    }
                    // Clean up URL and refresh page to reflect new tier
                    router.replace('/dashboard');
                }).catch((err) => {
                    console.error('[Dashboard] Sync failed:', err);
                });
            });
        }
    }, [searchParams, router]);

    // SWR hook - fetches data on client, caches for instant subsequent visits
    const {
        stats,
        enhancedData,
        rankHistory,
        displayedRank,
        isLoading,
        isValidating,
        refreshAll,
    } = useDashboard(summoner.puuid);

    // Manual refresh handler
    const handleManualRefresh = useCallback(async () => {
        try {
            const { performFullUpdate } = await import('@/app/actions/stats');
            await performFullUpdate(summoner.puuid);
            await refreshAll();
            await refreshSummoner();
            startTransition(() => {
                router.refresh();
            });
        } catch (e) {
            console.error(e);
        }
    }, [summoner.puuid, refreshAll, refreshSummoner, router]);

    const isFetching = isValidating || isPending;

    // Show skeleton while loading (first visit or no cache)
    if (isLoading) {
        return (
            <>
                <DashboardUpdater puuid={summoner.puuid} />
                {/* Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">
                            {t('dashboard.title')}
                        </h1>
                        <p className="text-slate-400 text-sm">{t('dashboard.subtitle')}</p>
                    </div>
                    <div className="flex justify-end items-center gap-2">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Loading...
                        </span>
                    </div>
                </div>
                <DashboardSkeleton />
            </>
        );
    }

    // Calculate recent win rate
    const recentWinRate = stats?.recentMatches
        ? Math.round((stats.recentMatches.slice(0, 10).filter((m: any) => m.win).length / Math.min(10, stats.recentMatches.length)) * 100)
        : 50;

    return (
        <>
            <DashboardUpdater puuid={summoner.puuid} />

            {/* Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">
                        {t('dashboard.title')}
                    </h1>
                    <p className="text-slate-400 text-sm">{t('dashboard.subtitle')}</p>
                </div>
                <div className="flex justify-end items-center gap-2">
                    {isValidating && !isPending && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Syncing...
                        </span>
                    )}
                    <button
                        onClick={handleManualRefresh}
                        className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg transition shadow-lg hover:shadow-blue-500/10 flex items-center gap-2"
                        disabled={isFetching}
                    >
                        {isPending ? (
                            <>
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                                {t('dashboard.refreshing')}
                            </>
                        ) : (
                            `↻ ${t('dashboard.refresh')}`
                        )}
                    </button>
                </div>
            </div>

            {/* Row 1: Profile + RankGraph */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
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
                        monthlyStats={enhancedData?.monthlyStats || null}
                        coachFeedback={enhancedData?.coachFeedback || null}
                        roleStats={stats?.roleStats || null}
                        topChampions={stats?.championStats?.slice(0, 3) || []}
                    />
                </div>
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <RankGraph rankHistory={rankHistory} />
                    <RankGoalTracker
                        puuid={summoner.puuid}
                        currentRank={displayedRank ? {
                            tier: displayedRank.tier,
                            rank: displayedRank.rank,
                            leaguePoints: displayedRank.leaguePoints
                        } : null}
                    />
                </div>
            </div>

            {/* Row 2: QuickStats + NextGameFocus + SkillRadar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <QuickStats stats={stats?.quickStats || null} />
                <NextGameFocus
                    radarStats={stats?.radarStats || null}
                    coachFeedback={enhancedData?.coachFeedback || null}
                    recentWinRate={recentWinRate}
                />
                <SkillRadar stats={stats?.radarStats || null} />
            </div>

            {/* Row 3: ChampionPerformance + WinCondition + Nemesis */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                    <ChampionPerformance stats={stats?.championStats || []} />
                </div>
                <WinConditionWidget stats={stats?.uniqueStats || null} />
                <NemesisWidget stats={stats?.uniqueStats || null} />
            </div>
        </>
    );
}
