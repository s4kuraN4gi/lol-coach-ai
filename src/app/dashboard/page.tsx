"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import ProfileCard from "./components/ProfileCard";
import RankCard from "./components/RankCard";
import LPWidget from "./widgets/LPWidget";
import ChampionPerformance from "./widgets/ChampionPerformance";
import SkillRadar from "./widgets/SkillRadar"; 
import WinConditionWidget from "./widgets/WinConditionWidget";
import NemesisWidget from "./widgets/NemesisWidget";
import LaningPhaseWidget from "./widgets/LaningPhaseWidget";
import ClutchWidget from "./widgets/ClutchWidget";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdSenseBanner from "../Components/ads/AdSenseBanner";

import { useSummoner } from "../Providers/SummonerProvider";
import { useAuth } from "../Providers/AuthProvider";
import { fetchBasicStats, fetchMatchStats, type DashboardStatsDTO } from "@/app/actions/stats";
import DashboardSkeleton from "./components/skeletons/DashboardSkeleton";


export default function DashboardPage() {
    const {activeSummoner, loading:summonerLoading} = useSummoner();
    const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [currentQueue, setCurrentQueue] = useState<"SOLO" | "FLEX">("SOLO");
    const [error, setError] = useState<string | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    
    // Note: ProfileCard logic was moved into ProfileCard component previously or page did logic?
    // Looking at previous file view, ProfileCard took raw props like `rank`, `tier` etc.
    // DashboardStatsDTO contains `rank`.
    // We need to verify ProfileCard props.
    // ProfileCard takes: summonerName, tagLine, level, iconId, tier, rank, lp, wins, losses, currentQueue, onQueueChange.
    // DashboardStatsDTO.rank is a LeagueEntryDTO.

    // Queue selection for ProfileCard (SOLO/FLEX) logic is mostly inside fetchDashboardStats which prioritizes SOLO.
    // However, ProfileCard allows switching queue? 
    // `fetchDashboardStats` should return ALL ranks or the Page should handle switching.
    // The previous implementation fetched ALL ranks.
    // `fetchDashboardStats` currently returns `rank: LeagueEntryDTO | null`.
    // Just one rank.
    // Let's modify `fetchDashboardStats` or just stick to SOLO priority for specific widgets, but ProfileCard needs flexibility?
    // Actually, user wants LP Progression Widget. That widget usually tracks the Main Queue (Solo).
    // Let's stick to prioritizing Solo for the Dashboard Overview.
    // If refined, `stats.ts` should return `ranks: LeagueEntryDTO[]` and we filter in client.
    // But for now let's use what `stats.ts` provides (the best rank).

    const router = useRouter();
    const {user, loading: authLoading} = useAuth();

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // データ取得
    const fetchData = useCallback(async () => {
        if (!activeSummoner) return;
        
        // Don't set state if unmounted (though this check is early, the updates later matter more)
        if (!isMounted.current) return;

        setIsFetching(true);
        setError(null);
        setDebugLogs(["[Client] Starting Progressive Refresh...", `[Client] PUUID: ${activeSummoner.puuid?.slice(0,10)}...`]);
        console.log("Start Dashboard Refresh...");

        const { puuid, summoner_id } = activeSummoner;
        
        if (!puuid) {
            console.warn("[Dashboard] Active Summoner Incomplete:", activeSummoner);
            if (isMounted.current) {
                setError("アカウント情報が不完全です（PUUID欠落）。アカウントを再連携してください。");
                setDebugLogs(prev => [...prev, "[Client] Error: Missing PUUID"]);
                setIsFetching(false);
            }
            return;
        }

        try {
            console.log("Fetching basic stats for", puuid);
            if (isMounted.current) setDebugLogs(prev => [...prev, "[Client] Requesting Server Action (Basic Stats)..."]);
            
            // Start both fetches in parallel
            const basicPromise = fetchBasicStats(puuid, summoner_id);
            const matchPromise = fetchMatchStats(puuid);

            // Await basic stats first
            const basicData = await basicPromise;
            if (!isMounted.current) return; // Cleanup Check

            console.log("Fetched Basic Stats Result:", JSON.stringify(basicData, null, 2));
            
            // Construct partial state for immediate rendering of profile/rank
            const partialStats: DashboardStatsDTO = {
                ranks: basicData.ranks,
                recentMatches: [], // Empty until match data arrives
                championStats: [],
                radarStats: null,
                uniqueStats: null,
                debugLog: basicData.debugLog || []
            };
            setStats(partialStats); // Update state to show basic info
            
            // Auto-select Queue based on available ranks from basicData
            const hasSolo = basicData.ranks.some((r: any) => r.queueType === "RANKED_SOLO_5x5");
            const hasFlex = basicData.ranks.some((r: any) => r.queueType === "RANKED_FLEX_SR");
            
            if (!hasSolo && hasFlex) {
                 setCurrentQueue("FLEX");
                 console.log("[Dashboard] Auto-switched to FLEX (No Solo Rank found)");
            } else if (hasSolo) {
                 setCurrentQueue("SOLO");
            }

            setDebugLogs(prev => [
                ...prev, 
                `[Client] Basic Stats Received. Ranks: ${basicData.ranks.length}`,
            ]);

            // Now await match stats
            console.log("Fetching match stats for", puuid);
            if (isMounted.current) setDebugLogs(prev => [...prev, "[Client] Requesting Server Action (Match Stats)..."]);
            const matchData = await matchPromise;
            if (!isMounted.current) return; // Cleanup Check

            console.log("Fetched Match Stats Result:", JSON.stringify(matchData, null, 2));
            
            // Merge match data into existing stats
            setStats(prev => prev ? {
                ...prev,
                ...matchData,
                debugLog: [...prev.debugLog, ...(matchData.debugLog || [])]
            } : null);

            setDebugLogs(prev => [
                ...prev, 
                `[Client] Match Stats Received. matches=${matchData.recentMatches.length}`,
                ...(matchData.debugLog || ["[Client] Warn: matchData.debugLog is missing/empty"])
            ]);
            
            if (matchData.recentMatches.length === 0) {
                setError("直近の対戦データが見つかりませんでした。(JPサーバーでプレイしていますか？)");
            }

        } catch (error: any) {
            console.error("Failed to fetch dashboard stats", error);
            if (isMounted.current) {
                setError("データの取得に失敗しました。時間をおいて再試行してください。");
                setDebugLogs(prev => [...prev, `[Client] Exception: ${error.message || error}`]);
            }
        }
        
        if (isMounted.current) setIsFetching(false);
    }, [activeSummoner]);

    useEffect(() => {
        if(activeSummoner && !stats) { 
            fetchData();
        }
    }, [activeSummoner]); 

    // Filter Rank based on Queue Selection
    const displayedRank = stats?.ranks?.find(r => 
        currentQueue === "SOLO" ? r.queueType === "RANKED_SOLO_5x5" : r.queueType === "RANKED_FLEX_SR"
    ) || null;

    // Determine if match-related data has loaded
    const matchesLoaded = stats?.radarStats !== null;

    if (authLoading || summonerLoading || (!stats && isFetching)) {
         return (
            <DashboardLayout>
                <DashboardSkeleton />
            </DashboardLayout>
         )
    }

    if (stats && matchesLoaded && stats.recentMatches.length === 0) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                    <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg w-full">
                        <div className="text-4xl mb-4">📭</div>
                        <h2 className="text-xl font-bold text-white mb-2">対戦データが見つかりませんでした</h2>
                        <p className="text-slate-400 mb-6">
                            連携されたアカウントの直近の対戦履歴（過去10戦）が存在しないか、取得できませんでした。
                        </p>
                        
                         <button 
                            onClick={fetchData} 
                            className="bg-primary-500 hover:bg-primary-600 px-6 py-2 rounded-lg text-white font-bold transition-colors w-full"
                        >
                            再試行
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if(!user) return null;
    if (!activeSummoner) {
        return (
            <DashboardLayout>
                <div className="text-center py-20">
                    <h2 className="text-xl font-bold mb-4">サモナーアカウントが連携されていません</h2>
                    <button onClick={() => router.push('/account')} className="bg-primary-500 hover:bg-primary-600 px-6 py-2 rounded-lg">
                        アカウント連携へ
                    </button>
                </div>
            </DashboardLayout>
        )
    }

  return (
    <>
      <DashboardLayout>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">Dashboard</h1>
                <p className="text-slate-400 text-sm">Your Growth Center</p>
            </div>
            <div className="flex justify-end">
                <button 
                    onClick={() => {
                        fetchData();
                    }}
                    className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg transition shadow-lg hover:shadow-blue-500/10 flex items-center gap-2"
                    disabled={isFetching}
                >
                    {isFetching ? (
                        <>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span> 更新中...
                        </>
                    ) : (
                        "↻ データを更新"
                    )}
                </button>
            </div>
        </div>

        {/* AdSense Top Banner */}
        <div className="mb-6 flex justify-center">
             <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" />
        </div>

        {/* Row 1: Profile & LP Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ProfileCard summoner={{
                name: activeSummoner.summoner_name,
                tagLine: activeSummoner.tag_line,
                profileIconId: activeSummoner.profile_icon_id || 29,
                summonerLevel: activeSummoner.summoner_level || 0
            }} />

            {matchesLoaded ? (
                <LPWidget rank={displayedRank} recentMatches={stats?.recentMatches || []} />
            ) : (
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-48 animate-pulse"></div>
            )}
        </div>

        {/* Row 2: Champion Performance & Skill Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {matchesLoaded ? (
                <ChampionPerformance stats={stats?.championStats || []} />
            ) : (
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-72 animate-pulse"></div>
            )}
            {matchesLoaded ? (
                <SkillRadar stats={stats?.radarStats || null} />
            ) : (
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-72 animate-pulse"></div>
            )}
        </div>

        {/* Row 3: Unique Analysis (A, B, C, D) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {matchesLoaded ? (
                <>
                    <WinConditionWidget stats={stats?.uniqueStats || null} />
                    <LaningPhaseWidget stats={stats?.uniqueStats || null} matchCount={stats?.recentMatches.length || 0} />
                    <NemesisWidget stats={stats?.uniqueStats || null} />
                    <ClutchWidget stats={stats?.uniqueStats || null} />
                </>
            ) : (
                <>
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-48 animate-pulse"></div>
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-48 animate-pulse"></div>
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-48 animate-pulse"></div>
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 h-48 animate-pulse"></div>
                </>
            )}
        </div>

        {/* AdSense Bottom Banner */}
        <div className="mt-8 flex justify-center">
             <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" />
        </div>

      </DashboardLayout>
    </>
  );
}
