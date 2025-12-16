"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import { fetchMatchIds, fetchMatchDetail, fetchLatestVersion } from "@/app/actions/riot";
import { analyzeMatchTimeline, CoachingInsight, AnalysisFocus, AnalysisResult, BuildItem } from "@/app/actions/coach";
import { useSummoner } from "../../Providers/SummonerProvider";
import { getAnalysisStatus, type AnalysisStatus, upgradeToPremium, claimDailyReward, analyzeVideo, getVideoAnalysisStatus, getLatestActiveAnalysis } from "@/app/actions/analysis";
import PlanStatusBadge from "../../Components/subscription/PlanStatusBadge";
import PremiumPromoCard from "../../Components/subscription/PremiumPromoCard";
import AdSenseBanner from "../../Components/ads/AdSenseBanner";
import { ModeSelector } from "../components/Analysis/ModeSelector";
import { AnalysisMode } from "@/app/actions/promptUtils";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

// Types
type MatchSummary = {
    matchId: string;
    championName: string;
    win: boolean;
    kda: string;
    timestamp: number;
    queueId: number;
};

// Helper
function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

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

    // Async Analysis State
    const [asyncStatus, setAsyncStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
    const [isRestoring, setIsRestoring] = useState(true); // New: Loading State to prevent flicker

    // Analysis Focus State
    const [focusArea, setFocusArea] = useState<string>("MACRO");
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("MACRO");
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
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [videoReady, setVideoReady] = useState(false);
    
    // Dynamic Version
    const [ddVersion, setDdVersion] = useState("14.24.1");
    
    // Refs
    const autoResumeChecked = useRef(false);
    const analysisStartTime = useRef<number>(0);

    // Fetch latest version on mount
    useEffect(() => {
        fetchLatestVersion().then(v => setDdVersion(v));
    }, []);
    
    // Error State
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Players
    const [ytPlayer, setYtPlayer] = useState<any>(null); 
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Load Premium Status
    useEffect(() => {
        getAnalysisStatus().then(setStatus);
    }, []);

    // Polling Logic for Async Analysis
    useEffect(() => {
        if (!selectedMatch) {
            setAsyncStatus('idle');
            setAnalysisData(null);
            return;
        }

        let intervalId: NodeJS.Timeout;
        let isMounted = true;

        const checkStatus = async () => {
            if (!selectedMatch) return;
            const res = await getVideoAnalysisStatus(selectedMatch.matchId);
            
            if (!isMounted) return;

            // Stale Data Check
            if (res.created_at && analysisStartTime.current > 0) {
                 const created = new Date(res.created_at).getTime();
                 if (created < analysisStartTime.current - 5000) {
                     return; 
                 }
            }

            if (res.status === 'completed' && res.result) {
                setAsyncStatus('completed');
                setAnalysisData(res.result as AnalysisResult);
                setProgress(100);
            } else if (res.status === 'processing') {
                setAsyncStatus('processing');
                // Progress handled by separate effect
            } else if (res.status === 'failed') {
                setAsyncStatus('failed');
                setErrorMsg(res.error || "Analysis failed");
                setProgress(0);
            } else {
                if (asyncStatus === 'processing') {
                     // Keep waiting
                } else {
                     setAsyncStatus('idle');
                }
            }
        };

        // Initial check
        checkStatus();

        intervalId = setInterval(async () => {
             const res = await getVideoAnalysisStatus(selectedMatch.matchId);
             if (!isMounted) return;

             if (res.status === 'completed' && res.result) {
                 setAsyncStatus('completed');
                 setAnalysisData(res.result as AnalysisResult);
                 setProgress(100);
             } else if (res.status === 'processing') {
                 setAsyncStatus('processing');
             } else if (res.status === 'failed') {
                 setAsyncStatus('failed');
                 setErrorMsg(res.error || "Analysis failed");
             }
        }, 3000);

        return () => {
             isMounted = false;
             clearInterval(intervalId);
        };
    }, [selectedMatch?.matchId]);

    // Smooth Progress Simulation
    useEffect(() => {
        if (asyncStatus !== 'processing') return;
        
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return 95; // Cap at 95% until done
                
                let increment = 0;
                if (prev < 30) increment = 2;        // Fast start (0-30% in ~3s)
                else if (prev < 60) increment = 0.5; // Steady middle (30-60% in ~12s)
                else if (prev < 85) increment = 0.2; // Slowing down (60-85% in ~25s)
                else increment = 0.05;               // Crawling (85-95% in ~40s)
                
                return Math.min(prev + increment, 95);
            });
        }, 200);
        
        return () => clearInterval(interval);
    }, [asyncStatus]);

    // Fetch Matches logic
    const loadMatches = useCallback(async () => {
        if (!activeSummoner?.puuid) return;
        
        setLoadingIds(true);
        const puuid = activeSummoner.puuid;
        const idsRes = await fetchMatchIds(puuid, 10);
        
        if (idsRes.success && idsRes.data) {
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
            const valid = summaries.filter((s): s is MatchSummary => s !== null);
            setMatches(valid);
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

    // Auto-Resume: Restore Active Analysis and Inputs
    useEffect(() => {
        if (loadingIds) return; // Wait for matches

        if (!autoResumeChecked.current) {
            autoResumeChecked.current = true;
            getLatestActiveAnalysis().then(latest => {
                 if (latest && (latest.status === 'processing' || latest.status === 'completed')) {
                     const found = matches.find(m => m.matchId === latest.matchId);
                     if (found) {
                         console.log("Restoring Session:", found.matchId);
                         setSelectedMatch(found);
                         
                         // Restore Inputs
                         if (latest.inputs) {
                             const inp = latest.inputs as any;
                             if (inp.videoSourceType) setVideoSourceType(inp.videoSourceType);
                             if (inp.videoUrl) setYoutubeUrl(inp.videoUrl);
                             if (inp.focusTime) setFocusTime(inp.focusTime);
                             if (inp.specificQuestion) setSpecificQuestion(inp.specificQuestion);
                             if (inp.mode) setAnalysisMode(inp.mode);
                         }

                         // Pre-fill Data for immediate display
                         if (latest.status === 'completed' && latest.result) {
                             setAnalysisData(latest.result as AnalysisResult);
                             setAsyncStatus('completed');
                             setProgress(100);
                         } else if (latest.status === 'processing') {
                             setAsyncStatus('processing');
                         }

                     }
                 }
                 setIsRestoring(false);
            });
        }
    }, [matches, loadingIds]); // Run once matches are ready

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
        // Allow loading without match (Video Mode)
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
        setLocalFile(file);
        setVideoSourceType("LOCAL");
        setVideoReady(true);
        
        if (ytPlayer && ytPlayer.pauseVideo) {
            ytPlayer.pauseVideo();
        }
    };

    const runAnalysis = () => {
        const currentPuuid = activeSummoner?.puuid;
        
        if (!selectedMatch || !currentPuuid) return;

        // Start Async Analysis
        setErrorMsg(null);
        setAsyncStatus('processing');
        setAnalysisData(null);
        setProgress(1);
        analysisStartTime.current = Date.now();

        const formData = new FormData();
        
        // Enrich Description with Match Context
        const description = videoSourceType === "YOUTUBE" ? youtubeUrl : "Local Video Upload";
        if (selectedMatch?.matchId) {
            formData.append("matchId", selectedMatch.matchId);
        }
        const descriptionCombined = `Videos Source: ${description}\n\nSpecific Question: ${specificQuestion}`;
        formData.append("description", descriptionCombined);

        // Append Inputs for Persistence
        formData.append("videoSourceType", videoSourceType);
        
        if (videoSourceType === 'YOUTUBE') {
             formData.append("videoUrl", youtubeUrl);
        }
        formData.append("focusTime", focusTime);
        formData.append("specificQuestion", specificQuestion);

        // Call analyzeVideo (Fire & Forget / Background)
        console.log("Starting Analysis Job...");
        
        analyzeVideo(formData, undefined, analysisMode).then(res => {
            if ('error' in res && res.error) {
                    setErrorMsg(res.error);
                    setAsyncStatus('failed');
            } else {
                // Job started
                if (res.success && res.data) {
                        setAnalysisData(res.data);
                        setAsyncStatus('completed');
                }
            }
        }).catch(err => {
            console.error("Launch Error", err);
            setErrorMsg("Failed to launch analysis.");
            setAsyncStatus('failed');
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
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${item.id}.png`} 
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
                             AI COACH <span className="text-sm not-italic font-normal text-slate-500 ml-2 border border-slate-700 px-2 rounded">TIMELINE SYNC & VIDEO</span>
                        </h1>
                        <p className="text-slate-400 text-sm">Riotの試合データとリプレイ動画を同期し、AIが徹底コーチング。</p>
                     </div>
                     <PlanStatusBadge initialStatus={status} onStatusUpdate={setStatus} />
                </header>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                    
                    {/* Left: Match Selection & Video (8 Cols) */}
                    <div className="col-span-8 flex flex-col gap-4 h-full overflow-y-auto pr-2">
                        
                        {/* Match List (Visible if Video Not Ready?) - No, always allow select */}
                        {/* Changed Logic: Show Match List if NO match selected OR keep it accessible? */}
                        {/* To keep it simple, if matches exist, show them. Hide if selected? */}
                        {/* Scoped Loading State */}
                        {isRestoring ? (
                             <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-full flex items-center justify-center min-h-[300px]">
                                 <div className="flex flex-col items-center gap-4">
                                     <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                                     <p className="text-slate-400 font-bold animate-pulse">セッションを復元中...</p>
                                 </div>
                             </div>
                        ) : !selectedMatch && (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-slate-200 mb-4">分析する試合を選択</h2>
                                {loadingIds ? (
                                     <div className="text-slate-500">試合履歴を読み込み中 ({activeSummoner?.summoner_name})...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {matches.map(m => (
                                            <button 
                                                key={m.matchId}
                                                onClick={() => {
                                                    setSelectedMatch(m);
                                                    setAnalysisData(null);
                                                    setAsyncStatus('idle');
                                                    setProgress(0);
                                                    setErrorMsg(null);
                                                    // Reset Video State
                                                    setYoutubeUrl("");
                                                    setLocalVideoUrl(null);
                                                    setLocalFile(null);
                                                    setVideoReady(false);
                                                    setVideoSourceType("YOUTUBE");
                                                }}
                                                className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 transition rounded-lg group text-left"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden">
                                                     <img src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.championName}.png`} alt={m.championName} className="w-full h-full object-cover" />
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

                        {/* Video Controls & Player */}
                        {/* Show ONLY if Match Selected */}
                        {selectedMatch && (
                            <div className="flex flex-col gap-4 pb-10">
                                {/* Controls Bar */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    {(selectedMatch) && (
                                        <button 
                                            onClick={() => { setSelectedMatch(null); setAnalysisData(null); }}
                                            className="text-slate-400 hover:text-white font-bold text-sm"
                                        >
                                            ← 戻る
                                        </button>
                                    )}
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

                                            <div className="flex flex-col gap-1 flex-1">
                                                <label className={`flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border ${!localVideoUrl && analysisData ? 'border-amber-500/50' : 'border-slate-700'} px-3 py-1.5 rounded cursor-pointer transition whitespace-nowrap`}>
                                                    <span className="text-lg">📁</span>
                                                    <span className="text-sm font-bold">{localVideoUrl ? "動画選択済み" : "動画ファイルを選択"}</span>
                                                    <input 
                                                        type="file" 
                                                        accept="video/*" 
                                                        className="hidden" 
                                                        onChange={handleFileSelect}
                                                    />
                                                    <span className="text-xs text-slate-500 ml-2">※アップロードはされません</span>
                                                </label>
                                                {!localVideoUrl && analysisData && (
                                                    <div className="text-[10px] text-amber-500 font-bold px-1 animate-pulse">
                                                        ⚠ ページを移動したため、動画再選択が必要です
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Analysis Setup Panel */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                    <div className="flex flex-col gap-4">
                                        <div className="w-full">
                                             <label className="text-xs text-slate-400 font-bold block mb-2">分析モード (Analysis Mode)</label>
                                             <ModeSelector 
                                                 selectedMode={analysisMode} 
                                                 onSelect={setAnalysisMode} 
                                                 disabled={isAnalyzing}
                                             />
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 grid grid-cols-2 gap-4">
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
                                                <div className="col-span-2 md:col-span-1">
                                                    <label className="text-xs text-slate-400 font-bold block mb-1">具体的な悩み・質問 (任意)</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="例: この場面の立ち位置はどうだった？"
                                                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                        value={specificQuestion}
                                                        onChange={(e) => setSpecificQuestion(e.target.value)}
                                                    />
                                                </div>
                                            </div>
    
                                            <div className="w-full md:w-56 flex flex-col justify-end">
                                            {isAnalyzing || asyncStatus === 'processing' ? (
                                                <div className="relative w-full h-10 bg-slate-800 rounded overflow-hidden border border-slate-700 transition">
                                                    <div 
                                                        className="absolute top-0 left-0 h-full bg-blue-600/50 transition-all duration-300 ease-out"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10">
                                                        {Math.round(progress)}%
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
                                </div>
                                
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
                                    <div 
                                        id="youtube-player" 
                                        className={`w-full h-full ${videoSourceType === 'YOUTUBE' ? 'block' : 'hidden'}`}
                                    ></div>
                                    
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

                                {analysisData?.buildRecommendation && (
                                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 text-6xl">⚖️</div>
                                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                                            <span className="text-amber-400">💡</span> AI ビルド診断
                                        </h3>
                                        
                                        <div className="flex flex-col md:flex-row gap-8 mb-6">
                                            <div className="bg-slate-950/50 p-3 rounded border border-slate-700">
                                             <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase">あなたのビルド</div>
                                             <div className="flex flex-wrap gap-1">
                                                 {analysisData.buildRecommendation.userItems.map((item, idx) => (
                                                     <BuildItemCard key={idx} item={item} />
                                                 ))}
                                                 {analysisData.buildRecommendation.userItems.length === 0 && (
                                                      <span className="text-xs text-slate-500">No items found</span>
                                                 )}
                                             </div>
                                         </div>


                                         {analysisData.buildRecommendation.opponentItems && (
                                             <div className="bg-red-900/10 p-3 rounded border border-red-500/30 relative overflow-hidden">
                                                 <div className="text-[10px] font-bold text-red-300 mb-2 uppercase flex justify-between">
                                                     <span>対面のビルド (VS)</span>
                                                     <span className="opacity-70">{analysisData.buildRecommendation.opponentChampionName}</span>
                                                 </div>
                                                 <div className="flex flex-wrap gap-1 relative z-10">
                                                     {analysisData.buildRecommendation.opponentItems.map((item, idx) => (
                                                         <BuildItemCard key={idx} item={item} />
                                                     ))}
                                                     {analysisData.buildRecommendation.opponentItems.length === 0 && (
                                                          <span className="text-xs text-red-500/50">Unknown</span>
                                                     )}
                                                 </div>
                                             </div>
                                         )}

                                            <div className="hidden md:flex items-center justify-center text-slate-500">
                                                <span>vs</span>
                                            </div>

                                            <div className="flex-1 bg-purple-900/10 p-4 rounded border border-purple-500/30">
                                                <div className="text-xs font-bold text-purple-300 mb-2 uppercase">AI推奨ビルド (Recommended)</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysisData.buildRecommendation.recommendedItems.map((item, idx) => (
                                                        <BuildItemCard key={idx} item={item} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-slate-950/80 p-4 rounded text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {analysisData.buildRecommendation.analysis}
                                        </div>
                                    </div>
                                )}


                            </div>
                        )}
                    </div>

                    <div className="col-span-4 flex flex-col gap-6 h-full overflow-y-auto pb-10">
                         {/* Logic: Show Ad at Top if Analysis Present? User likely wants Ad visible. */}
                         {analysisData?.insights && analysisData.insights.length > 0 ? (
                             <div className="flex flex-col gap-6 animate-in slide-in-from-right-10 duration-500">
                                 {/* 1. Ad (Sponsored) */}
                                 <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                     <div className="text-[10px] font-bold text-slate-500 mb-2 text-center uppercase tracking-widest">SPONSORED</div>
                                     <AdSenseBanner slotId="1234567890" format="rectangle" />
                                 </div>

                                 {/* 2. Insights */}
                                 <div className="flex flex-col gap-4">
                                     <h3 className="font-bold text-slate-400 text-sm uppercase tracking-wider mb-2">
                                         🔍 分析レポート (クリックでジャンプ)
                                     </h3>
                                     {analysisData.insights.map((insight, idx) => (
                                         <div 
                                            key={idx} 
                                            onClick={() => seekTo(insight.timestamp)}
                                            className="bg-slate-900 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group transition cursor-pointer"
                                         >
                                             <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl group-hover:scale-110 transition duration-500">
                                                {insight.type === 'GOOD_PLAY' ? '👍' : insight.type === 'MISTAKE' ? '👎' : '💡'}
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                    insight.type === 'GOOD_PLAY' ? 'bg-green-500/20 text-green-300' :
                                                    insight.type === 'MISTAKE' ? 'bg-red-500/20 text-red-300' :
                                                    'bg-blue-500/20 text-blue-300'
                                                 }`}>
                                                     {insight.timestampStr}
                                                 </span>
                                                 <h4 className="font-bold text-white text-sm">{insight.title}</h4>
                                             </div>
                                             <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                                                 {insight.description}
                                             </p>
                                             {insight.advice && (
                                                 <div className="mt-2 pt-2 border-t border-slate-800">
                                                     <div className="text-[10px] text-amber-400 font-bold mb-0.5">コーチのアドバイス</div>
                                                     <p className="text-slate-400 text-xs">
                                                         {insight.advice}
                                                     </p>
                                                 </div>
                                             )}
                                         </div>
                                     ))}
                                 </div>


                             </div>
                         ) : (
                             <>
                                 <PremiumPromoCard initialStatus={status} />
                                 <AdSenseBanner slotId="1234567890" format="rectangle" />
                             </>
                         )}
                    </div>
                </div>

                <div className="absolute top-24 right-6 w-80">
                   {errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg shadow-xl backdrop-blur-md mb-4 animate-in fade-in slide-in-from-right-10 duration-300">
                            <strong>Error:</strong> {errorMsg}
                        </div>
                   )}
                </div>
            </div>
        </DashboardLayout>
    );
}
