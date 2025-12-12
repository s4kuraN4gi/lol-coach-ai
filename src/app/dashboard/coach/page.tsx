"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import { fetchMatchIds, fetchMatchDetail } from "@/app/actions/riot";
import { analyzeMatchTimeline, CoachingInsight } from "@/app/actions/coach";
import { useSummoner } from "../../Providers/SummonerProvider";
import { getAnalysisStatus, type AnalysisStatus } from "@/app/actions/analysis";
import PlanStatusBadge from "../../Components/subscription/PlanStatusBadge";
import PremiumPromoCard from "../../Components/subscription/PremiumPromoCard";
import PremiumFeatureGate from "../../Components/subscription/PremiumFeatureGate";

// Types
type MatchSummary = {
    matchId: string;
    championName: string;
    win: boolean;
    kda: string;
    timestamp: number;
    queueId: number;
};

export default function CoachPage() {
    // Context
    const { activeSummoner, loading: summonerLoading } = useSummoner();

    // State
    const [matches, setMatches] = useState<MatchSummary[]>([]);
    const [loadingIds, setLoadingIds] = useState(true);
    const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
    const [insights, setInsights] = useState<CoachingInsight[] | null>(null);
    const [status, setStatus] = useState<AnalysisStatus | null>(null); // Premium Status
    const [isAnalyzing, startTransition] = useTransition();

    // Progress State
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Video State
    const [videoSourceType, setVideoSourceType] = useState<"YOUTUBE" | "LOCAL">("YOUTUBE");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
    const [videoReady, setVideoReady] = useState(false);
    
    // Error State
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Players
    const [ytPlayer, setYtPlayer] = useState<any>(null); 
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Load Premium Status
    useEffect(() => {
        getAnalysisStatus().then(setStatus);
    }, []);

    // Fetch Matches logic
    const loadMatches = useCallback(async () => {
        if (!activeSummoner?.puuid) return;
        
        setLoadingIds(true);
        const puuid = activeSummoner.puuid;
        const idsRes = await fetchMatchIds(puuid, 10);
        
        if (idsRes.success && idsRes.data) {
            // ... existing match logic ...
            const summaries = await Promise.all(idsRes.data.map(async (id) => {
                 const detail = await fetchMatchDetail(id);
                 if (!detail.success || !detail.data) return null;
                 const m = detail.data;
                 const p = m.info.participants.find((p: any) => p.puuid === puuid);
                 if (!p) return null;
                 return {
                     matchId: id,
                     championName: p.championName,
                     win: p.win,
                     kda: `${p.kills}/${p.deaths}/${p.assists}`,
                     timestamp: m.info.gameStartTimestamp,
                     queueId: m.info.queueId
                 } as MatchSummary;
            }));
            setMatches(summaries.filter(Boolean) as MatchSummary[]);
        }
        setLoadingIds(false);
    }, [activeSummoner]);

    useEffect(() => {
        if (activeSummoner) {
            loadMatches();
        } else if (!summonerLoading) {
            setLoadingIds(false);
        }
    }, [activeSummoner, summonerLoading, loadMatches]);

    // YouTube Embed Logic
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        window.onYouTubeIframeAPIReady = () => {
             // Ready
        };
    }, []);

    // Handlers
    const loadYoutubeVideo = () => {
        if (!selectedMatch) return;
        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            alert("Invalid YouTube URL");
            return;
        }

        setVideoSourceType("YOUTUBE");

        if (ytPlayer) {
            ytPlayer.loadVideoById(videoId);
        } else {
             new window.YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'playsinline': 1 },
                events: {
                    'onReady': (event: any) => {
                        setYtPlayer(event.target);
                        setVideoReady(true);
                    }
                }
            });
        }
        setVideoReady(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setLocalVideoUrl(objectUrl);
        setVideoSourceType("LOCAL");
        setVideoReady(true);
        
        // Reset YouTube player if active to prevent dual audio
        if (ytPlayer && ytPlayer.pauseVideo) {
            ytPlayer.pauseVideo();
        }
    };

    const runAnalysis = () => {
        const currentPuuid = activeSummoner?.puuid;
        if (!selectedMatch || !currentPuuid) return;
        
        startTransition(async () => {
            const res = await analyzeMatchTimeline(selectedMatch.matchId, currentPuuid);
            if (res.success && res.insights) {
                setInsights(res.insights);
            } else {
                setErrorMsg(res.error || "Unknown error occurred.");
            }
        });
    }

    const seekTo = (timestampMs: number) => {
        const seconds = timestampMs / 1000;

        if (videoSourceType === "YOUTUBE" && ytPlayer && ytPlayer.seekTo) {
            ytPlayer.seekTo(seconds, true);
            ytPlayer.playVideo();
        } else if (videoSourceType === "LOCAL" && localVideoRef.current) {
            localVideoRef.current.currentTime = seconds;
            localVideoRef.current.play();
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col animate-fadeIn relative">
                <header className="mb-6 flex justify-between items-center">
                     <div>
                        <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">
                             AI COACH <span className="text-sm not-italic font-normal text-slate-500 ml-2 border border-slate-700 px-2 rounded">TIMELINE SYNC</span>
                        </h1>
                        <p className="text-slate-400 text-sm">Riotの試合データとリプレイ動画を同期し、AIが徹底コーチング。</p>
                     </div>
                     <PlanStatusBadge initialStatus={status} onStatusUpdate={setStatus} />
                </header>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                    
                    {/* Left: Match Selection & Video (8 Cols) */}
                    <div className="col-span-8 flex flex-col gap-4 h-full overflow-y-auto pr-2">
                        
                        {/* Step 1: Select Match (If none selected) */}
                        {!selectedMatch && (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-slate-200 mb-4">分析する試合を選択</h2>
                                
                                {summonerLoading ? (
                                    <div className="text-slate-500 animate-pulse">アカウント確認中...</div>
                                ) : !activeSummoner ? (
                                    <div className="text-red-400">
                                        アカウントが連携されていません。設定ページからRiotアカウントを連携してください。
                                    </div>
                                ) : loadingIds ? (
                                     <div className="text-slate-500">試合履歴を読み込み中 ({activeSummoner.summoner_name})...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {matches.map(m => (
                                            <button 
                                                key={m.matchId}
                                                onClick={() => setSelectedMatch(m)}
                                                className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 transition rounded-lg group text-left"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden">
                                                     <img src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${m.championName}.png`} alt={m.championName} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className={`font-bold ${m.win ? "text-blue-400" : "text-red-400"}`}>
                                                        {m.win ? "勝利 (WIN)" : "敗北 (LOSE)"}
                                                    </div>
                                                    <div className="text-sm text-slate-400">
                                                        {m.championName} • {m.kda} KDA
                                                    </div>
                                                    <div className="text-xs text-slate-600">
                                                        {new Date(m.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2 & 3: Video Player & Controls */}
                        {selectedMatch && (
                            <div className="flex flex-col h-full gap-4">
                                {/* Controls Bar */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={() => { setSelectedMatch(null); setInsights(null); setVideoReady(false); setYoutubeUrl(""); setLocalVideoUrl(null); }}
                                            className="text-slate-400 hover:text-white font-bold text-sm"
                                        >
                                            ← 戻る
                                        </button>
                                    </div>
                                    <div className="h-6 w-px bg-slate-700"></div>
                                    
                                    {/* Video Input Controls */}
                                    <div className="flex-1 flex gap-2 overflow-x-auto items-center">
                                        <div className="flex bg-slate-800 rounded p-1 mr-2">
                                            <button 
                                                onClick={() => setVideoSourceType("YOUTUBE")}
                                                className={`px-3 py-1 rounded text-xs font-bold ${videoSourceType === "YOUTUBE" ? "bg-slate-600 text-white" : "text-slate-400"}`}
                                            >
                                                YouTube
                                            </button>
                                            <button 
                                                onClick={() => setVideoSourceType("LOCAL")}
                                                className={`px-3 py-1 rounded text-xs font-bold ${videoSourceType === "LOCAL" ? "bg-slate-600 text-white" : "text-slate-400"}`}
                                            >
                                                Local File
                                            </button>
                                        </div>

                                        {videoSourceType === 'YOUTUBE' ? (
                                            <div className="flex items-center gap-2 bg-slate-950 rounded px-2 border border-slate-700 flex-1">
                                                <span className="text-red-500 text-lg">▶</span>
                                                <input 
                                                    type="text" 
                                                    placeholder="YouTube URL..." 
                                                    className="bg-transparent text-white w-full transition-all outline-none text-sm py-2"
                                                    value={youtubeUrl}
                                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                                />
                                                <button 
                                                    onClick={loadYoutubeVideo}
                                                    disabled={!youtubeUrl}
                                                    className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-white whitespace-nowrap"
                                                >
                                                    読込
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded cursor-pointer transition whitespace-nowrap flex-1">
                                                <span className="text-lg">📁</span>
                                                <span className="text-sm font-bold">動画ファイルを選択</span>
                                                <input 
                                                    type="file" 
                                                    accept="video/*" 
                                                    className="hidden" 
                                                    onChange={handleFileSelect}
                                                />
                                                <span className="text-xs text-slate-500 ml-2">※アップロードはされません</span>
                                            </label>
                                        )}
                                    </div>

                                    <div className="h-6 w-px bg-slate-700"></div>
                                    
                                    <div className="w-48">
                                        {isAnalyzing ? (
                                            <div className="relative w-full h-9 bg-slate-800 rounded overflow-hidden border border-slate-700">
                                                <div 
                                                    className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-out"
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10 drop-shadow-md">
                                                    AI分析中... {progress}%
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={runAnalysis}
                                                disabled={isAnalyzing || !videoReady}
                                                className={`w-full px-4 py-2 rounded font-bold text-sm transition shadow-[0_0_15px_rgba(168,85,247,0.4)] whitespace-nowrap flex items-center justify-center gap-2
                                                    ${videoReady ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-slate-800 text-slate-500 cursor-not-allowed"}
                                                `}
                                            >
                                                <span>🧠</span> 動画分析開始
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Video Area */}
                                <div className="flex-1 bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
                                    {/* YouTube Player Container */}
                                    <div 
                                        id="youtube-player" 
                                        className={`w-full h-full ${videoSourceType === 'YOUTUBE' ? 'block' : 'hidden'}`}
                                    ></div>
                                    
                                    {/* Local Video Player Container */}
                                    {videoSourceType === 'LOCAL' && localVideoUrl && (
                                        <video
                                            ref={localVideoRef}
                                            src={localVideoUrl}
                                            controls
                                            className="w-full h-full object-contain bg-black"
                                        />
                                    )}

                                    {!videoReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-2 pointer-events-none bg-slate-950/80 z-10">
                                            <span className="text-4xl">📺</span>
                                            <span>動画ファイルを選択するか、YouTube URLを入力してください</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {!selectedMatch && (
                            <div className="mt-auto">
                                <PremiumPromoCard initialStatus={status} onStatusUpdate={setStatus} />
                            </div>
                        )}
                    </div>

                    {/* Right: Coaching Feed (4 Cols) */}
                    <div className="col-span-4 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-slate-800 bg-slate-900">
                             <h3 className="font-bold text-slate-200">コーチの分析結果 (AI Analysis)</h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                            {!insights && !isAnalyzing && (
                                <div className="text-center text-slate-500 mt-10 p-4">
                                    <div className="text-4xl mb-4">🤖</div>
                                    <p>準備完了 (Ready)</p>
                                    <p className="text-sm mt-2">試合状況と動画を同期して、AIがマクロ視点でコーチングします。</p>
                                </div>
                            )}

                             {isAnalyzing && (
                                <div className="space-y-4 animate-pulse">
                                     <div className="text-center text-blue-400 text-sm mb-4">試合データを解析中...</div>
                                     {[1,2,3,4].map(i => (
                                         <div key={i} className="bg-slate-800 h-24 rounded-lg"></div>
                                     ))}
                                </div>
                            )}

                            {insights && (
                                <PremiumFeatureGate isPremium={!!status?.is_premium} blurAmount="md">
                                    <div className="space-y-4">
                                        {insights.map((insight, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => seekTo(insight.timestamp)}
                                                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500 transition rounded-lg p-4 cursor-pointer group relative overflow-hidden"
                                            >
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                                    insight.type === 'MISTAKE' ? 'bg-red-500' : 
                                                    insight.type === 'GOOD_PLAY' ? 'bg-green-500' : 
                                                    insight.type === 'TURNING_POINT' ? 'bg-amber-500' : 'bg-blue-500'
                                                }`}></div>
                                                
                                                <div className="flex justify-between items-start mb-2 pl-3">
                                                    <span className="font-mono text-xs font-bold bg-slate-950 px-2 py-1 rounded text-slate-300 group-hover:text-white transition-colors">
                                                        ▶ {insight.timestampStr}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                        insight.type === 'MISTAKE' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                                    }`}>
                                                        {insight.type}
                                                    </span>
                                                </div>
                                                
                                                <div className="pl-3">
                                                    <h4 className="font-bold text-slate-200 text-sm mb-1">{insight.title}</h4>
                                                    <p className="text-xs text-slate-400 mb-2">{insight.description}</p>
                                                    <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded text-xs text-purple-200 mt-2">
                                                        💡 {insight.advice}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </PremiumFeatureGate>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Dialog Modal */}
                {errorMsg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-red-500/50 rounded-xl p-6 w-full max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                                <span>⚠️</span> Analysis Error
                            </h3>
                            <p className="text-slate-400 text-sm mb-2">
                                以下のエラーメッセージをコピーして、サポートにお問い合わせください。
                            </p>
                            <div className="relative mb-6">
                                <textarea
                                    readOnly
                                    value={errorMsg}
                                    className="w-full h-32 bg-slate-950 border border-slate-700 rounded p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:border-red-500/50"
                                    onClick={(e) => e.currentTarget.select()}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(errorMsg);
                                        const btn = document.getElementById('copy-btn');
                                        if (btn) {
                                            const originalText = btn.innerText;
                                            btn.innerText = "Copied!";
                                            setTimeout(() => btn.innerText = originalText, 2000);
                                        }
                                    }}
                                    id="copy-btn"
                                    className="absolute bottom-2 right-2 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1 rounded border border-slate-600 transition"
                                >
                                    📋 Copy
                                </button>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setErrorMsg(null)}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold transition border border-slate-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* YouTube API Type Declaration */}
            <script dangerouslySetInnerHTML={{__html: `
                var tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            `}} />
        </DashboardLayout>
    );
}

// Helper
function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Add Window Type
declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}
