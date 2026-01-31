"use client";

import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import Link from "next/link";
import { useSummoner } from "@/app/Providers/SummonerProvider";
import StatsSkeleton from "../components/skeletons/StatsSkeleton";
// Premium Imports
import PlanStatusBadge from "@/app/Components/subscription/PlanStatusBadge";
import { type AnalysisStatus } from "@/app/actions/constants";
import { useTranslation } from "@/contexts/LanguageContext";
// SWR Hooks
import { useMatchHistory } from "@/hooks/useStatsData";
import { useAnalysisStatus } from "@/hooks/useCoachData";

type FilterType = "ALL" | "SOLO" | "FLEX" | "NORMAL" | "ARAM";

export default function StatsPage() {
    const { activeSummoner, loading: summonerLoading } = useSummoner();
    const { t } = useTranslation();
    const [filter, setFilter] = useState<FilterType>("ALL");

    // SWR Hooks
    const { status: swrStatus, refresh: refreshStatus } = useAnalysisStatus();
    const { history, isLoading, isValidating } = useMatchHistory(
        activeSummoner?.puuid || null,
        filter
    );

    // Local status state for updates
    const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);

    // Sync SWR status to local state
    useEffect(() => {
        if (swrStatus !== undefined) {
            setAnalysisStatus(swrStatus);
        }
    }, [swrStatus]);

    // Derived Stats (Memoized)
    const stats = useMemo(() => {
        const newStats = { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 };

        history.forEach(h => {
            if (h.win) newStats.wins++;
            else newStats.losses++;
            newStats.kills += h.kills;
            newStats.deaths += h.deaths;
            newStats.assists += h.assists;
        });

        return newStats;
    }, [history]);

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
    const avgKda = totalGames > 0
        ? ((stats.kills + stats.assists) / Math.max(1, stats.deaths)).toFixed(2)
        : "0.00";

    // Filter labels mapping
    const filterLabels: Record<string, string> = {
        "ALL": t('statsPage.filters.all'),
        "SOLO": t('statsPage.filters.solo'),
        "FLEX": t('statsPage.filters.flex'),
        "NORMAL": t('statsPage.filters.normal'),
        "ARAM": t('statsPage.filters.aram')
    };

    // 1. Initial Loading (Show Full Page Skeleton)
    if (summonerLoading || (isLoading && history.length === 0)) {
        return (
            <DashboardLayout>
                <StatsSkeleton />
            </DashboardLayout>
        );
    }

    // 2. No Account State
    if (!activeSummoner || !activeSummoner.puuid) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <h2 className="text-xl font-bold text-white mb-4">{t('statsPage.noAccountTitle')}</h2>
                    <p className="text-slate-400 mb-6">{t('statsPage.noAccountDesc')}</p>
                    <Link href="/account" className="bg-blue-600 text-white px-6 py-2 rounded-lg">{t('statsPage.goToSettings')}</Link>
                </div>
            </DashboardLayout>
        );
    }

    // 3. Main Content
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                {/* Header with Premium Badge */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black italic tracking-tighter text-white">
                            {t('statsPage.title')}
                        </h1>
                        {isValidating && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                Syncing...
                            </span>
                        )}
                    </div>
                    <PlanStatusBadge
                        initialStatus={analysisStatus}
                        onStatusUpdate={setAnalysisStatus}
                    />
                </div>

                {/* Stats - Available for all users */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">{t('statsPage.stats.winRate')}</div>
                        <div className={`text-3xl font-black ${winRate >= 50 ? 'text-blue-400' : 'text-slate-200'}`}>
                            {winRate}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{stats.wins}W - {stats.losses}L</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">{t('statsPage.stats.kdaRatio')}</div>
                        <div className="text-3xl font-black text-yellow-500">{avgKda}</div>
                        <div className="text-xs text-slate-500 mt-1">{t('statsPage.stats.avgPerformance')}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl opacity-75">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">{t('statsPage.stats.csPerMin')}</div>
                        <div className="text-3xl font-black text-purple-400">7.2</div>
                        <div className="text-xs text-slate-500 mt-1">{t('statsPage.stats.top15')}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl opacity-75">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">{t('statsPage.stats.visionScore')}</div>
                        <div className="text-3xl font-black text-green-400">24.5</div>
                        <div className="text-xs text-slate-500 mt-1">{t('statsPage.stats.excellent')}</div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                        {t('statsPage.matchGallery')}
                    </h2>

                    <div className="flex bg-slate-900/80 rounded-lg p-1 border border-slate-700 overflow-x-auto max-w-full">
                        {(["ALL", "SOLO", "FLEX", "NORMAL", "ARAM"] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setFilter(mode)}
                                className={`px-3 py-1 text-xs font-bold rounded-md whitespace-nowrap transition ${filter === mode
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                {filterLabels[mode]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading state for filter change */}
                {isLoading && history.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 h-[160px] p-6 animate-pulse">
                                <div className="flex justify-between items-start mb-auto">
                                    <div>
                                        <div className="h-8 w-32 bg-slate-800 rounded mb-2"></div>
                                        <div className="h-3 w-24 bg-slate-800 rounded"></div>
                                    </div>
                                    <div className="h-6 w-16 bg-slate-800 rounded"></div>
                                </div>
                                <div className="mt-4 flex justify-between items-end">
                                    <div className="h-5 w-24 bg-slate-800 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map((match, i) => (
                            <Link
                                key={match.matchId}
                                href={`/dashboard/match/${match.matchId}`}
                                className={`
                                    relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-all duration-300 group
                                    ${match.win ? 'hover:border-blue-500/50' : 'hover:border-red-500/50'}
                                    animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards
                                `}
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="absolute inset-0 opacity-20 grayscale group-hover:grayscale-0 transition duration-500">
                                    <img
                                        src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${match.champion}_0.jpg`}
                                        alt={match.champion}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>

                                <div className="relative p-6 z-10 flex flex-col h-full justify-between min-h-[160px]">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-2xl font-black text-white italic">{match.champion}</div>
                                            <div className="text-xs text-slate-400 font-mono">{match.mode} • {match.date}</div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${match.win ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                                            {match.win ? t('statsPage.victory') : t('statsPage.defeat')}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-between items-end">
                                        <div className="text-slate-300 font-mono text-sm">
                                            KDA <span className="text-white font-bold text-lg">{match.kda}</span>
                                        </div>
                                        <div className="text-xs text-blue-400 font-bold opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all">
                                            {t('statsPage.analyze')}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {history.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-slate-500 border border-slate-800 border-dashed rounded-xl">
                        {t('statsPage.noMatches')}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
