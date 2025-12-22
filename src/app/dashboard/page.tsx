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
import { type MatchStatsDTO, type BasicStatsDTO } from "@/app/actions/stats";
import DashboardSkeleton from "./components/skeletons/DashboardSkeleton";
import DashboardUpdater from "./components/DashboardUpdater";

type DashboardStatsDTO = MatchStatsDTO & BasicStatsDTO;

export default function DashboardPage() {
    const {activeSummoner, loading:summonerLoading} = useSummoner();
    const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [currentQueue, setCurrentQueue] = useState<"SOLO" | "FLEX">("SOLO");
    const [error, setError] = useState<string | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    
    // ... (rest of logic) ...

    const router = useRouter();
    const {user, loading: authLoading} = useAuth();

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // データ取得 (Cache-First)
    const fetchData = useCallback(async () => {
        if (!activeSummoner || !isMounted.current) return;

        setIsFetching(true);
        setError(null);
        setDebugLogs(["[Client] Loading Cached Data..."]);

        const { puuid } = activeSummoner;
        
        if (!puuid) {
            if (isMounted.current) {
                setError("アカウント情報が不完全です（PUUID欠落）。アカウントを再連携してください。");
                setIsFetching(false);
            }
            return;
        }

        try {
            // Server Action: Get Everything from DB
            const { getStatsFromCache } = await import('@/app/actions/stats');
            const data = await getStatsFromCache(puuid);
            
            if (!isMounted.current) return;

            setStats(data);
            
            // Auto-select Queue
            const hasSolo = data.ranks.some((r: any) => r.queueType === "RANKED_SOLO_5x5");
            const hasFlex = data.ranks.some((r: any) => r.queueType === "RANKED_FLEX_SR");
            
            if (!hasSolo && hasFlex) setCurrentQueue("FLEX");
            else if (hasSolo) setCurrentQueue("SOLO");

            setDebugLogs(prev => [...prev, `[Client] Cache Loaded. Matches: ${data.recentMatches.length}`]);

        } catch (error: any) {
            console.error("Failed to fetch dashboard stats", error);
            if (isMounted.current) {
                setError("データの読み込みに失敗しました。");
                setDebugLogs(prev => [...prev, `[Client] Error: ${error.message}`]);
            }
        }
        
        if (isMounted.current) setIsFetching(false);
    }, [activeSummoner]);

    useEffect(() => {
        if(activeSummoner && !stats) { 
            fetchData();
        }
    }, [activeSummoner]); 

    // Manual Refresh Handler (Force Full Update)
    const handleManualRefresh = async () => {
        if (!activeSummoner?.puuid) return;
        setIsFetching(true);
         try {
            const { performFullUpdate } = await import('@/app/actions/stats');
            await performFullUpdate(activeSummoner.puuid);
            await fetchData(); // Reload Cache
            router.refresh();
        } catch (e) {
            console.error(e);
        }
        setIsFetching(false);
    };

    // Filter Rank based on Queue Selection
    const displayedRank = stats?.ranks?.find(r => 
        currentQueue === "SOLO" ? r.queueType === "RANKED_SOLO_5x5" : r.queueType === "RANKED_FLEX_SR"
    ) || null;

    // Determine if match-related data has loaded (simply check if stats exists now, as it's all-or-nothing from cache)
    const matchesLoaded = stats !== null;

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
                            連携されたアカウントの直近の対戦履歴（過去10戦）が存在しないか、キャッシュされていません。
                        </p>
                        
                         <button 
                            onClick={handleManualRefresh} 
                            disabled={isFetching}
                            className="bg-primary-500 hover:bg-primary-600 px-6 py-2 rounded-lg text-white font-bold transition-colors w-full"
                        >
                            {isFetching ? "更新中..." : "データを取得 (API)"}
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
        {activeSummoner.puuid && <DashboardUpdater puuid={activeSummoner.puuid} />}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">Dashboard</h1>
                <p className="text-slate-400 text-sm">Your Growth Center</p>
            </div>
            <div className="flex justify-end">
                <button 
                    onClick={handleManualRefresh}
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
