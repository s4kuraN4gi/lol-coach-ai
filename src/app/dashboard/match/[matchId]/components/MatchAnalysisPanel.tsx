"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Imports cleaned up
// import InsightCard from './Analysis/InsightCard';
// import BuildTable from './Analysis/BuildTable';

type MatchAnalysisPanelProps = {
    matchId: string;
    initialAnalysis: string | null;
    summonerName: string;
    championName: string;
    kda: string;
    win: boolean;
};

export default function MatchAnalysisPanel({
    matchId,
    initialAnalysis,
    summonerName,
    championName,
    kda,
    win
}: MatchAnalysisPanelProps) {
    // State for simple redirect
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Context for finding opponent (simplified logic or passed props?)
    // For now we just pass what we have. Opponent calculation is expensive without full match data.
    // If we want opponent, we might need to fetch it in Chat Page or pass it if available.
    // For now, simpler is better.

    const handleConsult = () => {
        setIsLoading(true);
        
        // 1. Prepare Match Context
        const matchContext = {
            matchId,
            championName,
            kda,
            win,
            timestamp: Date.now()
            // opponentChampion: ... (Add if we have it in props)
        };

        // 2. Save to Session Storage (Handover to Chat Page)
        sessionStorage.setItem("activeMatchContext", JSON.stringify(matchContext));

        // 3. Redirect to Chat
        router.push("/chat");
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl mt-6">
            <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="text-xl">🎓</span> AI COACHING <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white ml-2">INTERACTIVE</span>
                </h3>
            </div>

            <div className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-slate-800/50">
                    <span className="text-4xl">💬</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">
                    AIによるマッチ分析
                </h2>
                <p className="text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
                    この試合（<strong>{championName}</strong>）について具体的に相談します。<br/>
                    ビルドや立ち回り、敗因についてRionコーチに詳しく聞くことができます。
                </p>

                <button 
                    onClick={handleConsult}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-lg px-10 py-4 rounded-xl shadow-lg hover:shadow-cyan-500/25 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-3"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin text-xl">⏳</span> 準備中...
                        </>
                    ) : (
                        <>
                            <span className="text-xl">📊</span> マッチ情報分析
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
