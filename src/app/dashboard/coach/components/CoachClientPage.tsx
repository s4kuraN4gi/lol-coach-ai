"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import { type MatchSummary, type BuildItem } from "@/app/actions/coach";
import { useSummoner } from "@/app/Providers/SummonerProvider";
import { type AnalysisStatus, FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT, getWeeklyLimit } from "@/app/actions/constants";
import { triggerStripeCheckout } from "@/lib/checkout";
import PlanStatusBadge from "@/app/Components/subscription/PlanStatusBadge";
import VideoMacroAnalysis from "@/app/dashboard/components/Analysis/VideoMacroAnalysis";
import MicroAnalysisResult from "@/app/dashboard/components/Analysis/MicroAnalysisResult";
import { type VideoMacroAnalysisResult } from "@/app/actions/videoMacroAnalysis";
import { useVisionAnalysis } from "@/app/Providers/VisionAnalysisProvider";
import { useVideoMacroAnalysis } from "@/app/Providers/VideoMacroAnalysisProvider";
import { useCoachUI } from "@/app/Providers/CoachUIProvider";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCoachData } from "@/hooks/useCoachData";
import { FaEye, FaChartBar, FaUpload, FaYoutube, FaMagic, FaClock } from "react-icons/fa";
import CoachPageSkeleton from "./CoachPageSkeleton";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

// Props - only puuid needed, data fetched via SWR
export interface CoachClientPageProps {
    puuid: string;
}

// Helper
function extractVideoId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

