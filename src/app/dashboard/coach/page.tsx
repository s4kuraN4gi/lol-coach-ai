"use client";

import { useState, useEffect, useTransition, useCallback, useRef, useMemo } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import { fetchMatchIds, fetchMatchDetail, fetchLatestVersion } from "@/app/actions/riot";
import { getCoachMatches, analyzeMatchTimeline, CoachingInsight, AnalysisFocus, AnalysisResult, BuildItem, type MatchSummary, type TurningPoint, type Homework, type StrengthWeakness } from "@/app/actions/coach";
import { useSummoner } from "../../Providers/SummonerProvider";
import { getAnalysisStatus, claimDailyReward, analyzeVideo, getVideoAnalysisStatus, getAnalyzedMatchIds, getLatestActiveAnalysis } from "@/app/actions/analysis";
import { type AnalysisStatus } from "@/app/actions/constants";
import { triggerStripeCheckout } from "@/lib/checkout";
import PlanStatusBadge from "../../Components/subscription/PlanStatusBadge";
import PremiumPromoCard from "../../Components/subscription/PremiumPromoCard";
import AdSenseBanner from "../../Components/ads/AdSenseBanner";
import VideoMacroAnalysis from "../components/Analysis/VideoMacroAnalysis";
import { type VideoMacroAnalysisResult } from "@/app/actions/videoMacroAnalysis";
import { useVisionAnalysis } from "@/app/Providers/VisionAnalysisProvider";
import { useCoachUI } from "@/app/Providers/CoachUIProvider";
import { useTranslation } from "@/contexts/LanguageContext";
import { FaEye, FaChartBar, FaUpload, FaYoutube, FaMagic, FaClock } from "react-icons/fa"; // Added icons

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

// Helper
function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

