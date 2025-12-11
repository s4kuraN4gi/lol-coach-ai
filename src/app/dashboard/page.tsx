'use client'

import { useState, useEffect, useCallback } from "react";
import SummonerCard from "../Components/SummonerCard";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import HistoryList from "./components/HistoryList";
import RankGraph from "./components/RankGraph";
import ProfileCard from "./components/ProfileCard";
import { useRouter } from "next/navigation";
import { useSummoner } from "../Providers/SummonerProvider";
import { useAuth } from "../Providers/AuthProvider";
import { fetchRank, fetchMatchIds, fetchMatchDetail, type LeagueEntryDTO } from "../actions/riot";
import { analyzeMatch } from "../actions/analysis"; 

type HistoryItem = {
    id: string;
    date: string;
    selectedSummoner: string;
    champion: string;
    role: string;
    result: string;
    kda: string;
    aiAdvice: string;
    // For Radar Chart
    gameDuration: number;
    cs: number;       // totalMinionsKilled + neutralMinionsKilled
    vision: number;   // visionScore
    damage: number;   // totalDamageDealtToChampions
    gold: number;     // goldEarned
}


export default function DashboardPage() {
    const {activeSummoner, loading:summonerLoading} = useSummoner();
    const [histories, setHistories] = useState<HistoryItem[]>([])
    const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)
    const [allRanks, setAllRanks] = useState<LeagueEntryDTO[]>([]);
    const [selectedQueue, setSelectedQueue] = useState<"SOLO" | "FLEX">("SOLO");
    const [historyFilter, setHistoryFilter] = useState<"ALL" | "SOLO" | "FLEX" | "NORMAL" | "ARAM">("ALL");
    const [isFetching, setIsFetching] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // 選択中のキューに応じたランクデータを算出
    const rankData = allRanks.find(r => 
        selectedQueue === "SOLO" 
            ? r.queueType === "RANKED_SOLO_5x5" 
            : r.queueType === "RANKED_FLEX_SR"
    ) || null;

    const router = useRouter();
    const {user, loading: authLoading} = useAuth();

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // データ取得
    const fetchData = useCallback(async () => {
        if (!activeSummoner) return;
        setIsFetching(true);
        setErrorMsg(null);

        // 1. ランク情報の取得 (独立して実行)
        const fetchRankJob = async () => {
            if (activeSummoner.summoner_id) {
               try {
                   const ranks = await fetchRank(activeSummoner.summoner_id);
                   setAllRanks(ranks);
               } catch (e) {
                   console.error("Rank fetch error", e);
               }
            }
        };

        // 2. マッチ履歴の取得 (独立して実行)
        const fetchHistoryJob = async () => {
            if (activeSummoner.puuid) {
                try {
                    let queueId: number | undefined;
                    let type: string | undefined;

                    switch (historyFilter) {
                        case "SOLO": queueId = 420; break;
                        case "FLEX": queueId = 440; break;
                        case "ARAM": queueId = 450; break;
                        case "NORMAL": type = "normal"; break;
                        default: break; // ALL
                    }

                    const matchIdsRes = await fetchMatchIds(activeSummoner.puuid, 5, queueId, type); // 直近5件
                    
                    if(!matchIdsRes.success || !matchIdsRes.data) {
                        if (matchIdsRes.error !== "No PUUID") {
                            setErrorMsg(matchIdsRes.error || "Failed to fetch Match IDs");
                        }
                    } else {
                        const matchIds = matchIdsRes.data;
                        if(matchIds.length === 0) {
                            setErrorMsg("履歴が見つかりませんでした (Region: Asia/JP)");
                            setHistories([]); // 検索結果0件としてクリア
                        } else {
                            // Match Detail取得
                            const matchPromises = matchIds.map(id => fetchMatchDetail(id));
                            const matchesRes = await Promise.all(matchPromises);
                            
                            const formattedHistories: HistoryItem[] = matchesRes
                                .filter(res => res.success && res.data)
                                .map(res => res.data) // Extract data
                                .map((m: any) => {
                                    // 自分のPUUIDに一致する参加者を探す
                                    const participant = m.info.participants.find((p: any) => p.puuid === activeSummoner.puuid);
                                    if (!participant) return null;

                                    const date = new Date(m.info.gameCreation).toLocaleDateString();
                                    const duration = m.info.gameDuration || 1800; // seconds
                                    
                                    return {
                                        id: m.metadata.matchId,
                                        date: date,
                                        selectedSummoner: participant.summonerName,
                                        champion: participant.championName,
                                        role: participant.teamPosition || "ARAM", // アリーナ等は空の場合も
                                        result: participant.win ? "Win" : "Loss",
                                        kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
                                        aiAdvice: "", // まだ解析していないので空
                                        // Stats for Radar Chart
                                        gameDuration: duration,
                                        cs: (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0),
                                        vision: participant.visionScore || 0,
                                        damage: participant.totalDamageDealtToChampions || 0,
                                        gold: participant.goldEarned || 0
                                    }
                                })
                                .filter((item): item is HistoryItem => item !== null);

                            setHistories(formattedHistories);
                            // フィルタリング時はローカルストレージを上書きしない方が良いかもしれないが、
                            // UX的には「最後に見たリスト」を保存したいので上書きでOK。
                            // ただしキーを分ける実装まではしない（簡易化のため）
                            localStorage.setItem(`matches_${activeSummoner.summoner_name}`, JSON.stringify(formattedHistories));
                        }
                    }
                } catch (e) {
                     console.error("Match fetch error", e);
                     setErrorMsg("Failed to load match history");
                }
            } else {
                setErrorMsg("No PUUID found for active summoner.");
            }
        };

        // 並列実行開始（互いを待たない）
        await Promise.all([fetchRankJob(), fetchHistoryJob()]);
        
        setIsFetching(false);
    }, [activeSummoner, historyFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // AI解析を実行
    const handleAnalyze = async () => {
        if (!selectedHistory) return;
        setIsAnalyzing(true);
        try {
            const res = await analyzeMatch(
                selectedHistory.id,
                selectedHistory.selectedSummoner,
                selectedHistory.champion,
                selectedHistory.kda,
                selectedHistory.result === "Win"
            );

            if (res.success && res.advice) {
                // 成功したらローカルの履歴データを更新して表示に反映
                const updatedHistory = { ...selectedHistory, aiAdvice: res.advice };
                setSelectedHistory(updatedHistory);

                // リストの方も更新（次回選択時に反映されるように）
                setHistories(prev => prev.map(h => h.id === selectedHistory.id ? updatedHistory : h));
                
                // localStorageも更新
                const stored = JSON.parse(localStorage.getItem(`matches_${activeSummoner?.summoner_name}`) || "[]");
                const updatedStored = stored.map((h: HistoryItem) => h.id === selectedHistory.id ? updatedHistory : h);
                localStorage.setItem(`matches_${activeSummoner?.summoner_name}`, JSON.stringify(updatedStored));
            } else {
                alert("解析に失敗しました: " + (res.error || "Unknown Error"));
            }
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました");
        } finally {
            setIsAnalyzing(false);
        }
    };


    if (authLoading || summonerLoading) {
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
                DASHBOARD
            </h1>
            <button 
                onClick={() => {
                    localStorage.removeItem(`matches_${activeSummoner.summoner_name}`);
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* サモナー情報 (ProfileCard) */}
            <ProfileCard 
                summonerName={activeSummoner.summoner_name}
                tagLine={activeSummoner.tag_line}
                level={activeSummoner.summoner_level || 0}
                iconId={activeSummoner.profile_icon_id || 29}
                tier={rankData?.tier}
                rank={rankData?.rank}
                lp={rankData?.leaguePoints}
                wins={rankData?.wins}
                losses={rankData?.losses}
                currentQueue={selectedQueue}
                onQueueChange={setSelectedQueue}
            />

            {/* ランク推移グラフ & プレイスタイル分析 */}
            <RankGraph histories={histories} />
        </div>
        {/* 履歴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="border-r border-slate-800 pr-6 overflow-y-auto h-[75vh] custom-scrollbar">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2 mb-2 sm:mb-0">
                        <span className="w-1.5 h-6 bg-yellow-500 rounded-full"></span> 
                        RECENT MATCHES
                    </h3>
                    
                    <div className="flex bg-slate-900/80 rounded-lg p-1 border border-slate-700 overflow-x-auto max-w-full">
                        {(["ALL", "SOLO", "FLEX", "NORMAL", "ARAM"] as const).map((mode) => (
                             <button 
                                key={mode}
                                onClick={() => setHistoryFilter(mode)}
                                className={`px-3 py-1 text-xs font-bold rounded-md whitespace-nowrap transition ${
                                    historyFilter === mode 
                                    ? "bg-blue-600 text-white shadow-md" 
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
                    {errorMsg && (
                        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{errorMsg}</span>
                        </div>
                    )}
                    {histories.length === 0 && !isFetching && !errorMsg && <p className="text-slate-500 italic">履歴が見つかりません。</p>}
                    
                    <HistoryList 
                        histories={histories}
                        onSelect={(item) => setSelectedHistory(item)}
                        selectedHistory={selectedHistory}
                    />
                </div>
                    <div className="pl-6">
                        {selectedHistory ? (
                            <div className="glass-panel p-6 rounded-xl animate-fadeIn">
                                <SummonerCard 
                                    selectedSummoner={selectedHistory.selectedSummoner}
                                    championName={selectedHistory.champion}
                                    kills={parseInt(selectedHistory.kda.split("/")[0])}
                                    deaths={parseInt(selectedHistory.kda.split("/")[1])}
                                    assists={parseInt(selectedHistory.kda.split("/")[2])}
                                    win={selectedHistory.result === "Win"}
                                    gameDuration={1800}
                                />
                                <div className="mt-6 p-6 bg-slate-900/50 border border-slate-700/50 rounded-xl text-left relative overflow-hidden">
                                     {/* AI Glow */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                                    <h4 className="font-bold text-blue-300 mb-4 flex items-center gap-2 text-lg">
                                        <span className="text-2xl">🤖</span> AI COACH ANALYSIS
                                    </h4>
                                    {selectedHistory.aiAdvice
                                     ? selectedHistory.aiAdvice.split("\n").map((line, index) => (
                                        <p
                                            key={index}
                                            className={`mb-3 tracking-wide leading-relaxed ${
                                            line.startsWith("1.") ||
                                            line.startsWith("2.") ||
                                            line.startsWith("3.") 
                                                ? "font-bold text-yellow-200 mt-4 text-base border-l-2 border-yellow-500 pl-3"
                                                : "text-slate-300 text-sm"
                                            }`}
                                        >
                                            {line}
                                        </p>
                                        ))
                                        : (
                                            <div className="text-center py-8">
                                                <p className="text-slate-500 mb-6 font-mono text-sm">AI analysis not generated yet.</p>
                                                <button 
                                                    onClick={() => router.push(`/dashboard/match/${selectedHistory.id}`)}
                                                    className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm px-6 py-3 rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 transition-all border border-blue-400/20"
                                                >
                                                    ✨ VIEW TIMELINE & AI ANALYSIS
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ):(
                            <div className="mt-20 p-10 border-2 border-dashed border-slate-700 rounded-xl text-center bg-slate-800/30">
                                <p className="text-slate-400 mb-2 font-medium">👈 SELECT A MATCH FROM THE LIST</p>
                                <p className="text-sm text-slate-600">to view detailed stats and AI coaching advice</p>
                            </div>
                        )}
                    </div>
        </div>
      </DashboardLayout>
    </>
  );
}
