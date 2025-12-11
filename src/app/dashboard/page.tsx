"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import ProfileCard from "./components/ProfileCard";
import LPWidget from "./widgets/LPWidget";
import ChampionPerformance from "./widgets/ChampionPerformance";
import SkillRadar from "./widgets/SkillRadar"; 
import WinConditionWidget from "./widgets/WinConditionWidget";
import NemesisWidget from "./widgets/NemesisWidget";
import SurvivalWidget from "./widgets/SurvivalWidget";
import ClutchWidget from "./widgets/ClutchWidget";
import { useRouter } from "next/navigation";


import { useSummoner } from "../Providers/SummonerProvider";
import { useAuth } from "../Providers/AuthProvider";
import { fetchDashboardStats, type DashboardStatsDTO } from "../actions/stats";

export default function DashboardPage() {
    const {activeSummoner, loading:summonerLoading} = useSummoner();
    const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [currentQueue, setCurrentQueue] = useState<"SOLO" | "FLEX">("SOLO");
    const [error, setError] = useState<string | null>(null);
    
    // Note: ProfileCard logic was moved into ProfileCard component previously or page did logic?
    // Looking at previous file view, ProfileCard took raw props like `rank`, `tier` etc.
    // DashboardStatsDTO contains `rank`.
    // We need to verify ProfileCard props.
    // ProfileCard takes: summonerName, tagLine, level, iconId, tier, rank, lp, wins, losses, currentQueue, onQueueChange.
    // DashboardStatsDTO.rank is a LeagueEntryDTO.

    // Queue selection for ProfileCard (SOLO/FLEX) logic is mostly inside fetchDashboardStats which prioritizes SOLO.
    // However, ProfileCard allows switching queue? 
    // `fetchDashboardStats` returns a SINGLE rank (prioritized).
    // If we want to support switching, `fetchDashboardStats` should return ALL ranks or the Page should handle switching.
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

    // データ取得
    const fetchData = useCallback(async () => {
        if (!activeSummoner) return;
        setIsFetching(true);
        setError(null);
        console.log("Start Dashboard Refresh...");


        const { puuid, summoner_id } = activeSummoner;

        if (!summoner_id || !puuid) {
            console.error("Summoner ID or PUUID missing");
            setIsFetching(false);
            return;
        }

        try {
            console.log("Fetching stats for", puuid);
            const data = await fetchDashboardStats(puuid, summoner_id);
            console.log("Fetched Stats Result:", JSON.stringify(data, null, 2));
            setStats(data);
            
            if (data.recentMatches.length === 0) {
                setError("直近の対戦データが見つかりませんでした。(JPサーバーでプレイしていますか？)");
            }

        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
            setError("データの取得に失敗しました。時間をおいて再試行してください。");
        }
        
        setIsFetching(false);
    }, [activeSummoner]);

    useEffect(() => {
        if(activeSummoner && !stats) { // Only fetch if not already fetched? Or always on mount?
            fetchData();
        }
    }, [activeSummoner]); // removed fetchData from dep array to avoid loops, though useCallback handles it.

    // Filter Rank based on Queue Selection
    const displayedRank = stats?.ranks?.find(r => 
        currentQueue === "SOLO" ? r.queueType === "RANKED_SOLO_5x5" : r.queueType === "RANKED_FLEX_SR"
    ) || null;

    if (authLoading || summonerLoading || (!stats && isFetching)) {
         return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[60vh]">
                   <div className="text-center">
                       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                       <p className="text-slate-400 animate-pulse">Analyzing Battle Data...</p>
                   </div>
                </div>
            </DashboardLayout>
         )
    }

    if (stats && stats.recentMatches.length === 0) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                    <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg">
                        <div className="text-4xl mb-4">📭</div>
                        <h2 className="text-xl font-bold text-white mb-2">対戦データが見つかりませんでした</h2>
                        <p className="text-slate-400 mb-6">
                            連携されたアカウントの直近の対戦履歴（過去10戦）が存在しないか、取得できませんでした。
                        </p>
                        <div className="text-left text-sm text-slate-500 space-y-2 mb-6 bg-slate-900 p-4 rounded">
                            <p>考えられる原因：</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                                <li>Riot APIキーが無効/期限切れ</li>
                                <li>JPサーバー以外のアカウント</li>
                                <li>長期間対戦を行っていない</li>
                            </ul>
                        </div>
                         <button 
                            onClick={fetchData} 
                            className="bg-primary-500 hover:bg-primary-600 px-6 py-2 rounded-lg text-white font-bold transition-colors"
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


        {/* Row 1: Profile & LP Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ProfileCard 
                summonerName={activeSummoner.summoner_name}
                tagLine={activeSummoner.tag_line}
                level={activeSummoner.summoner_level || 0}
                iconId={activeSummoner.profile_icon_id || 29}
                tier={displayedRank?.tier}
                rank={displayedRank?.rank}
                lp={displayedRank?.leaguePoints}
                wins={displayedRank?.wins}
                losses={displayedRank?.losses}
                currentQueue={currentQueue}
                onQueueChange={(q) => setCurrentQueue(q as "SOLO" | "FLEX")}
            />

            <LPWidget rank={displayedRank} recentMatches={stats?.recentMatches || []} />
        </div>



        {/* Row 2: Champion Performance & Skill Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChampionPerformance stats={stats?.championStats || []} />
            <SkillRadar stats={stats?.radarStats || null} />
        </div>

        {/* Row 3: Unique Analysis (A, B, C, D) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="space-y-6">
                 <WinConditionWidget stats={stats?.uniqueStats || null} />
                 <SurvivalWidget stats={stats?.uniqueStats || null} />
             </div>
             <div className="space-y-6">
                 <NemesisWidget stats={stats?.uniqueStats || null} />
                 <ClutchWidget stats={stats?.uniqueStats || null} />
             </div>
        </div>

        
      </DashboardLayout>
    </>
  );
}
