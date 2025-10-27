'use client'

import { useState, useEffect } from "react";
import SummonerCard from "../Components/SummonerCard";
import DashboardLayout from "./components/DashboardLayout";
import HistoryList from "./components/HistoryList";
import RankGraph from "./components/RankGraph";


type HistoryItem = {
    id: string;
    date: string;
    summonerName: string;
    champion: string;
    role: string;
    result: string;
    kda: string;
    aiAdvice: string;
}

type props = {
    histories: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
}

export default function DashboardPage() {
    const [histories, setHistories] = useState<HistoryItem[]>([])
    const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)

        //履歴一覧の初期表示
    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem("histories") || "[]")
        setHistories(stored);
    },[]);

  return (
    <>
      <DashboardLayout>
        <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* サモナー情報 */}
            <SummonerCard
                summonerName="s4kuran4gi"
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
        <div>
            <main className="min-h-screen w-full">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
                    <h3 className="text-2xl font-semibold mb-3">解析履歴</h3>
                    <HistoryList 
                        histories={histories}
                        onSelect={(item) => setSelectedHistory(item)}
                    />
                    {selectedHistory && (
                        <div>
                            <SummonerCard 
                                summonerName={selectedHistory.summonerName}
                                championName={selectedHistory.champion}
                                kills={parseInt(selectedHistory.kda.split("/")[0])}
                                deaths={parseInt(selectedHistory.kda.split("/")[1])}
                                assists={parseInt(selectedHistory.kda.split("/")[2])}
                                win={selectedHistory.result === "Win"}
                                gameDuration={1800}
                            />
                            <div>
                                <h4>AI コーチのアドバイス</h4>
                                <p>{selectedHistory.aiAdvice}</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
      </DashboardLayout>
    </>
  );
}




