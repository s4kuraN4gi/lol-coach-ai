'use client'

import { useState, useEffect } from "react";
import SummonerCard from "../Components/SummonerCard";
import DashboardLayout from "../Components/layout/DashboardLayout";
import HistoryList from "./components/HistoryList";
import RankGraph from "./components/RankGraph";
import { useRouter } from "next/navigation";
import { useSummoner } from "../Providers/SummonerProvider";
import { useAuth } from "../Providers/AuthProvider";


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
    const {selectedSummoner, loading:summonerLoading} = useSummoner();
    const [histories, setHistories] = useState<HistoryItem[]>([])
    const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)
    const router = useRouter();
    const {user, loading: authLoading} = useAuth();

    useEffect(() => {
        if(summonerLoading) return;
        if(!selectedSummoner){
            router.push("/account");
        }
    },[router, selectedSummoner, summonerLoading]);

        //履歴一覧の初期表示
    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem("histories") || "[]")
        setHistories(stored);
    },[]);

    if (authLoading || summonerLoading) {
        return (
            <main className="p-10">
                <p className="text-center mt-10">読み込み中...</p>
            </main>
        )
    }
    // ユーザーが認証されていない場合はログイン画面に遷移
    if(!user) return null;

  return (
    <>
      <DashboardLayout>
        <h1 className="text-2xl font-bold mb-6">
            ようこそ、{selectedSummoner?.name ?? "ゲスト"} さん 
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* サモナー情報 */}
            <SummonerCard
                selectedSummoner= {selectedSummoner?.name ?? "未ログイン"}
                championName="Aatrox"
                kills={10}
                deaths={4}
                assists={6}
                win={true}
                gameDuration={1800}
            />

            {/* ランク推移グラフ */}
            <RankGraph />
        </div>
        {/* 履歴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="border-r pr-4 overflow-y-auto h-[75vh]">
                    <h3 className="text-2xl font-semibold mb-4">解析履歴</h3>
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
                                    gameDuration={1800}
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
                                        : <p className="text-gray-500">AIアドバイスはまだありません。</p>}
                                </div>
                            </>
                        ):(
                            <div className="text-gray-500 mt-10">
                                ←左の履歴から試合を選択してください。
                            </div>
                        )}
                    </div>
        </div>
      </DashboardLayout>
    </>
  );
}