export default function CoachClientPage({ puuid }: CoachClientPageProps) {
    // Context
    const router = useRouter();
    const { activeSummoner } = useSummoner();
    const { t } = useTranslation();

    // SWR hook - fetches data on client, caches for instant subsequent visits
    const {
        matches,
        status: swrStatus,
        analyzedIds,
        ddVersion,
        isLoading,
        isValidating,
        refreshStatus: refreshSWRStatus,
    } = useCoachData(puuid);

    // Local status state for updates
    const [status, setStatus] = useState<AnalysisStatus | null>(null);

    // Sync SWR status to local state
    useEffect(() => {
        if (swrStatus !== undefined) {
            setStatus(swrStatus);
        }
    }, [swrStatus]);

    // --- VISION PROVIDER INTEGRATION ---
    const {
        isVisionAnalyzing,
        isVerifying,
        visionProgress,
        visionMsg,
        globalVisionResult,
        visionError,
        startGlobalAnalysis,
        resetAnalysis: resetGlobalAnalysis,
        clearError: clearVisionError,
        restoreResultForMatch: restoreMicroResult
    } = useVisionAnalysis();

    // --- MACRO PROVIDER INTEGRATION ---
    const {
        result: macroProviderResult,
        currentMatchId: macroCurrentMatchId,
        restoreResultForMatch: restoreMacroResult
    } = useVideoMacroAnalysis();

    // --- UI STATE PERSISTENCE ---
    const {
        selectedMatch, setSelectedMatch,
        detailTab, setDetailTab,
        localFile, setLocalFile,
        videoPreviewUrl,
        videoSourceType, setVideoSourceType,
        youtubeUrl, setYoutubeUrl,
        startTime, setStartTime,
        specificQuestion,
        errorMsg, setErrorMsg,
        restoreFromLatest
    } = useCoachUI();

    // Restore MICRO analysis result when selected match changes
    useEffect(() => {
        if (selectedMatch?.matchId) {
            restoreMicroResult(selectedMatch.matchId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMatch?.matchId]);

    // Local-only UI State
    const [isAnalyzing, startTransition] = useTransition();
    const [isRestoring, setIsRestoring] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [ytPlayer, setYtPlayer] = useState<any>(null);
    const [videoMacroResult, setVideoMacroResult] = useState<VideoMacroAnalysisResult | null>(null);
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const restoredRef = useRef(false);

    // [Helper] Refresh Premium/Credit Status
    const refreshStatus = useCallback(async () => {
        await refreshSWRStatus();
    }, [refreshSWRStatus]);

    // Auto-Resume Handling (only on client, once)
    useEffect(() => {
        if (restoredRef.current) return;
        restoredRef.current = true;

        const isActiveSession = sessionStorage.getItem("COACH_SESSION_ACTIVE");
        if (isActiveSession === "true" && matches.length > 0) {
            setIsRestoring(true);
            restoreFromLatest(matches).finally(() => {
                setIsRestoring(false);
            });
        }
    }, [matches, restoreFromLatest]);

    // Clear video element state when video is removed
    useEffect(() => {
        if (videoSourceType !== 'LOCAL' || !videoPreviewUrl) {
            setVideoElement(null);
        }
    }, [videoSourceType, videoPreviewUrl]);

    // YouTube Embed Logic
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }
        window.onYouTubeIframeAPIReady = () => { /* Ready */ };
    }, []);

    // Handlers
    const loadYoutubeVideo = () => {
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
            await startGlobalAnalysis(localFile, selectedMatch, activeSummoner.puuid, specificQuestion, startTime);
            refreshStatus();
        } else if (youtubeUrl) {
            alert(t('coachPage.micro.youtubeNotSupported'));
            return;
        }
    };

    const seekTo = (timestampMs: number) => {
        let offset = 0;
        if (globalVisionResult?.timeOffset) {
            offset = globalVisionResult.timeOffset;
        }
        const gameTimeSec = timestampMs / 1000;
        const targetVideoTime = Math.max(0, gameTimeSec + offset);
        if (videoSourceType === "YOUTUBE" && ytPlayer && ytPlayer.seekTo) {
            ytPlayer.seekTo(targetVideoTime, true);
            ytPlayer.playVideo();
        } else if (videoSourceType === "LOCAL" && localVideoRef.current) {
            localVideoRef.current.currentTime = targetVideoTime;
            localVideoRef.current.play();
        }
    };

    // Helper Component for Build Items
    const BuildItemCard = ({ item }: { item: BuildItem }) => (
        <div className="flex items-center gap-2 group relative">
            <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0 border border-slate-600 overflow-hidden relative">
                {item.id && item.id > 0 ? (
                    <Image
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${item.id}.png`}
                        alt={item.itemName}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-xl">⚔️</span>
                )}
            </div>
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-black/90 border border-slate-700 text-white text-xs px-2 py-1 rounded w-32 text-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                {item.itemName}
                {item.reason && <div className="text-slate-400 mt-1">{item.reason}</div>}
            </div>
        </div>
    );

    // Show skeleton while loading (first visit or no cache)
    if (isLoading) {
        return (
            <DashboardLayout>
                <CoachPageSkeleton />
            </DashboardLayout>
        );
    }

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

                <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                    <div className="col-span-8 flex flex-col gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
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
                                {matches.length === 0 ? (
                                    <div className="text-slate-500">{t('coachPage.list.noMatches', 'No matches found. Play some games first!')}</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {matches.map(m => (
                                            <button
                                                key={m.matchId}
                                                onClick={() => {
                                                    // Free members get redirected to /analyze with match params
                                                    if (!status?.is_premium) {
                                                        router.push(`/analyze?matchId=${m.matchId}&puuid=${puuid}`);
                                                        return;
                                                    }
                                                    // Premium users stay on this page
                                                    setSelectedMatch(m);
                                                    sessionStorage.setItem("COACH_SESSION_ACTIVE", "true");
                                                    setErrorMsg(null);
                                                    setYoutubeUrl("");
                                                    setLocalFile(null);
                                                    setVideoReady(false);
                                                    setVideoSourceType("LOCAL");
                                                }}
                                                className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 transition rounded-lg group text-left"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-blue-400 transition">
                                                    <Image src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.championName}.png`} alt={m.championName} width={48} height={48} className="w-full h-full object-cover" />
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
                                                        {analyzedIds.includes(m.matchId) && (
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
                            <div className="flex flex-col gap-4 pb-10 animate-fadeIn">
                                {/* Selected Match Header */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-600 shadow-md">
                                            <Image
                                                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${selectedMatch.championName}.png`}
                                                alt={selectedMatch.championName}
                                                width={48}
                                                height={48}
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
                                </div>

                                {/* Controls Bar */}
                                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-xl mt-2">
                                    <button
                                        onClick={() => {
                                            setSelectedMatch(null);
                                            sessionStorage.removeItem("COACH_SESSION_ACTIVE");
                                        }}
                                        className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition shadow-sm flex items-center gap-1"
                                    >
                                        <span>←</span> {t('coachPage.controls.back')}
                                    </button>
                                    <div className="h-6 w-px bg-slate-700 mx-2"></div>

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

                                {/* MICRO TAB */}
                                {detailTab === 'MICRO' && (
                                    <div className="bg-slate-900 border border-purple-500/30 p-4 rounded-xl relative overflow-hidden">
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                        <h3 className="font-bold text-purple-300 mb-2 flex items-center gap-2">
                                            <FaMagic /> {t('coachPage.micro.title')}
                                        </h3>
                                        <p className="text-xs text-slate-400 mb-4">{t('coachPage.micro.description')}</p>

                                        {localFile && (
                                            <div className="mb-4 bg-slate-950 p-2 rounded border border-slate-800">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-slate-400">
                                                        <p>{t('coachPage.micro.fileInfo').replace('{name}', localFile.name)}</p>
                                                        <p className="text-purple-400 font-bold mt-1">
                                                            {t('coachPage.micro.rangeInfo').replace('{start}', startTime.toFixed(1)).replace('{end}', (startTime + 30).toFixed(1))}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (localVideoRef.current) {
                                                                setStartTime(localVideoRef.current.currentTime);
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-1 transition"
                                                    >
                                                        <FaClock /> {t('coachPage.micro.analyzeRange')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!localFile && !youtubeUrl ? (
                                            <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-800/50">
                                                <p className="text-slate-400 text-sm">{t('coachPage.micro.noVideo')}</p>
                                            </div>
                                        ) : localFile && (
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
                                                {visionError && !visionError.includes("MATCH_INTEGRITY_ERROR:") && (
                                                    <div className="mt-2 p-2 bg-red-900/20 text-red-300 text-xs rounded border border-red-500/20 flex justify-between items-center">
                                                        <span>{t('coachPage.micro.visionError')}: {visionError}</span>
                                                        <button onClick={clearVisionError} className="text-white hover:text-red-200">✕</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {globalVisionResult && (
                                            <div className="mt-4">
                                                <MicroAnalysisResult result={globalVisionResult} onReanalyze={runMicroAnalysis} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* MACRO TAB */}
                                {/* Show when: has video (for new analysis) OR has saved result (for viewing) */}
                                {detailTab === 'MACRO' && selectedMatch && activeSummoner?.puuid && (
                                    <VideoMacroAnalysis
                                        matchId={selectedMatch.matchId}
                                        puuid={activeSummoner.puuid}
                                        videoFile={localFile}
                                        videoElement={videoElement}
                                        onAnalysisComplete={(result) => {
                                            setVideoMacroResult(result);
                                            refreshStatus();
                                        }}
                                        disabled={(() => {
                                            const weeklyCount = status?.weekly_analysis_count || 0;
                                            const limit = getWeeklyLimit(status);
                                            return weeklyCount >= limit;
                                        })()}
                                        isPremium={status?.is_premium || false}
                                        subscriptionTier={status?.subscription_tier || 'free'}
                                        weeklyRemaining={Math.max(0, getWeeklyLimit(status) - (status?.weekly_analysis_count || 0))}
                                        weeklyLimit={getWeeklyLimit(status)}
                                    />
                                )}

                                {/* MICRO Analyze Button */}
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
                                                const weeklyCount = status?.weekly_analysis_count || 0;
                                                const limit = getWeeklyLimit(status);
                                                const remaining = Math.max(0, limit - weeklyCount);
                                                const canAnalyze = remaining > 0;

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
                                                            disabled={!videoReady || !canAnalyze}
                                                            className={`w-full px-4 py-2.5 rounded font-bold text-sm transition shadow-lg whitespace-nowrap flex items-center justify-center gap-2 group h-10
                                                                ${!videoReady || !canAnalyze
                                                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                                                    : isPremium
                                                                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20"
                                                                        : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:scale-105 shadow-cyan-500/20"
                                                                }`}
                                                        >
                                                            {!canAnalyze ? (
                                                                <span>{t('coachPage.analysis.weeklyLimitReached', '週間上限に達しました')}</span>
                                                            ) : isPremium ? (
                                                                <span>🧠 {t('coachPage.analysis.analyzeButton')} ({remaining}/{limit})</span>
                                                            ) : (
                                                                <span>{t('coachPage.analysis.weeklyRemaining', '残り{remaining}回').replace('{remaining}', remaining.toString())}</span>
                                                            )}
                                                        </button>
                                                        {!canAnalyze && !isPremium && (
                                                            <button
                                                                onClick={() => startTransition(async () => { await triggerStripeCheckout(); })}
                                                                className="w-full px-3 py-1.5 rounded text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-105 transition"
                                                            >
                                                                {t('statusBadge.upgradeToPremium')}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                )}

                                {/* Error Display */}
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
                                                    {t('coachPage.results.matchVerificationErrorDetail')}<br />
                                                    <span className="text-xs opacity-70">{t('coachPage.results.selectedMatch').replace('{name}', selectedMatch?.championName || '').replace('{kda}', selectedMatch?.kda || '')}</span>
                                                </p>
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

                                {/* Video Player */}
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
                                    <div
                                        id="youtube-player"
                                        className={`w-full h-full ${videoSourceType === 'YOUTUBE' ? 'block' : 'hidden'}`}
                                    ></div>

                                    {videoSourceType === 'LOCAL' && videoPreviewUrl && (
                                        <video
                                            ref={(el) => {
                                                localVideoRef.current = el;
                                                // Update state when video element is mounted/unmounted
                                                if (el && el !== videoElement) {
                                                    setVideoElement(el);
                                                }
                                            }}
                                            src={videoPreviewUrl}
                                            controls
                                            className="w-full h-full object-contain bg-black"
                                            onLoadedMetadata={(e) => {
                                                // Ensure state is set when video metadata is loaded
                                                setVideoElement(e.currentTarget);
                                            }}
                                        />
                                    )}

                                    {!videoReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-2 pointer-events-none bg-slate-950/80 z-10">
                                            <span className="text-4xl">📺</span>
                                            <span>{t('coachPage.results.placeholder')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Tips */}
                    <div className="col-span-4 flex flex-col gap-6 h-full overflow-y-auto pb-10 custom-scrollbar">
                        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                            <h3 className="text-sm font-bold text-slate-300 mb-3">{t('coachPage.tips.title', '使い方')}</h3>
                            <ul className="text-xs text-slate-400 space-y-2">
                                <li>1. {t('coachPage.tips.step1', '分析したい試合を選択')}</li>
                                <li>2. {t('coachPage.tips.step2', '動画ファイルをアップロード')}</li>
                                <li>3. {t('coachPage.tips.step3', 'AIが重要シーンを自動分析')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verification Overlay */}
            {detailTab === 'MICRO' && isVerifying && !status?.is_premium && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                                    <FaEye className="text-blue-400" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                    {t('coachPage.verification.aiVerifying')}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium">
                                    {t('coachPage.verification.checkingConsistency')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
