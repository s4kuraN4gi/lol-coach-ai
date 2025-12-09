'use client'

import { useState, useEffect, useCallback } from "react";
import SummonerCard from "../Components/SummonerCard";
import DashboardLayout from "../Components/layout/DashboardLayout";
import HistoryList from "./components/HistoryList";
import RankGraph from "./components/RankGraph";
import ProfileCard from "./components/ProfileCard"; // New component
import { useRouter } from "next/navigation";
import { useSummoner } from "../Providers/SummonerProvider";
import { useAuth } from "../Providers/AuthProvider";
import { fetchRank, fetchMatchIds, fetchMatchDetail, type LeagueEntryDTO } from "../actions/riot";

type HistoryItem = {
    id: string;
    date: string;
    selectedSummoner: string;
    champion: string;
    role: string;
    result: string;
    kda: string;
    aiAdvice: string;
}

export default function DashboardPage() {
    const {activeSummoner, loading:summonerLoading} = useSummoner();
    const [histories, setHistories] = useState<HistoryItem[]>([])
    const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)
    const [rankData, setRankData] = useState<LeagueEntryDTO | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    
    const router = useRouter();
    const {user, loading: authLoading} = useAuth();

    // データ取得
    const fetchData = useCallback(async () => {
        if (!activeSummoner) return;
        setIsFetching(true);

        try {
            // 1. ランク情報の取得 (SummonerIDが必要)
            if (activeSummoner.summoner_id) {
                const ranks = await fetchRank(activeSummoner.summoner_id);
                // SOLO/DUOのランクを優先表示、なければFLEX
                const solo = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");
                const flex = ranks.find(r => r.queueType === "RANKED_FLEX_SR");
                setRankData(solo || flex || null);
            }

            // 2. マッチ履歴の取得 (PUUIDが必要)
            // すでにデータがある場合は再取得しない（簡易キャッシュ）
            const stored = localStorage.getItem(`matches_${activeSummoner.summoner_name}`);
            if (stored) {
                setHistories(JSON.parse(stored));
                setIsFetching(false);
                // バックグラウンドで更新してもいいが、API制限節約のため今回はここでおしまい
                return; 
            }

            if (activeSummoner.puuid) {
                const matchIds = await fetchMatchIds(activeSummoner.puuid, 5); // 直近5件
                const matchPromises = matchIds.map(id => fetchMatchDetail(id));
                const matches = await Promise.all(matchPromises);
                
                const formattedHistories: HistoryItem[] = matches
                    .filter(m => m !== null)
                    .map((m: any) => {
                        // 自分のPUUIDに一致する参加者を探す
                        const participant = m.info.participants.find((p: any) => p.puuid === activeSummoner.puuid);
                        if (!participant) return null;

                        const date = new Date(m.info.gameCreation).toLocaleDateString();
                        
                        return {
                            id: m.metadata.matchId,
                            date: date,
                            selectedSummoner: participant.summonerName,
                            champion: participant.championName,
                            role: participant.teamPosition || "ARAM", // アリーナ等は空の場合も
                            result: participant.win ? "Win" : "Loss",
                            kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
                            aiAdvice: "" // まだ解析していないので空
                        }
                    })
                    .filter((item): item is HistoryItem => item !== null);

                setHistories(formattedHistories);
                localStorage.setItem(`matches_${activeSummoner.summoner_name}`, JSON.stringify(formattedHistories));
            }

        } catch (e) {
            console.error("Failed to fetch dashboard data", e);
        } finally {
            setIsFetching(false);
        }
    }, [activeSummoner]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    if (authLoading || summonerLoading) {
         return <div className="p-10 text-center mt-10">読み込み中...</div>
    }
    if(!user) return null;
    if (!activeSummoner) return null;

  return (
    <>
      <DashboardLayout>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">
                ダッシュボード
            </h1>
            <button 
                onClick={() => {
                    localStorage.removeItem(`matches_${activeSummoner.summoner_name}`);
                    fetchData();
                }}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition"
                disabled={isFetching}
            >
                {isFetching ? "更新中..." : "データを更新"}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* サモナー情報 (ProfileCard) */}
            <ProfileCard 
                summonerName={activeSummoner.summoner_name}
                tagLine={activeSummoner.tag_line}
                level={activeSummoner.summoner_level || 0}
                iconId={activeSummoner.profile_icon_id || 29} // Default icon
                tier={rankData?.tier}
                rank={rankData?.rank}
                lp={rankData?.leaguePoints}
                wins={rankData?.wins}
                losses={rankData?.losses}
            />

            {/* ランク推移グラフ (Mockのまま) */}
            <RankGraph />
        </div>
        {/* 履歴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="border-r pr-4 overflow-y-auto h-[75vh]">
                    <h3 className="text-2xl font-semibold mb-4">直近の対戦履歴</h3>
                    {histories.length === 0 && !isFetching && <p className="text-gray-500">履歴が見つかりません。</p>}
                    
                    <HistoryList 
                        histories={histories}
                        onSelect={(item) => setSelectedHistory(item)}
                        selectedHistory={selectedHistory}
                    />
                </div>
                    <div className="pl-4">
                        {selectedHistory ? (
                            <>
                                <SummonerCard 
                                    selectedSummoner={selectedHistory.selectedSummoner}
                                    championName={selectedHistory.champion}
                                    kills={parseInt(selectedHistory.kda.split("/")[0])}
                                    deaths={parseInt(selectedHistory.kda.split("/")[1])}
                                    assists={parseInt(selectedHistory.kda.split("/")[2])}
                                    win={selectedHistory.result === "Win"}
                                    gameDuration={1800} // APIから取れるが一旦省略
                                />
                                <div className="mt-4 p-4 bg-gray-50 border rounded-lg text-left">
                                    <h4 className="font-semibold text-gray-700 mb-2">AI コーチのアドバイス</h4>
                                    {selectedHistory.aiAdvice
                                     ? selectedHistory.aiAdvice.split("/n").map((line, index) => (
                                        <p
                                            key={index}
                                            className={`mb-2 whitespace-pre-wrap ${
                                            line.startsWith("🏹") ||
                                            line.startsWith("💡") ||
                                            line.startsWith("🔥") ||
                                            line.startsWith("💬")
                                                ? "font-semibold text-blue-600 mt-4"
                                                : "text-gray-700"
                                            }`}
                                        >
                                            {line}
                                        </p>
                                        ))
                                        : (
                                            <div>
                                                <p className="text-gray-500 mb-2">まだ解析を行っていません。</p>
                                                <button className="bg-blue-500 text-white text-sm px-4 py-2 rounded">
                                                    AI解析を実行 (Premium)
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </>
                        ):(
                            <div className="mt-10 p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                                <p className="text-gray-500 mb-2">👈 左のリストから試合を選択してください</p>
                                <p className="text-sm text-gray-400">詳細情報とAIアドバイスが表示されます</p>
                            </div>
                        )}
                    </div>
        </div>
      </DashboardLayout>
    </>
  );
}




