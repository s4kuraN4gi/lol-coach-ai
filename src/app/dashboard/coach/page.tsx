"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import { fetchMatchIds, fetchMatchDetail } from "@/app/actions/riot";
import { analyzeMatchTimeline, dev_getMockAnalysis, CoachingInsight, AnalysisFocus, AnalysisResult, BuildItem } from "@/app/actions/coach";
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
        <div className="flex items-start gap-3 bg-slate-950 p-3 rounded border border-slate-700">
             {/* Note: In a real app, we would fetch item images from DataDragon. For now, using a generic icon.*/}
             <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0 border border-slate-600">
                <span className="text-xl">⚔️</span>
             </div>
             <div>
                 <div className="text-sm font-bold text-slate-200">{item.itemName}</div>
                 <div className="text-xs text-slate-400">{item.reason}</div>
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

                        {/* Step 2 & 3: Video Player & Controls & Build Recs */}
                        {selectedMatch && (
                            <div className="flex flex-col gap-4 pb-10">
                                {/* Controls Bar */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={() => { setSelectedMatch(null); setAnalysisData(null); setVideoReady(false); setYoutubeUrl(""); setLocalVideoUrl(null); }}
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
                                </div>

                                {/* Analysis Setup Panel (Structured Prompt) */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Left: Inputs */}
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-xs text-slate-400 font-bold block mb-1">注目エリア (Focus Area)</label>
                                                <select
                                                    value={focusArea}
                                                    onChange={(e) => setFocusArea(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                >
                                                    <option value="MACRO">🗺 マクロ (運営・判断)</option>
                                                    <option value="LANING">⚔️ レーニング (対面意識)</option>
                                                    <option value="TEAMFIGHT">💥 集団戦 (立ち位置)</option>
                                                    <option value="BUILD">🛡 ビルド・アイテム選択</option>
                                                    <option value="VISION">👁 視界・ワード</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-xs text-slate-400 font-bold block mb-1">時間 (任意)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="例: 12:30" 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                    value={focusTime}
                                                    onChange={(e) => setFocusTime(e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-400 font-bold block mb-1">具体的な悩み・質問 (任意)</label>
                                                <input 
                                                    type="text"
                                                    placeholder={
                                                        focusArea === 'LANING' ? "例: 相手のガンクが多すぎて勝てなかった..." :
                                                        focusArea === 'TEAMFIGHT' ? "例: ADCとしての立ち位置がわからなかった..." :
                                                        "例: 相手の構成に対してどうビルドすべきだった？"
                                                    }
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                    value={specificQuestion}
                                                    onChange={(e) => setSpecificQuestion(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Right: Action Button (Preserving Logic) */}
                                        <div className="w-full md:w-56 flex flex-col justify-end">
                                            {isAnalyzing ? (
                                                <div className="relative w-full h-10 bg-slate-800 rounded overflow-hidden border border-slate-700 transition">
                                                    <div 
                                                        className="absolute top-0 left-0 h-full bg-blue-600/50 transition-all duration-300 ease-out"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10">
                                                        AI分析中... {progress}%
                                                    </div>
                                                </div>
                                            ) : (
                                                (() => {
                                                    const isPremium = status?.is_premium;
                                                    const credits = status?.analysis_credits ?? 0;
                                                    const hasCredits = credits > 0;
                                                    const canAnalyze = isPremium || hasCredits;
                                                    
                                                    const canClaimReward = !!status && !status.is_premium && 
                                                        (!status.last_reward_ad_date || new Date().toDateString() !== new Date(status.last_reward_ad_date).toDateString());

                                                    return (
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <button 
                                                                onClick={() => {
                                                                    if (canAnalyze) {
                                                                        runAnalysis();
                                                                    } else {
                                                                        if (confirm("【モック】プレミアムプラン(月額980円)に登録しますか？")) {
                                                                            startTransition(async () => {
                                                                                const res = await upgradeToPremium();
                                                                                if (res.success) {
                                                                                    alert("プレミアムプランに登録しました！");
                                                                                    const newStatus = await getAnalysisStatus();
                                                                                    if (newStatus) setStatus(newStatus);
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                disabled={!videoReady}
                                                                className={`w-full px-4 py-2.5 rounded font-bold text-sm transition shadow-lg whitespace-nowrap flex items-center justify-center gap-2 group h-10
                                                                    ${!videoReady 
                                                                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                                                        : canAnalyze
                                                                            ? isPremium 
                                                                                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20"
                                                                                : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:scale-105 shadow-cyan-500/20"
                                                                            : "bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600"
                                                                    }
                                                                `}
                                                            >
                                                                {isPremium ? (
                                                                    <span>🧠 分析開始</span>
                                                                ) : hasCredits ? (
                                                                    <span>🎫 分析 (残: {credits}/3)</span>
                                                                ) : (
                                                                    <span>🔒 PREMIUMで分析</span>
                                                                )}
                                                            </button>

                                                            {canClaimReward && (
                                                                <button
                                                                    onClick={() => setRewardAdOpen(true)}
                                                                    className="text-xs text-amber-400 hover:text-amber-300 underline text-center"
                                                                >
                                                                    🎥 広告で回復 (+1)
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Video Area */}
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
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

                                {/* [NEW] Build Recommendation Section */}
                                {analysisData?.buildRecommendation && (
                                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 text-6xl">🛡</div>
                                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                                            <span className="text-amber-400">💡</span> AI Recommended Build
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Core Items (Best for this match)</h4>
                                                <div className="space-y-2">
                                                    {analysisData.buildRecommendation.coreItems.map((item, idx) => (
                                                        <BuildItemCard key={idx} item={item} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Situational / Defensives</h4>
                                                <div className="space-y-2">
                                                    {analysisData.buildRecommendation.situationalItems.map((item, idx) => (
                                                        <BuildItemCard key={idx} item={item} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                            {/* Result Ad Placement (Top of results) */}
                            {analysisData && (
                                <div className="mb-4">
                                    <p className="text-[10px] text-slate-500 mb-1 text-center">- SPONSORED -</p>
                                    <AdSenseBanner className="min-h-[100px] w-full bg-slate-800/50 rounded" />
                                </div>
                            )}

                            {!analysisData && !isAnalyzing && (
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

                            {analysisData?.insights && (
                                <div className="space-y-4">
                                    {analysisData.insights.map((insight, idx) => (
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
                                                <p className="text-xs text-slate-400 mb-2 whitespace-pre-wrap">{insight.description}</p>
                                                <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded text-xs text-purple-200 mt-2">
                                                    💡 {insight.advice}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
            {/* Full Screen AdSense Interstitial (Overlay during Analysis) */}
            {isAnalyzing && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <div className="mb-6">
                        <div className="text-6xl mb-4 animate-bounce">🤖</div>
                        <h3 className="text-3xl font-black text-white mb-2 tracking-tight">AI COACH ANALYZING...</h3>
                        <p className="text-slate-400">最適なアドバイスを生成しています。広告の後に結果が表示されます。</p>
                    </div>
                    
                    {/* Rectangle Ad */}
                    <div className="w-[336px] h-[280px] bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700 shadow-[0_0_50px_rgba(168,85,247,0.2)] mb-8">
                        <AdSenseBanner style={{ display: 'block', width: '336px', height: '280px' }} format="rectangle" />
                    </div>
                    
                    <div className="w-80">
                         <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                             <span>Processing Match Data</span>
                             <span>{progress}%</span>
                         </div>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-300 ease-out shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Reward Ad Modal */}
            {rewardAdOpen && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-6 shadow-[0_0_100px_rgba(245,158,11,0.2)] text-center">
                        <button 
                            onClick={() => setRewardAdOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            ✕
                        </button>

                        <div className="mb-6">
                            <div className="text-5xl mb-2 animate-bounce">🎁</div>
                            <h3 className="text-2xl font-black text-white italic">DAILY BONUS</h3>
                            <p className="text-amber-400 text-sm font-bold uppercase tracking-widest">クレジット回復 (+1)</p>
                        </div>

                        <div className="bg-black/50 rounded-xl p-4 mb-6 border border-slate-800">
                           <p className="text-slate-400 text-xs mb-2">SPONSORED AD</p>
                           {/* Mock Ad Image or Banner */}
                           <div className="w-full aspect-video bg-slate-800 rounded flex items-center justify-center relative overflow-hidden group cursor-pointer">
                                <img src="/reward_ad_mock.png" alt="Ad" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 text-[10px] text-white rounded">
                                    Ad 0:15
                                </div>
                           </div>
                        </div>

                        <button 
                            onClick={async () => {
                                setRewardLoading(true);
                                // Simulation of Ad Watch
                                await new Promise(r => setTimeout(r, 2000));
                                
                                const res = await claimDailyReward();
                                setRewardLoading(false);
                                
                                if (res.success) {
                                    alert(`クレジットを獲得しました！ (残り: ${res.newCredits})`);
                                    setRewardAdOpen(false);
                                    // Refresh status
                                    getAnalysisStatus().then(setStatus);
                                } else {
                                    alert(res.error || "エラーが発生しました。");
                                }
                            }}
                            disabled={rewardLoading}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                        >
                            {rewardLoading ? (
                                <>
                                    <span className="animate-spin">↻</span> 処理中...
                                </>
                            ) : (
                                <>
                                    <span>▶</span> 広告を見て獲得
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-slate-500 mt-4">
                            ※1日1回限定です。広告ブロックが有効な場合、正しく動作しない可能性があります。
                        </p>
                    </div>
                </div>
            )}

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
        adsbygoogle: any[]; // Google AdSense
    }
}
