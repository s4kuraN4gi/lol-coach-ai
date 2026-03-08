"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslation } from "@/contexts/LanguageContext";
import { useSummoner } from "@/app/providers/SummonerProvider";
import { useDashboard } from "@/hooks/useDashboardData";

import DashboardUpdater from "./DashboardUpdater";
import ProfileCard from "./ProfileCard";
const RankGraph = dynamic(() => import("./RankGraph"), { ssr: false, loading: () => <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-[200px] animate-pulse" /> });
import RankGoalTracker from "../widgets/RankGoalTracker";
import QuickStats from "../widgets/QuickStats";
import NextGameFocus from "../widgets/NextGameFocus";
import SkillRadar from "../widgets/SkillRadar";
import ChampionPerformance from "../widgets/ChampionPerformance";
import WinConditionWidget from "../widgets/WinConditionWidget";
import NemesisWidget from "../widgets/NemesisWidget";
import Link from "next/link";
import DashboardSkeleton from "./DashboardSkeleton";
import PremiumPromoCard from "../widgets/PremiumPromoCard";
import PremiumFeatureGate from "@/app/components/subscription/PremiumFeatureGate";
import ReferralCard from "@/app/components/subscription/ReferralCard";
import AdSenseBanner from "@/app/components/ads/AdSenseBanner";
import { useAnalysisStatus } from "@/hooks/useCoachData";
import { logger } from "@/lib/logger";

type SummonerInfo = {
    name: string;
    tagLine: string;
    profileIconId: number;
    summonerLevel: number;
    puuid: string;
};

type Props = {
    summoner: SummonerInfo;
    initialStats?: (import("@/app/actions/stats").MatchStatsDTO & import("@/app/actions/stats").BasicStatsDTO) | null;
    initialEnhancedData?: import("@/app/actions/stats").ProfileEnhancedData | null;
};

export default function DashboardContent({ summoner, initialStats, initialEnhancedData }: Props) {
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { refreshSummoner } = useSummoner();
    const [isPending, startTransition] = useTransition();
    const syncCalledRef = useRef(false);

    // Welcome modal for first-time users after onboarding
    const [showWelcome, setShowWelcome] = useState(false);
    const welcomeDialogRef = useRef<HTMLDivElement>(null);
    const upgradeDialogRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (searchParams.get('welcome') === '1') {
            setShowWelcome(true);
            router.replace('/dashboard');
        }
    }, [searchParams, router]);

    // Focus trap for Welcome & Upgrade modals
    useEffect(() => {
        const activeModal = showUpgradeSuccess ? upgradeDialogRef.current : showWelcome ? welcomeDialogRef.current : null;
        if (!activeModal) return;

        const focusableEls = activeModal.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])');
        if (focusableEls.length > 0) focusableEls[0].focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showUpgradeSuccess) setShowUpgradeSuccess(false);
                else if (showWelcome) setShowWelcome(false);
                return;
            }
            if (e.key !== 'Tab' || focusableEls.length === 0) return;
            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showWelcome, showUpgradeSuccess]);

    // After checkout success, sync subscription tier from Stripe + show modal
    const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
    useEffect(() => {
        if (searchParams.get('checkout') === 'success' && !syncCalledRef.current) {
            syncCalledRef.current = true;
            import('@/app/actions/analysis').then(({ syncSubscriptionStatus }) => {
                syncSubscriptionStatus().then(() => {
                    setShowUpgradeSuccess(true);
                    router.replace('/dashboard');
                }).catch((err) => {
                    logger.error('[Dashboard] Sync failed:', err);
                    setShowUpgradeSuccess(true);
                    router.replace('/dashboard');
                });
            });
        }
    }, [searchParams, router]);

    // SWR hook - uses SSR prefetched data as fallback for instant first paint
    const {
        stats,
        enhancedData,
        rankHistory,
        displayedRank,
        isLoading,
        isValidating,
        refreshAll,
    } = useDashboard(summoner.puuid, { initialStats: initialStats ?? undefined, initialEnhancedData: initialEnhancedData ?? undefined });

    const { status: analysisStatus } = useAnalysisStatus();

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
            logger.error(e);
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
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            {t('dashboard.loading')}
                        </span>
                    </div>
                </div>
                <DashboardSkeleton />
            </>
        );
    }

    // Calculate recent win rate
    const recentWinRate = stats?.recentMatches
        ? Math.round((stats.recentMatches.slice(0, 10).filter((m: { win: boolean }) => m.win).length / Math.min(10, stats.recentMatches.length)) * 100)
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
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            {t('dashboard.syncing')}
                        </span>
                    )}
                    {analysisStatus && !analysisStatus.is_premium && (
                        <Link
                            href="/pricing"
                            className="text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-4 py-2 rounded-lg font-bold transition shadow-lg shadow-amber-500/20"
                        >
                            {t('dashboard.upgrade', 'Upgrade')}
                        </Link>
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

            {/* Premium Promo / Usage Bar */}
            <div className="mb-4 space-y-3">
                <PremiumPromoCard status={analysisStatus ?? null} />
                {analysisStatus?.is_premium && <ReferralCard />}
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
                <PremiumFeatureGate isPremium={analysisStatus?.is_premium ?? false} subscriptionTier={analysisStatus?.subscription_tier}>
                    <NextGameFocus
                        radarStats={stats?.radarStats || null}
                        coachFeedback={enhancedData?.coachFeedback || null}
                        recentWinRate={recentWinRate}
                    />
                </PremiumFeatureGate>
                <SkillRadar stats={stats?.radarStats || null} />
            </div>

            {/* Ad Banner (hidden for Premium) */}
            <div className="mb-4 flex justify-center">
                <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" isPremium={analysisStatus?.is_premium} />
            </div>

            {/* Row 3: ChampionPerformance + WinCondition + Nemesis */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                    <ChampionPerformance stats={stats?.championStats || []} />
                </div>
                <PremiumFeatureGate isPremium={analysisStatus?.is_premium ?? false} subscriptionTier={analysisStatus?.subscription_tier}>
                    <WinConditionWidget stats={stats?.uniqueStats || null} />
                </PremiumFeatureGate>
                <PremiumFeatureGate isPremium={analysisStatus?.is_premium ?? false} subscriptionTier={analysisStatus?.subscription_tier}>
                    <NemesisWidget stats={stats?.uniqueStats || null} />
                </PremiumFeatureGate>
            </div>

            {/* Upgrade Success Modal */}
            {showUpgradeSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div ref={upgradeDialogRef} role="dialog" aria-modal="true" aria-labelledby="upgrade-success-title" className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="text-5xl mb-4">&#127775;</div>
                        <h2 id="upgrade-success-title" className="text-xl font-bold text-white mb-2">
                            {t('dashboard.upgradeSuccess.title', 'Welcome to Premium!')}
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">
                            {t('dashboard.upgradeSuccess.desc', 'Your plan has been activated. Enjoy all the premium features!')}
                        </p>
                        <div className="space-y-3">
                            <Link
                                href="/dashboard/coach"
                                className="block w-full py-3 rounded-lg bg-gradient-to-r from-yellow-600 to-amber-500 text-white font-bold hover:from-yellow-500 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
                            >
                                {t('dashboard.upgradeSuccess.tryCoach', 'Try AI Match Analysis')}
                            </Link>
                            <button
                                onClick={() => setShowUpgradeSuccess(false)}
                                className="block w-full py-2.5 text-sm text-slate-400 hover:text-slate-300 transition"
                            >
                                {t('dashboard.upgradeSuccess.dismiss', 'View Dashboard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Modal (hidden when upgrade success is showing) */}
            {showWelcome && !showUpgradeSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div ref={welcomeDialogRef} role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="text-5xl mb-4">&#127881;</div>
                        <h2 id="welcome-modal-title" className="text-xl font-bold text-white mb-2">
                            {t('dashboard.welcome.title', 'Welcome to LoL Coach AI!')}
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">
                            {t('dashboard.welcome.desc', 'Your account setup is complete. Start by reviewing your match history and getting AI coaching!')}
                        </p>
                        <div className="space-y-3">
                            <Link
                                href="/dashboard/coach"
                                className="block w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20"
                            >
                                {t('dashboard.welcome.startCoaching', 'Start AI Coaching')}
                            </Link>
                            <Link
                                href="/pricing"
                                className="block w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold transition-all shadow-lg shadow-amber-500/20"
                            >
                                {t('dashboard.welcome.viewPlans', 'View Plans — 7 days free trial')}
                            </Link>
                            <button
                                onClick={() => setShowWelcome(false)}
                                className="block w-full py-2.5 text-sm text-slate-400 hover:text-slate-300 transition"
                            >
                                {t('dashboard.welcome.dismiss', 'View Dashboard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
