"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import { getLatestActiveAnalysis } from "@/app/actions/analysis"; // Re-use connection? No, need fetch matches
import { fetchMatchIds, fetchMatchDetail, MatchSummary } from "@/app/actions/riot";
import { getReplayData, ReplayData } from "@/app/actions/replay";
import { getActiveSummoner } from "@/app/actions/profile"; // assuming this exists or similar
import ReplayViewer from "@/components/replay/ReplayViewer";
import { useAuth } from "@/app/Components/auth/AuthProvider"; // Assuming we have auth context or similar

// Mocking get active summoner if not exported, or using what Coach/Page uses.
// For now, I'll copy the match fetching logic pattern from Coach Page.

export default function ReplayPage() {
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    
    // Replay Data
    const [replayData, setReplayData] = useState<ReplayData | null>(null);
    const [loadingReplay, setLoadingReplay] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            setLoadingMatches(true);
            try {
                // 1. Get Active Summoner
                const summoner = await getActiveSummoner();
                if (!summoner?.puuid) {
                    setLoadingMatches(false);
                    return;
                }

                // 2. Fetch Matches
                const idsRes = await fetchMatchIds(summoner.puuid, 10);
                if (idsRes.success && idsRes.data) {
                    // Fetch details for summary
                    const summaries = await Promise.all(idsRes.data.map(async (id) => {
                        const detail = await fetchMatchDetail(id);
                        if (!detail.success || !detail.data) return null;
                        const m = detail.data;
                        const p = m.info.participants.find((p: any) => p.puuid === summoner.puuid);
                        if (!p) return null;
                        return {
                            matchId: id,
                            championName: p.championName,
                            win: p.win,
                            kda: `${p.kills}/${p.deaths}/${p.assists}`,
                            timestamp: m.info.gameStartTimestamp,
                            queueId: m.info.queueId
                        };
                    }));
                    setMatches(summaries.filter(s => s !== null));
                }
            } catch (e) {
                console.error("Failed to load replay list", e);
            } finally {
                setLoadingMatches(false);
            }
        };
        load();
    }, []);

    // Load Replay
    const handleSelectMatch = async (matchId: string) => {
        setSelectedMatchId(matchId);
        setLoadingReplay(true);
        setErrorMsg(null);
        setReplayData(null);

        try {
            const res = await getReplayData(matchId);
            if (res.success && res.data) {
                setReplayData(res.data);
            } else {
                setErrorMsg(res.error || "Failed to load replay data");
            }
        } catch (e) {
            setErrorMsg("Unexpected error loading replay");
        } finally {
            setLoadingReplay(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col animate-fadeIn relative">
                <header className="mb-6">
                    <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                        2D REPLAY <span className="text-sm not-italic font-normal text-slate-500 ml-2 border border-slate-700 px-2 rounded">BETA</span>
                    </h1>
                    <p className="text-slate-400 text-sm">試合全体の動きをマップ上で振り返り、マクロの動きを確認しよう。</p>
                </header>

                <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                    {/* Left: Match List (3 Cols) */}
                    <div className="col-span-12 md:col-span-3 flex flex-col gap-2 overflow-y-auto pr-2">
                        {loadingMatches ? (
                            <div className="text-slate-500 text-center py-10">Loading Matches...</div>
                        ) : (
                            matches.map(m => (
                                <button
                                    key={m.matchId}
                                    onClick={() => handleSelectMatch(m.matchId)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition text-left group
                                        ${selectedMatchId === m.matchId 
                                            ? 'bg-blue-900/20 border-blue-500/50' 
                                            : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-600'
                                        }
                                    `}
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-black shrink-0">
                                        <img 
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${m.championName}.png`} 
                                            alt={m.championName} 
                                            className="w-full h-full object-cover" 
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-xs font-bold ${m.win ? 'text-blue-400' : 'text-red-400'}`}>
                                            {m.championName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">
                                            {new Date(m.timestamp).toLocaleDateString()} • {m.kda}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Right: Replay Viewer (9 Cols) */}
                    <div className="col-span-12 md:col-span-9 bg-slate-950/50 rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-center relative">
                        {loadingReplay ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                                <div className="text-slate-400 font-bold animate-pulse">タイムラインデータを取得中...</div>
                                <div className="text-xs text-slate-600">※初回は時間がかかる場合があります</div>
                            </div>
                        ) : replayData ? (
                            <div className="w-full h-full">
                                <ReplayViewer data={replayData} />
                            </div>
                        ) : (
                            <div className="text-center text-slate-500">
                                <div className="text-4xl mb-4">🗺️</div>
                                <h3 className="text-xl font-bold mb-2">試合を選択してください</h3>
                                <p className="text-sm">左のリストから試合を選ぶと、2Dリプレイが再生されます。</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
