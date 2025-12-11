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



        const { puuid, summoner_id } = activeSummoner;

        if (!summoner_id || !puuid) {
            console.error("Summoner ID or PUUID missing");
            setIsFetching(false);
            return;
        }

        try {
            const data = await fetchDashboardStats(puuid, summoner_id);
            setStats(data);
        } catch (error) {

            console.error("Failed to fetch dashboard stats", error);
        }

        
        setIsFetching(false);
    }, [activeSummoner]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (authLoading || summonerLoading || (!stats && isFetching)) {
         return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingAnimation />
                </div>
            </DashboardLayout>
         )
    }
    if(!user) return null;
    if (!activeSummoner) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-6">
                        WELCOME TO LOL COACH AI
                    </h2>
                    <p className="text-slate-400 mb-8 max-w-md">
                        まずはあなたのRiotアカウントを連携して、<br/>
                        AIコーチングを始めましょう。
                    </p>
                    <div className="p-8 bg-slate-900/50 border border-slate-700 rounded-2xl max-w-md w-full">
                         <p className="text-sm text-slate-500 mb-4">サイドメニューの「アカウント」から連携できます</p>
                         <button 
                            onClick={() => router.push("/account")}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
                         >
                            アカウント設定へ移動
                         </button>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

  return (
    <>
      <DashboardLayout>
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
                DASHBOARD <span className="text-sm font-normal text-slate-500 not-italic ml-2 tracking-normal">Your Growth Center</span>
            </h1>
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

        {/* Row 1: Profile & LP Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ProfileCard 
                summonerName={activeSummoner.summoner_name}
                tagLine={activeSummoner.tag_line}
                level={activeSummoner.summoner_level || 0}
                iconId={activeSummoner.profile_icon_id || 29}
                tier={stats?.rank?.tier}
                rank={stats?.rank?.rank}
                lp={stats?.rank?.leaguePoints}
                wins={stats?.rank?.wins}
                losses={stats?.rank?.losses}
                currentQueue={"SOLO"} // Stats returns prioritized rank
                onQueueChange={() => {}} // Disabled for now as stats only returns one rank
            />

            <LPWidget rank={stats?.rank || null} recentMatches={stats?.recentMatches || []} />
        </div>

        {/* Row 2: Champion Performance & Future Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChampionPerformance stats={stats?.championStats || []} />
            
            {/* Placeholder for Skill Radar / Unique Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
                <div className="text-5xl mb-4 opacity-50">🚧</div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">More Analytics Coming Soon</h3>
                <p className="text-slate-500 max-w-sm">
                    Skill Radar, Personal Win Conditions, and Nemesis Analysis are being implemented.
                </p>
            </div>
        </div>
        
      </DashboardLayout>
    </>
  );
}
