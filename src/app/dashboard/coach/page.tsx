"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import { fetchMatchIds, fetchMatchDetail } from "@/app/actions/riot";
import { analyzeMatchTimeline, CoachingInsight, AnalysisFocus, AnalysisResult, BuildItem } from "@/app/actions/coach";
import { useSummoner } from "../../Providers/SummonerProvider";
import { getAnalysisStatus, type AnalysisStatus, upgradeToPremium, claimDailyReward } from "@/app/actions/analysis";
import PlanStatusBadge from "../../Components/subscription/PlanStatusBadge";
import PremiumPromoCard from "../../Components/subscription/PremiumPromoCard";
import AdSenseBanner from "../../Components/ads/AdSenseBanner";

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
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
    const [status, setStatus] = useState<AnalysisStatus | null>(null); // Premium Status
    const [isAnalyzing, startTransition] = useTransition();

    // Analysis Focus State
    const [focusArea, setFocusArea] = useState<string>("MACRO");
    const [focusTime, setFocusTime] = useState<string>("");
    const [specificQuestion, setSpecificQuestion] = useState<string>("");

    // Reward Ad State
    const [rewardAdOpen, setRewardAdOpen] = useState(false);
    const [rewardLoading, setRewardLoading] = useState(false);

    // Progress State
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
            setErrorMsg(null);
            setProgress(10);
            
            // Artificial progress simulation 
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            const focus: AnalysisFocus = {
                focusArea,
                focusTime,
                specificQuestion
            };

            const res = await analyzeMatchTimeline(selectedMatch.matchId, currentPuuid, undefined, focus);
            
            clearInterval(interval);
            setProgress(100);

            if (res.success && res.data) {
                setAnalysisData(res.data);
                // Refresh status to update credits
                const newStatus = await getAnalysisStatus();
                if (newStatus) setStatus(newStatus);
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

    // Helper Component for Build Items
    const BuildItemCard = ({ item }: { item: BuildItem }) => (
        <div className="flex items-center gap-2 group relative">
             <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0 border border-slate-600 overflow-hidden relative">
                {item.id && item.id > 0 ? (
                    <img 
                        src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${item.id}.png`} 
                        alt={item.itemName} 
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <span className="text-xl">⚔️</span>
                )}
             </div>
             {/* Tooltip on hover */}
             <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-black/90 border border-slate-700 text-white text-xs px-2 py-1 rounded w-32 text-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                 {item.itemName}
                 {item.reason && <div className="text-slate-400 mt-1">{item.reason}</div>}
             </div>
        </div>
    );

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
                        
                        {/* Step 1: Select Match */}
                        {!selectedMatch && (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-slate-200 mb-4">分析する試合を選択</h2>
                                {loadingIds ? (
                                     <div className="text-slate-500">試合履歴を読み込み中...</div>
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

                        {/* Step 2 & 3: Video Player & Controls & Build Recs */}
                        {selectedMatch && (
                            <div className="flex flex-col gap-4 pb-10">
                                {/* Controls Bar */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <button 
                                        onClick={() => { setSelectedMatch(null); setAnalysisData(null); }}
                                        className="text-slate-400 hover:text-white font-bold text-sm"
                                    >
                                        ← 戻る
                                    </button>
                                    <div className="h-6 w-px bg-slate-700"></div>
                                    {/* ... Video Inputs ... */}
                                    <div className="flex-1 flex gap-2">
                                        <button 
                                            onClick={() => setVideoSourceType("YOUTUBE")}
                                            className={`px-3 py-1 rounded text-xs font-bold ${videoSourceType === "YOUTUBE" ? "bg-slate-600 text-white" : "text-slate-400"}`}
                                        >
                                            YouTube
                                        </button>
                                        {videoSourceType === "YOUTUBE" && (
                                             <div className="flex items-center gap-2 bg-slate-950 rounded px-2 border border-slate-700 flex-1">
                                                <input 
                                                    type="text" 
                                                    placeholder="YouTube URL..." 
                                                    className="bg-transparent text-white w-full transition-all outline-none text-sm py-2"
                                                    value={youtubeUrl}
                                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                                />
                                                <button onClick={loadYoutubeVideo} className="text-xs bg-slate-800 px-2 py-1 rounded text-white">読込</button>
                                             </div>
                                        )}
                                    </div>
                                </div>

                                {/* Analysis Settings */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Left: Inputs */}
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-xs text-slate-400 font-bold block mb-1">注目エリア</label>
                                                <select
                                                    value={focusArea}
                                                    onChange={(e) => setFocusArea(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                                                >
                                                    <option value="MACRO">🗺 マクロ</option>
                                                    <option value="LANING">⚔️ レーニング</option>
                                                    <option value="TEAMFIGHT">💥 集団戦</option>
                                                    <option value="BUILD">🛡 ビルド</option>
                                                </select>
                                            </div>
                                            {/* ... */}
                                        </div>
                                       {/* Button Area */}
                                        <div className="w-full md:w-56 flex flex-col justify-end">
                                             <button onClick={runAnalysis} className="bg-purple-600 text-white font-bold py-2 rounded">
                                                {isAnalyzing ? `分析中... ${progress}%` : "分析開始"}
                                             </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Video Area */}
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
                                    <div id="youtube-player" className={`w-full h-full ${videoSourceType === 'YOUTUBE' ? 'block' : 'hidden'}`}></div>
                                </div>

                                {/* Comparison Build Card */}
                                {analysisData?.buildRecommendation && (
                                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 text-6xl">⚖️</div>
                                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                                            <span className="text-amber-400">💡</span> AI ビルド診断
                                        </h3>
                                        
                                        <div className="flex flex-col md:flex-row gap-8 mb-6">
                                            {/* Actual Build */}
                                            <div className="flex-1 bg-slate-950/50 p-4 rounded border border-slate-700">
                                                <div className="text-xs font-bold text-slate-400 mb-2 uppercase">あなたのビルド (Actual)</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysisData.buildRecommendation.userItems.map((item, idx) => (
                                                        <BuildItemCard key={idx} item={item} />
                                                    ))}
                                                    {analysisData.buildRecommendation.userItems.length === 0 && (
                                                        <span className="text-xs text-slate-500">No items found</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="hidden md:flex items-center justify-center text-slate-500">
                                                <span>vs</span>
                                            </div>

                                            {/* Recommended Build */}
                                            <div className="flex-1 bg-purple-900/10 p-4 rounded border border-purple-500/30">
                                                <div className="text-xs font-bold text-purple-300 mb-2 uppercase">AI推奨ビルド (Recommended)</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysisData.buildRecommendation.recommendedItems.map((item, idx) => (
                                                        <BuildItemCard key={idx} item={item} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Analysis Text */}
                                        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
                                            <h4 className="font-bold text-slate-200 text-sm mb-2">📋 診断レポート</h4>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {analysisData.buildRecommendation.analysis}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Coaching Feed */}
                    <div className="col-span-4 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
                        {/* Feed Content... (Same as before) */}
                         <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {analysisData?.insights && analysisData.insights.map((insight, idx) => (
                                 <div key={idx} onClick={() => seekTo(insight.timestamp)} className="bg-slate-800 p-4 rounded cursor-pointer hover:bg-slate-700 transition">
                                     <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-blue-400">{insight.timestampStr}</span>
                                        <span className="text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-400">{insight.type}</span>
                                     </div>
                                     <div className="font-bold text-sm mb-1">{insight.title}</div>
                                     <div className="text-xs text-slate-400">{insight.advice}</div>
                                 </div>
                            ))}
                         </div>
                    </div>
                </div>

                {/* Modals & Scripts (Same as before) */}
                <script dangerouslySetInnerHTML={{__html: `
                    var tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                `}} />
            </div>
        </DashboardLayout>
    );
}

// Helper
function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