export default function CoachPage() {
    // Context
    const { activeSummoner, loading: summonerLoading } = useSummoner();
    const { t } = useTranslation();

    // --- VISION PROVIDER INTEGRATION ---
    const { 
        isVisionAnalyzing, 
        isVerifying,
        visionProgress, 
        visionMsg, 
        globalVisionResult, 
        visionError, 
        startGlobalAnalysis, 
        verifyVideo,
        resetAnalysis: resetGlobalAnalysis,
        clearError: clearVisionError,
        setIsVerifying,
        debugFrames // Expose Debug Frames
    } = useVisionAnalysis();

    // Debug Log
    useEffect(() => {
        console.log("[CoachPage] debugFrames Refreshed:", debugFrames?.length);
    }, [debugFrames]);

    // --- UI STATE PERSISTENCE ---
    const {
        selectedMatch, setSelectedMatch,
        detailTab, setDetailTab,
        localFile, setLocalFile,
        videoPreviewUrl,
        videoSourceType, setVideoSourceType,
        youtubeUrl, setYoutubeUrl,
        startTime, setStartTime,
        specificQuestion, setSpecificQuestion,
        errorMsg, setErrorMsg,
        resetCoachUI,
        restoreFromLatest
    } = useCoachUI();

    // Local-only State
    const [matches, setMatches] = useState<MatchSummary[]>([]);
    const [loadingIds, setLoadingIds] = useState(true);
    const [status, setStatus] = useState<AnalysisStatus | null>(null); // Premium Status
    const [isAnalyzing, startTransition] = useTransition();
    const [isRestoring, setIsRestoring] = useState(true);
    const [rewardAdOpen, setRewardAdOpen] = useState(false);
    const [rewardLoading, setRewardLoading] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [ddVersion, setDdVersion] = useState("14.24.1");
    const [ytPlayer, setYtPlayer] = useState<any>(null); 
    const [focusArea, setFocusArea] = useState<string>("MACRO"); 
    const [analyzedMatchIds, setAnalyzedMatchIds] = useState<string[]>([]); // New State
    const [videoMacroResult, setVideoMacroResult] = useState<VideoMacroAnalysisResult | null>(null); // Video Macro Analysis Result

    // Refs
    const analysisStartTime = useRef<number>(0);

    // Fetch latest version on mount
    useEffect(() => {
        fetchLatestVersion().then(v => setDdVersion(v));
    }, []);
    
    // Players
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // [Helper] Refresh Premium/Credit Status
    const refreshStatus = useCallback(async () => {
        const s = await getAnalysisStatus();
        setStatus(s);
    }, []);

    // Load Premium Status
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Macro Analysis Polling and Progress are now handled by CoachUIProvider


    // Fetch Matches logic (Cache First)
    const loadMatches = useCallback(async () => {
        if (!activeSummoner?.puuid) return;
        
        setLoadingIds(true);
        const puuid = activeSummoner.puuid;
        
        // Cache-First: Get matches from DB directly
        const dbMatches = await getCoachMatches(puuid);
        
        if (dbMatches && dbMatches.length > 0) {
            setMatches(dbMatches);
        } else {
            // Fallback: If DB is empty, user might be new.
            // Ideally we guide them to Dashboard or trigger update.
            // keeping it empty for now, or could trigger fetchMatchIds here.
            setMatches([]); 
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

    // Auto-Resume Handling
    useEffect(() => {
        // Initial Fetch for analyzed matches
        getAnalyzedMatchIds().then(ids => {
            setAnalyzedMatchIds(ids);
        });

        if (!loadingIds && matches.length > 0) {
            // Only restore if this is an ACTIVE session (Navigation within app)
            // If Hard Reload (sessionStorage cleared or flag missing), do NOT restore
            const isActiveSession = sessionStorage.getItem("COACH_SESSION_ACTIVE");
            console.log("[CoachPage] Auto-Resume Check. Flag:", isActiveSession); // DEBUG LOG
            
            if (isActiveSession === "true") {
                console.log("[CoachPage] Restoring session...");
                restoreFromLatest(matches).finally(() => {
                    setIsRestoring(false);
                });
            } else {
                console.log("[CoachPage] Session flag missing. Skipping restore.");
                setIsRestoring(false); // No restore needed
            }
        } else if (!loadingIds && matches.length === 0) {
            setIsRestoring(false);
        }
    }, [matches, loadingIds, restoreFromLatest]);

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
            alert(t('coachPage.controls.invalidYoutube'));
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

        setLocalFile(file);
        setVideoSourceType("LOCAL");
        setVideoReady(true);
        resetGlobalAnalysis();
        
        if (ytPlayer && ytPlayer.pauseVideo) {
            ytPlayer.pauseVideo();
        }
    };

    // MICRO Vision Analysis only (MACRO is handled by VideoMacroAnalysis component)
    const runMicroAnalysis = async () => {
        if (!localFile && !youtubeUrl) {
            alert(t('coachPage.controls.selectVideo'));
            return;
        }
        if (!selectedMatch || !activeSummoner?.puuid) {
            alert(t('coachPage.list.selectMatch'));
            return;
        }
        if (localFile) {
            // Trigger Global Vision Analysis for local file
            await startGlobalAnalysis(localFile, selectedMatch, activeSummoner.puuid, specificQuestion, startTime);
            refreshStatus(); // Refresh credits immediately
        } else if (youtubeUrl) {
            alert(t('coachPage.micro.youtubeNotSupported'));
            return;
        }
    }

    const seekTo = (timestampMs: number) => {
        // [TIME SYNC] Apply Offset for MICRO Vision Analysis
        let offset = 0;
        if (globalVisionResult?.timeOffset) {
            offset = globalVisionResult.timeOffset;
        }

        const gameTimeSec = timestampMs / 1000;
        const targetVideoTime = Math.max(0, gameTimeSec + offset);

        console.log(`[Seek] GameTime: ${gameTimeSec}s, Offset: ${offset}s -> VideoTime: ${targetVideoTime}s`);

        if (videoSourceType === "YOUTUBE" && ytPlayer && ytPlayer.seekTo) {
            ytPlayer.seekTo(targetVideoTime, true);
            ytPlayer.playVideo();
        } else if (videoSourceType === "LOCAL" && localVideoRef.current) {
            localVideoRef.current.currentTime = targetVideoTime;
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
                <header className="mb-6 flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                     <div>
                        <h1 className="text-3xl font-black italic tracking-tighter text-foreground">
                             AI COACH <span className="text-sm not-italic font-normal text-slate-500 ml-2 border border-slate-700 px-2 rounded">{t('coachPage.header.subtitle')}</span>
                        </h1>
                        <p className="text-slate-400 text-sm">{t('coachPage.header.description')}</p>
                     </div>
                     
                     <div className="flex items-center gap-4">
                        {/* TAB SWITCHER (Restored Top Right Location) */}
                        {selectedMatch && (
                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                <button
                                    onClick={() => setDetailTab('MACRO')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                                        detailTab === 'MACRO' 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <FaChartBar /> {t('coachPage.tabs.macro')}
                                </button>
                                <button
                                    onClick={() => setDetailTab('MICRO')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                                        detailTab === 'MICRO' 
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <FaEye /> {t('coachPage.tabs.micro')}
                                </button>
                            </div>
                        )}
                        <PlanStatusBadge initialStatus={status} onStatusUpdate={setStatus} />
                     </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                    
                    {/* Left: Match Selection & Video (8 Cols) */}
                    <div className="col-span-8 flex flex-col gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
                        
                        {/* LIST VIEW: Show when NO match selected */}
                        {isRestoring ? (
                             <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-full flex items-center justify-center min-h-[300px]">
                                 <div className="flex flex-col items-center gap-4">
                                     <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                                     <p className="text-slate-400 font-bold animate-pulse">{t('coachPage.list.restoring')}</p>
                                 </div>
                             </div>
                        ) : !selectedMatch ? (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-slate-200 mb-4">{t('coachPage.list.selectMatch')}</h2>
                                {loadingIds ? (
                                     <div className="text-slate-500">{t('coachPage.list.loadingHistory').replace('{name}', activeSummoner?.summoner_name || '')}</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {matches.map(m => (
                                            <button 
                                                key={m.matchId}
                                                onClick={() => {
                                                    setSelectedMatch(m);
                                                    sessionStorage.setItem("COACH_SESSION_ACTIVE", "true"); // Mark session as active
                                                    setDetailTab('MACRO');

                                                    // Reset UI state
                                                    setErrorMsg(null);
                                                    setYoutubeUrl("");
                                                    setLocalFile(null);
                                                    setVideoReady(false);
                                                    setVideoSourceType("LOCAL");
                                                }}
                                                className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 transition rounded-lg group text-left"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-blue-400 transition">
                                                     <img src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.championName}.png`} alt={m.championName} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className={`font-bold ${m.win ? "text-blue-400" : "text-red-400"}`}>
                                                        {m.win ? t('coachPage.list.win') : t('coachPage.list.lose')}
                                                    </div>
                                                    <div className="text-sm text-slate-400">
                                                        {m.championName} • {m.kda} KDA
                                                    </div>
                                                    <div className="text-xs text-slate-600 flex items-center gap-2">
                                                        {new Date(m.timestamp).toLocaleDateString()}
                                                        {analyzedMatchIds.includes(m.matchId) && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                                                                {t('coachPage.list.macroDone')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* DETAIL VIEW: Show when Match Selected */
                            <div className="flex flex-col gap-4 pb-10 animate-fadeIn">
                                {/* Selected Match Context Header (Separated) */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-600 shadow-md">
                                            <img 
                                                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${selectedMatch.championName}.png`} 
                                                alt={selectedMatch.championName} 
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3 mb-0.5">
                                                <h2 className="text-xl font-black text-white italic tracking-tight">{selectedMatch.championName}</h2>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                    selectedMatch.win 
                                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30" 
                                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                                                }`}>
                                                    {selectedMatch.win ? t('coachPage.list.win') : t('coachPage.list.lose')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                                                <span className="text-slate-300">KDA: {selectedMatch.kda}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                <span>{new Date(selectedMatch.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Additional Metadata or Decorative element could go here */}
                                </div>

                                {/* Controls Bar (Cleaned) */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-xl mt-2">
                                    <button
                                        onClick={() => {
                                            setSelectedMatch(null);
                                            sessionStorage.removeItem("COACH_SESSION_ACTIVE"); // Clear session flag
                                        }}
                                        className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition shadow-sm flex items-center gap-1"
                                    >
                                        <span>←</span> {t('coachPage.controls.back')}
                                    </button>
                                    <div className="h-6 w-px bg-slate-700 mx-2"></div>
                                    
                                    {/* Video Input Controls */}
                                    <div className="flex-1 flex gap-2 overflow-x-auto items-center justify-end">
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
                                            <div className="flex items-center gap-2 bg-slate-950 rounded px-2 border border-slate-700 w-full max-w-sm">
                                                <span className="text-red-500 text-lg"><FaYoutube /></span>
                                                <input 
                                                    type="text" 
                                                    placeholder={t('coachPage.controls.youtubePlaceholder')} 
                                                    className="bg-transparent text-white w-full transition-all outline-none text-sm py-2"
                                                    value={youtubeUrl}
                                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                                />
                                                <button 
                                                    onClick={loadYoutubeVideo}
                                                    disabled={!youtubeUrl}
                                                    className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-white whitespace-nowrap"
                                                >
                                                    {t('coachPage.controls.load')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 w-full max-w-sm">
                                                <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded cursor-pointer transition whitespace-nowrap overflow-hidden">
                                                    <span className="text-lg"><FaUpload /></span>
                                                    <span className="text-sm font-bold truncate">{videoPreviewUrl ? t('coachPage.controls.fileSelected') : t('coachPage.controls.selectFile')}</span>
                                                    <input 
                                                        type="file" 
                                                        accept="video/*" 
                                                        className="hidden" 
                                                        onChange={handleFileSelect}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* MICRO TAB EXCLUSIVE: Vision Analysis Results */}
                                {detailTab === 'MICRO' && (
                                     <div className="bg-slate-900 border border-purple-500/30 p-4 rounded-xl relative overflow-hidden">
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                        <h3 className="font-bold text-purple-300 mb-2 flex items-center gap-2">
                                            <FaMagic /> {t('coachPage.micro.title')}
                                        </h3>
                                        <p className="text-xs text-slate-400 mb-4">
                                            {t('coachPage.micro.description')}
                                        </p>
                                        
                                        {/* Local Video Preview & Seek UI */}
                                        {localFile && (
                                            <div className="mb-4 bg-slate-950 p-2 rounded border border-slate-800">
                                                <video 
                                                    id="preview-video"
                                                    controls 
                                                    className="w-full max-h-[300px] rounded bg-black mb-2"
                                                    src={videoPreviewUrl}
                                                />
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-slate-400">
                                                        <p>{t('coachPage.micro.fileInfo').replace('{name}', localFile.name)}</p>
                                                        <p className="text-purple-400 font-bold mt-1">
                                                            {t('coachPage.micro.rangeInfo').replace('{start}', startTime.toFixed(1)).replace('{end}', (startTime + 30).toFixed(1))}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const vid = document.getElementById('preview-video') as HTMLVideoElement;
                                                            if (vid) {
                                                                setStartTime(vid.currentTime);
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-1 transition"
                                                    >
                                                        <FaClock /> {t('coachPage.micro.analyzeRange')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Status & Results */}
                                        {!localFile && !youtubeUrl ? (
                                             <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-800/50">
                                                <p className="text-slate-400 text-sm">{t('coachPage.micro.noVideo')}</p>
                                             </div>
                                        ) : (
                                            localFile && (
                                                <div className="p-4 bg-slate-950/50 rounded border border-slate-800">
                                                    {isVisionAnalyzing && (
                                                        <div className="mt-2">
                                                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                                <span>{t('coachPage.micro.processing')}</span>
                                                                <span>{Math.round(visionProgress)}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-800 rounded-full h-2">
                                                                <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${visionProgress}%` }}></div>
                                                            </div>
                                                            <p className="text-center text-xs text-slate-500 mt-2 animate-pulse">{visionMsg}</p>
                                                        </div>
                                                    )}
                                                    {/* Inline Vision Error display kept for non-mismatch errors */}
                                                    {visionError && !visionError.includes("MATCH_INTEGRITY_ERROR:") && (
                                                        <div className="mt-2 p-2 bg-red-900/20 text-red-300 text-xs rounded border border-red-500/20 flex justify-between items-center">
                                                            <span>{t('coachPage.micro.visionError')}: {visionError}</span>
                                                            <button onClick={clearVisionError} className="text-white hover:text-red-200">✕</button>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Analysis Button REMOVED - Unified to main button */}
                                                </div>
                                            )
                                        )}

                                        {/* Result Display */}
                                        {globalVisionResult && (
                                            <div className="mt-4 space-y-4 animate-fadeIn">
                                                <div className="bg-slate-950 p-4 rounded border border-slate-700">
                                                    <h4 className="font-bold text-white mb-2 border-b border-slate-800 pb-2">{t('coachPage.micro.reportTitle')}</h4>
                                                    <div className="space-y-4">
                                                        {/* Summary */}
                                                        <div>
                                                           <h5 className="text-xs font-bold text-purple-400 mb-1">{t('coachPage.micro.summary')}</h5>
                                                           <p className="text-sm text-slate-300 leading-relaxed">{globalVisionResult.summary}</p>
                                                        </div>
                                                        {/* Step-by-Step Advice from Mistakes */}
                                                        <div>
                                                            <h5 className="text-xs font-bold text-red-400 mb-1">{t('coachPage.micro.mistakes')}</h5>
                                                            <ul className="space-y-2">
                                                                {globalVisionResult.mistakes.map((mk, idx) => (
                                                                    <li key={idx} className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border-l-2 border-red-500">
                                                                        <span className="font-bold text-red-300">[{mk.timestamp}] {mk.title}</span><br/>
                                                                        {mk.advice}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {globalVisionResult.finalAdvice && (
                                                                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                                                                    <h5 className="text-xs font-bold text-blue-400 mb-1">{t('coachPage.micro.finalAdvice')}</h5>
                                                                    <p className="text-sm text-slate-300">{globalVisionResult.finalAdvice}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 text-right">
                                                         <button 
                                                            onClick={runMicroAnalysis} // Re-run MICRO analysis
                                                            className="text-xs text-slate-400 hover:text-white underline"
                                                         >
                                                             {t('coachPage.micro.analyzeAnother')}
                                                         </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                     </div>
                                )}


                                {/* VIDEO MACRO ANALYSIS - Show when video is selected in MACRO tab */}
                                {detailTab === 'MACRO' && localFile && selectedMatch && activeSummoner?.puuid && (
                                    <VideoMacroAnalysis
                                        matchId={selectedMatch.matchId}
                                        puuid={activeSummoner.puuid}
                                        videoFile={localFile}
                                        videoElement={localVideoRef.current}
                                        onAnalysisComplete={(result) => {
                                            setVideoMacroResult(result);
                                            refreshStatus();
                                        }}
                                        disabled={!status?.is_premium && (status?.analysis_credits || 0) <= 0}
                                    />
                                )}

                                {/* ANALYZE BUTTON (MICRO Tab Only - MACRO uses VideoMacroAnalysis) */}
                                {detailTab === 'MICRO' && (
                                    <div className="w-full flex justify-end">
                                        {isVisionAnalyzing ? (
                                            <div className="flex flex-col gap-2 w-full md:w-56">
                                                <div className="relative w-full h-10 bg-slate-800 rounded overflow-hidden border border-slate-700 transition">
                                                    <div
                                                        className="absolute top-0 left-0 h-full transition-all duration-300 ease-out bg-purple-600/50"
                                                        style={{ width: `${visionProgress}%` }}
                                                    ></div>
                                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10">
                                                        {t('coachPage.analysis.analyzing').replace('{progress}', Math.round(visionProgress).toString())}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            (() => {
                                                const isPremium = status?.is_premium;
                                                const credits = status?.analysis_credits ?? 0;
                                                const hasCredits = credits > 0;
                                                const canAnalyze = isPremium || hasCredits;

                                                return (
                                                    <div className="flex flex-col gap-2 w-full md:w-56">
                                                        <button
                                                            onClick={() => {
                                                                if (canAnalyze) {
                                                                    runMicroAnalysis();
                                                                } else {
                                                                    startTransition(async () => {
                                                                        await triggerStripeCheckout();
                                                                    });
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
                                                                <span>🧠 {t('coachPage.analysis.analyzeButton')}</span>
                                                            ) : hasCredits ? (
                                                                <span>{t('coachPage.analysis.creditsRemaining').replace('{credits}', credits.toString())}</span>
                                                            ) : (
                                                                <span>{t('statusBadge.upgradeToPremium')}</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                )}

                                {/* NEW ERROR DISPLAY POSITION (Between Button and Video) */}
                                {((visionError && visionError.includes("MATCH_INTEGRITY_ERROR:")) || (errorMsg && errorMsg.includes("MATCH_INTEGRITY_ERROR:"))) && (
                                    <div className="w-full mt-4 mb-4 bg-red-900/20 border border-red-500/50 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-red-500/10 rounded-full flex-shrink-0 flex items-center justify-center text-red-500 text-xl shadow-inner border border-red-500/20">
                                                ⚠️
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-red-100 flex items-center gap-2">
                                                    {t('coachPage.results.matchVerificationError')}
                                                    <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded uppercase tracking-wider border border-red-500/20">Error</span>
                                                </h3>
                                                <p className="text-red-200/70 text-sm mt-1 mb-3">
                                                    {t('coachPage.results.matchVerificationErrorDetail')}<br/>
                                                    <span className="text-xs opacity-70">{t('coachPage.results.selectedMatch').replace('{name}', selectedMatch?.championName || '').replace('{kda}', selectedMatch?.kda || '')}</span>
                                                </p>
                                                
                                                {/* REMOVED DETAILS AS REQUESTED */}

                                                {/* DEBUG FRAMES: Show what AI saw */}


                                                <button 
                                                    onClick={() => {
                                                        if (visionError) clearVisionError();
                                                        if (errorMsg) setErrorMsg(null);
                                                    }}
                                                    className="mt-3 text-xs text-red-400 hover:text-red-300 underline underline-offset-4 decoration-red-500/30 hover:decoration-red-400 transition-colors"
                                                >
                                                    {t('coachPage.results.closeError')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
                                    <div 
                                        id="youtube-player" 
                                        className={`w-full h-full ${videoSourceType === 'YOUTUBE' ? 'block' : 'hidden'}`}
                                    ></div>
                                    
                                    {videoSourceType === 'LOCAL' && videoPreviewUrl && (
                                        <video
                                            ref={localVideoRef}
                                            src={videoPreviewUrl}
                                            controls
                                            className="w-full h-full object-contain bg-black"
                                        />
                                    )}

                                    {!videoReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-2 pointer-events-none bg-slate-950/80 z-10">
                                            <span className="text-4xl">📺</span>
                                            <span>{t('coachPage.results.placeholder')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* MICRO TAB RESULTS (Global Vision Result) */}
                                {detailTab === 'MICRO' && globalVisionResult && (
                                    <div className="mt-4 bg-slate-900 border border-green-500/30 p-4 rounded-xl animate-in slide-in-from-bottom-5">
                                        <h3 className="text-lg font-bold text-green-400 mb-2">{t('coachPage.results.analysisCompleted')}</h3>
                                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-black p-4 rounded overflow-auto max-h-96">
                                            {JSON.stringify(globalVisionResult, null, 2)}
                                        </pre>
                                    </div>
                                )}


                            </div>
                        )}
                    </div>

                    {/* Right Column: Promo & Ads (4 Cols) */}
                    <div className="col-span-4 flex flex-col gap-6 h-full overflow-y-auto pb-10 custom-scrollbar">
                        <PremiumPromoCard initialStatus={status} />
                        <AdSenseBanner slotId="1234567890" format="rectangle" />
                    </div>
                </div>
            </div>
            {/* VERIFICATION & AD OVERLAY (Free Users Only - MICRO Tab) */}
            {detailTab === 'MICRO' && isVerifying && !status?.is_premium && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
                        
                        {/* Status Message */}
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                                    {detailTab === 'MICRO' ? <FaEye className="text-blue-400" /> : <FaChartBar className="text-blue-400" />}
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                    {detailTab === 'MICRO' ? "AIが動画を照合中" : "AI解析の準備中"}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium">
                                    {detailTab === 'MICRO' 
                                        ? "動画と試合データに不整合がないか確認しています..." 
                                        : "最新の試合データとタイムラインを読み込んでいます..."}
                                </p>
                            </div>
                        </div>

                        {/* Ad / Sponsored Section (Only for Non-Premium) */} 
                        <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden group animate-in zoom-in-95 duration-700 delay-300">
                            <div className="text-[10px] font-bold text-slate-500 mb-4 text-center uppercase tracking-[0.2em]">Sponsored Content</div>
                            
                            <div className="min-h-[250px] flex items-center justify-center bg-slate-950/50 rounded-xl border border-dashed border-slate-700">
                                <div className="flex flex-col items-center gap-4 p-8 text-center">
                                    <AdSenseBanner slotId="1234567890" format="rectangle" />
                                    <div className="mt-4 p-4 bg-purple-600/10 border border-purple-500/20 rounded-lg max-w-sm">
                                        <p className="text-xs text-purple-300 leading-relaxed font-bold">
                                            ✨ PREMIUMプランなら広告なしで即解析 ✨
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 text-center text-[10px] text-slate-500">この広告収益はAI解析機能の維持に充てられています。</div>
                        </div>
                    </div>
                </div>
            )}


        </DashboardLayout>
    );
}
