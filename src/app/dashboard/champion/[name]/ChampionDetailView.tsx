"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchMatchIds, fetchMatchDetail } from "@/app/actions/riot";
import { resolveChampionId } from "@/app/actions/champion";
import Link from "next/link";
import { ChampionDetailsDTO } from "@/app/actions/champion";
import { useTranslation } from "@/contexts/LanguageContext";
// Premium Imports
import PlanStatusBadge from "@/app/Components/subscription/PlanStatusBadge";
import PremiumFeatureGate from "@/app/Components/subscription/PremiumFeatureGate";
import { getAnalysisStatus, type AnalysisStatus } from "@/app/actions/analysis";

type Match = any; // We can use strict type if available

// --- HELPER COMPONENT: Simple Tooltip ---
function HelperTooltip({ text }: { text: string }) {
    return (
        <div className="group relative ml-2 inline-flex items-center cursor-help z-50">
            <span className="text-slate-500 hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
            </div>
        </div>
    );
}

export default function ChampionDetailView({ puuid, championName }: { puuid: string, championName: string }) {
    const { t } = useTranslation();
    const [loadingIds, setLoadingIds] = useState(true);
    const [matchDetails, setMatchDetails] = useState<Match[]>([]);
    const [totalMatches, setTotalMatches] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    
    // Premium Status State
    const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);

    // Fetch Premium Status
    useEffect(() => {
        getAnalysisStatus().then(setAnalysisStatus);
    }, []);

    useEffect(() => {
        let ignore = false;

        async function load() {
            try {
                // 1. Resolve ID
                const champIdStr = await resolveChampionId(championName);
                if (!champIdStr) {
                    setError(`Champion ${championName} not found.`);
                    setLoadingIds(false);
                    return;
                }
                const champId = parseInt(champIdStr);

// 2. Fetch Match IDs (Filtered)
                // DEBUG: Log the resolved ID and request
                console.log(`[ChampionDetail] Fetching matches for ${championName} (ID: ${champId})...`);
                const idsRes = await fetchMatchIds(puuid, 50, undefined, undefined, champId);
                
                if (idsRes.success && idsRes.data) {
                     console.log(`[ChampionDetail] Found ${idsRes.data.length} matches for champion ${champId}`);
                } else {
                     console.log(`[ChampionDetail] Failed to find matches or error: ${idsRes.error}`);
                }

                if (ignore) return;
                
                if (!idsRes.success || !idsRes.data) {
                    setError("Failed to fetch matches.");
                    setLoadingIds(false);
                    return;
                }

                setLoadingIds(false); // Skeletons/Empty state

                // 3. Stream Details
                // We fetch in chunks or parallel
                const ids = idsRes.data;
                setTotalMatches(ids.length);
                
                // Fetch in batches of 5 to allow progressive update without network hammering
                // Actually parallel logic in StatsPage was good. 
                ids.forEach(id => {
                    fetchMatchDetail(id).then(res => {
                         if(ignore) return;
                         if (res.success && res.data) {
                             setMatchDetails(prev => [...prev, res.data]);
                         }
                    });
                });

            } catch (e) {
                console.error(e);
                if(!ignore) setError("An unexpected error occurred.");
            }
        }
        load();
        return () => { ignore = true; };
    }, [puuid, championName]);

    // --- AGGREGATION LOGIC (Memoized) ---
    const stats: ChampionDetailsDTO | null = useMemo(() => {
        if (matchDetails.length === 0) return null;
        
        // ... (Aggregation logic remains same, implicit via skipping lines) ...
        // We will jump to render logic for Tooltips in next chunk or rely on original code structure if unchanged.
        // Actually I need to insert HelperTooltip usages in the JSX, which is further down.
        // I will split this modification.

        // --- Copied Logic from server action (simplified/adapted) ---
        let wins = 0;

        let kills = 0, deaths = 0, assists = 0;
        let cs = 0, duration = 0;
        let totalCsDiff10 = 0, totalGoldDiff = 0, totalXpDiff = 0;
        let laningGames = 0;
        let damageShare = 0, killParticipation = 0;
        
        const spikes = {
            early: { wins: 0, games: 0 },
            mid: { wins: 0, games: 0 },
            late: { wins: 0, games: 0 }
        };

        const matchupMap = new Map<string, { games: number, wins: number, goldDiff: number, csDiff: number, killDiff: number }>();
        const matchupItemsMap = new Map<string, Map<number, number>>();

        let validGamesCount = 0;

        matchDetails.forEach(m => {
            const p = m.info.participants.find((p: any) => p.puuid === puuid);
            if (!p) return; 

            // STRICT FILTER: Verify champion name matches requested champion
            // This safeguards against API filter failures or cache issues
            if (p.championName.toLowerCase() !== decodeURIComponent(championName).toLowerCase()) {
                return;
            }

            validGamesCount++;

            const team = m.info.participants.filter((t: any) => t.teamId === p.teamId);

            // Basic
            if (p.win) wins++;
            kills += p.kills;
            deaths += p.deaths;
            assists += p.assists;
            cs += (p.totalMinionsKilled + p.neutralMinionsKilled);
            duration += m.info.gameDuration;

            // Combat
            if (p.challenges?.teamDamagePercentage) {
                damageShare += p.challenges.teamDamagePercentage;
            } else {
                 const totalTeamDmg = team.reduce((sum: number, t: any) => sum + t.totalDamageDealtToChampions, 0);
                 if (totalTeamDmg > 0) damageShare += (p.totalDamageDealtToChampions / totalTeamDmg);
            }
            if (p.challenges?.killParticipation) {
                killParticipation += p.challenges.killParticipation;
            }

            // Laning
            const opponent = m.info.participants.find((o: any) => 
                o.teamId !== p.teamId && o.teamPosition === p.teamPosition && p.teamPosition !== 'UTILITY'
            );

            if (opponent) {
                laningGames++;
                
                if (p.challenges?.laneMinionsFirst10Minutes !== undefined && opponent.challenges?.laneMinionsFirst10Minutes !== undefined) {
                    totalCsDiff10 += (p.challenges.laneMinionsFirst10Minutes - opponent.challenges.laneMinionsFirst10Minutes);
                } else if (p.teamPosition === 'JUNGLE' && p.challenges?.jungleCsBefore10Minutes !== undefined && opponent.challenges?.jungleCsBefore10Minutes !== undefined) {
                     totalCsDiff10 += (p.challenges.jungleCsBefore10Minutes - opponent.challenges.jungleCsBefore10Minutes);
                }

                const gDiff = p.goldEarned - opponent.goldEarned;
                totalGoldDiff += gDiff;
                totalXpDiff += (p.champExperience - opponent.champExperience);

                // Matchup
                const opponentName = opponent.championName;
                const current = matchupMap.get(opponentName) || { games: 0, wins: 0, goldDiff: 0, csDiff: 0, killDiff: 0 };
                
                current.games++;
                if (p.win) current.wins++;
                current.goldDiff += gDiff;
                current.csDiff += ((p.totalMinionsKilled + p.neutralMinionsKilled) - (opponent.totalMinionsKilled + opponent.neutralMinionsKilled));
                current.killDiff += (p.kills - opponent.kills);
                
                matchupMap.set(opponentName, current);
                 
                 // Items
                 if (!matchupItemsMap.has(opponentName)) matchupItemsMap.set(opponentName, new Map());
                 const itemCounts = matchupItemsMap.get(opponentName)!;
                 [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].forEach(itemId => {
                     if (itemId > 0) itemCounts.set(itemId, (itemCounts.get(itemId) || 0) + 1);
                 });
            }

            // Spikes
            const mins = m.info.gameDuration / 60;
            if (mins < 25) {
                spikes.early.games++;
                if (p.win) spikes.early.wins++;
            } else if (mins < 35) {
                spikes.mid.games++;
                if (p.win) spikes.mid.wins++;
            } else {
                spikes.late.games++;
                if (p.win) spikes.late.wins++;
            }
        });

        const games = validGamesCount;
        if (games === 0) return null;

        const matchups = Array.from(matchupMap.entries()).map(([name, data]) => {
             const itemMap = matchupItemsMap.get(name);
             const keyItems = itemMap ? Array.from(itemMap.entries()).sort((a,b) => b[1]-a[1]).slice(0,3).map(e=>e[0]) : [];
             return {
                opponentChampion: name,
                games: data.games,
                wins: data.wins,
                winRate: Math.round((data.wins / data.games) * 100),
                goldDiff: Math.round(data.goldDiff / data.games),
                csDiff: Math.round(data.csDiff / data.games),
                killDiff: parseFloat((data.killDiff / data.games).toFixed(1)),
                keyItems: keyItems
             };
        }).sort((a,b) => b.games - a.games);

        const safeDiv = (num: number, den: number) => den === 0 ? 0 : num / den;

        return {
            championName: championName, // Keep casing from URL? or use resolved? Using URL for now.
            summary: {
                games,
                wins,
                winRate: Math.round(safeDiv(wins, games) * 100),
                kda: `${safeDiv(kills, games).toFixed(1)} / ${(safeDiv(deaths, games)).toFixed(1)} / ${(safeDiv(assists, games)).toFixed(1)}`,
                avgKills: safeDiv(kills, games),
                avgDeaths: safeDiv(deaths, games),
                avgAssists: safeDiv(assists, games),
                avgCs: Math.round(safeDiv(cs, games)),
                csPerMin: duration > 0 ? parseFloat(((cs * 60) / duration).toFixed(1)) : 0
            },
            laning: {
                goldDiff: laningGames ? Math.round(totalGoldDiff / laningGames) : 0,
                csDiff10: laningGames ? parseFloat((totalCsDiff10 / laningGames).toFixed(1)) : 0,
                xpDiff: laningGames ? Math.round(totalXpDiff / laningGames) : 0,
                laneWinRate: 0
            },
            combat: {
                damageShare: parseFloat((safeDiv(damageShare, games) * 100).toFixed(1)),
                killParticipation: parseFloat((safeDiv(killParticipation, games) * 100).toFixed(1)),
                damagePerDeath: 0 
            },
            spikes: {
                earlyGame: { winRate: spikes.early.games ? Math.round((spikes.early.wins/spikes.early.games)*100) : 0, games: spikes.early.games },
                midGame: { winRate: spikes.mid.games ? Math.round((spikes.mid.wins/spikes.mid.games)*100) : 0, games: spikes.mid.games },
                lateGame: { winRate: spikes.late.games ? Math.round((spikes.late.wins/spikes.late.games)*100) : 0, games: spikes.late.games },
            },
            matchups: matchups
        };
    }, [matchDetails, championName, puuid]);


    // Progress Calculation
    const loadedCount = matchDetails.length;
    const progress = totalMatches > 0 ? Math.round((loadedCount / totalMatches) * 100) : 0;
    const isComplete = totalMatches > 0 && loadedCount >= totalMatches;
    
    // Determine Premium Status
    const isPremium = analysisStatus?.is_premium ?? false;

    // --- RENDER ---

    if (error) {
         return (
             <div className="p-8 text-center text-red-400">
                 {error}
             </div>
         );
    }
    
    // Skeleton or Empty State
    // Skeleton or Empty State
    if (!stats) {
        if (!loadingIds && (matchDetails.length === 0 || (matchDetails.length > 0 && !stats))) {
            return (
                <div className="p-8">
                     <h1 className="text-3xl font-bold text-slate-100 mb-4">{decodeURIComponent(championName)}</h1>
                     <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400">
                         {t('championDetail.noData')}
                     </div>
                </div>
            )
        }
        
        // Initial Skeleton
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
                 {/* Header Skeleton */}
                 <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-48 animate-pulse"></div>
                 {/* Analysis Grid Skeleton */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl h-64 animate-pulse"></div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl h-64 animate-pulse"></div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl h-64 animate-pulse"></div>
                 </div>
            </div>
        )
    }

    // Main Content
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                     <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                     {t('championDetail.backToDashboard')}
                </Link>
                {/* Upgrade Button in Header Area (Optional, or rely on internal prompts) */}
                {!isPremium && (
                   <div className="scale-75 origin-right">
                       <PlanStatusBadge initialStatus={analysisStatus} onStatusUpdate={setAnalysisStatus} />
                   </div>
                )}
            </div>

            {/* Header / Summary */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
                            {decodeURIComponent(stats.championName)}
                        </h1>
                        <div className="flex items-center gap-3 text-sm font-medium text-slate-400 mb-4">
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {stats.summary.games} {t('championDetail.games')}
                            </span>
                            <span>•</span>
                            <span className={stats.summary.winRate >= 50 ? "text-green-400" : "text-red-400"}>
                                {stats.summary.winRate}% WR
                            </span>
                             <span>•</span>
                             <span className="text-slate-300">
                                {stats.summary.kda} KDA
                             </span>
                        </div>
                        
                        {/* Progress Indicator */}
                        <div className="flex items-center gap-4">
                             <div className="flex-1 max-w-xs bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}
                                    style={{ width: `${progress}%` }}
                                 />
                             </div>
                             <div className="text-xs font-mono text-slate-500 min-w-[80px]">
                                 {isComplete ? (
                                     <span className="text-green-400 flex items-center gap-1">
                                         {t('championDetail.ready')}
                                     </span>
                                 ) : (
                                     <span>{t('championDetail.loading')} {loadedCount}/{totalMatches}</span>
                                 )}
                             </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('championDetail.stats.csPerMin')}</div>
                            <div className="text-xl font-bold text-slate-200">{stats.summary.csPerMin}</div>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('championDetail.stats.goldDiff')}</div>
                            <div className={`text-xl font-bold ${stats.laning.goldDiff > 0 ? "text-green-400" : "text-red-400"}`}>
                                {stats.laning.goldDiff > 0 ? "+" : ""}{stats.laning.goldDiff}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Laning */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <span className="text-xl">⚔️</span>
                         <h3 className="font-bold text-slate-100">{t('championDetail.sections.laningPhase')}</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400 flex items-center">
                                {t('championDetail.laning.csDiff10')} 
                                <HelperTooltip text={t('championDetail.tooltips.csDiff10')} />
                             </span>
                             <span className={`text-lg font-bold ${stats.laning.csDiff10 > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.laning.csDiff10 > 0 ? '+' : ''}{stats.laning.csDiff10}
                             </span>
                        </div>
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400 flex items-center">
                                {t('championDetail.laning.goldDiff')}
                                <HelperTooltip text={t('championDetail.tooltips.goldDiff')} />
                             </span>
                             <span className={`text-lg font-bold ${stats.laning.goldDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.laning.goldDiff > 0 ? '+' : ''}{stats.laning.goldDiff}
                             </span>
                        </div>
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400 flex items-center">
                                {t('championDetail.laning.xpDiff')}
                                <HelperTooltip text={t('championDetail.tooltips.xpDiff')} />
                             </span>
                             <span className={`text-lg font-bold ${stats.laning.xpDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.laning.xpDiff > 0 ? '+' : ''}{stats.laning.xpDiff}
                             </span>
                        </div>
                    </div>
                </div>

                {/* Combat */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <span className="text-xl">💥</span>
                         <h3 className="font-bold text-slate-100">{t('championDetail.sections.combatIdentity')}</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400 flex items-center">
                                {t('championDetail.combat.damageShare')}
                                <HelperTooltip text={t('championDetail.tooltips.damageShare')} />
                             </span>
                             <span className="text-lg font-bold text-blue-400">{stats.combat.damageShare}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                             <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(stats.combat.damageShare * 2, 100)}%` }} />
                        </div>
                        
                         <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400 flex items-center">
                                {t('championDetail.combat.killParticipation')}
                                <HelperTooltip text={t('championDetail.tooltips.killParticipation')} />
                             </span>
                             <span className="text-lg font-bold text-purple-400">{stats.combat.killParticipation}%</span>
                        </div>
                    </div>
                </div>

                {/* Power Spikes - GATED */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-0 overflow-hidden relative">
                    <PremiumFeatureGate 
                        isPremium={isPremium} 
                        title={t('championDetail.premium.unlockSpikes')} 
                        description={t('championDetail.premium.spikesDesc')}
                        onUpgrade={() => getAnalysisStatus().then(setAnalysisStatus)}
                    >
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xl">📈</span>
                                <h3 className="font-bold text-slate-100 flex items-center">
                                    {t('championDetail.sections.powerSpikes')}
                                    <HelperTooltip text={t('championDetail.tooltips.powerSpikes')} />
                                </h3>
                            </div>
                            <div className="flex items-end justify-between h-32 gap-2 mt-2">
                                {/* Early */}
                                <div className="flex flex-col items-center gap-1 w-1/3 group h-full justify-end">
                                    <div className="relative w-full bg-slate-800/50 rounded-t-lg transition-all" style={{ height: '100%' }}>
                                        <div className="absolute bottom-0 w-full bg-blue-500/50 rounded-t-lg transition-all group-hover:bg-blue-400/60" style={{ height: `${stats.spikes.earlyGame.winRate}%` }}>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100 whitespace-nowrap z-20">
                                                {stats.spikes.earlyGame.winRate}% ({stats.spikes.earlyGame.games}G)
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium mt-1">0-25m</span>
                                </div>

                                {/* Mid */}
                                <div className="flex flex-col items-center gap-1 w-1/3 group h-full justify-end">
                                    <div className="relative w-full bg-slate-800/50 rounded-t-lg transition-all" style={{ height: '100%' }}>
                                        <div className="absolute bottom-0 w-full bg-purple-500/50 rounded-t-lg transition-all group-hover:bg-purple-400/60" style={{ height: `${stats.spikes.midGame.winRate}%` }}>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100 whitespace-nowrap z-20">
                                                {stats.spikes.midGame.winRate}% ({stats.spikes.midGame.games}G)
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium mt-1">25-35m</span>
                                </div>

                                {/* Late */}
                                <div className="flex flex-col items-center gap-1 w-1/3 group h-full justify-end">
                                    <div className="relative w-full bg-slate-800/50 rounded-t-lg transition-all" style={{ height: '100%' }}>
                                        <div className="absolute bottom-0 w-full bg-red-500/50 rounded-t-lg transition-all group-hover:bg-red-400/60" style={{ height: `${stats.spikes.lateGame.winRate}%` }}>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100 whitespace-nowrap z-20">
                                                {stats.spikes.lateGame.winRate}% ({stats.spikes.lateGame.games}G)
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium mt-1">35m+</span>
                                </div>
                            </div>
                        </div>
                    </PremiumFeatureGate>
                </div>
            </div>

            {/* Matchup Analysis - GATED */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-0 relative">
                 <PremiumFeatureGate 
                    isPremium={isPremium} 
                    title={t('championDetail.premium.unlockMatchup')} 
                    description={t('championDetail.premium.matchupDesc')}
                    onUpgrade={() => getAnalysisStatus().then(setAnalysisStatus)}
                >
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-xl font-bold text-slate-100">{t('championDetail.sections.matchupAnalysis')}</h3>
                            <HelperTooltip text={t('championDetail.tooltips.matchupNote')} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">{t('championDetail.matchup.opponent')}</th>
                                        <th className="px-4 py-3">{t('championDetail.matchup.games')}</th>
                                        <th className="px-4 py-3">{t('championDetail.matchup.winRate')}</th>
                                        <th className="px-4 py-3">{t('championDetail.matchup.keyItems')}</th>
                                        <th className="px-4 py-3">{t('championDetail.matchup.goldDiff')}</th>
                                        <th className="px-4 py-3">{t('championDetail.matchup.csDiff')}</th>
                                        <th className="px-4 py-3 text-right rounded-r-lg">{t('championDetail.matchup.killDiff')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {stats.matchups.slice(0, 10).map((matchup) => (
                                        <tr key={matchup.opponentChampion} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden relative border border-slate-600">
                                                        <img src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${matchup.opponentChampion}.png`} alt={matchup.opponentChampion} className="w-full h-full object-cover" />
                                                    </div>
                                                    {matchup.opponentChampion}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{matchup.games}</td>
                                            <td className={`px-4 py-3 font-bold ${matchup.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                {matchup.winRate}%
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    {matchup.keyItems.map(itemId => (
                                                        <div key={itemId} className="w-8 h-8 rounded border border-slate-700 bg-slate-800 overflow-hidden" title={`Item ${itemId}`}>
                                                            <img src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${itemId}.png`} alt={`Item ${itemId}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 ${matchup.goldDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {matchup.goldDiff > 0 ? '+' : ''}{matchup.goldDiff}
                                            </td>
                                            <td className={`px-4 py-3 ${matchup.csDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {matchup.csDiff > 0 ? '+' : ''}{matchup.csDiff}
                                            </td>
                                            <td className={`px-4 py-3 text-right ${matchup.killDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {matchup.killDiff > 0 ? '+' : ''}{matchup.killDiff}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </PremiumFeatureGate>
            </div>
        </div>
    );
}
