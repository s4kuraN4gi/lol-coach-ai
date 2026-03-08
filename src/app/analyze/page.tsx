"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaMapMarkerAlt, FaSearch, FaUser, FaGamepad, FaCrown, FaArrowLeft, FaLock } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AdSenseBanner from "@/app/components/ads/AdSenseBanner";
import RewardedAdModal from "@/app/components/ads/RewardedAdModal";
import { GUEST_FIXED_SEGMENTS, type GuestSegment } from "@/app/actions/guestConstants";
import {
    canPerformGuestAnalysis,
    performGuestAnalysis,
    performGuestMicroAnalysis,
    type GuestAnalysisResult,
} from "@/app/actions/guestAnalysis";
import { detectGameTimeFromFrame, selectAnalysisSegments, type VideoMacroSegment } from "@/app/actions/videoMacroAnalysis";
import { getMatchSummary, type MatchSummary } from "@/app/actions/coach";
import { fetchLatestVersion, fetchMatchDetail } from "@/app/actions/riot";
import { startVisionAnalysis, verifyMatchVideo, type VisionAnalysisResult } from "@/app/actions/vision";
import { getAnalysisJobStatus } from "@/app/actions/analysis";
import { VideoProcessor } from "@/lib/videoProcessor";
import { FREE_MAX_SEGMENTS, FRAMES_PER_SEGMENT } from "@/app/actions/constants";
import { logger } from "@/lib/logger";

import VideoUploader from "./components/VideoUploader";
import AnalysisControlPanel from "./components/AnalysisControlPanel";
import MacroResultSection from "./components/MacroResultSection";
import MicroResultSection from "./components/MicroResultSection";

export default function AnalyzePage() {
    const { t, language } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL params for free member mode
    const matchIdParam = searchParams.get("matchId");
    const puuidParam = searchParams.get("puuid");
    const hasMatchParams = !!(matchIdParam && puuidParam);

    // Video state
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Revoke previous ObjectURL when videoUrl changes or component unmounts
    const prevVideoUrlRef = useRef<string | null>(null);
    useEffect(() => {
        if (prevVideoUrlRef.current && prevVideoUrlRef.current !== videoUrl) {
            URL.revokeObjectURL(prevVideoUrlRef.current);
        }
        prevVideoUrlRef.current = videoUrl;
        return () => {
            if (prevVideoUrlRef.current) {
                URL.revokeObjectURL(prevVideoUrlRef.current);
            }
        };
    }, [videoUrl]);

    // Credit state
    const [creditInfo, setCreditInfo] = useState<{
        canAnalyze: boolean;
        isGuest: boolean;
        credits: number;
        maxCredits: number;
        nextCreditAt: Date | null;
        upgradeMessage?: string;
        isPremium?: boolean;
    } | null>(null);

    // Analysis state
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<GuestAnalysisResult | null>(null);
    const [expandedSegment, setExpandedSegment] = useState<number | null>(null);

    // Match info for display
    const [matchInfo, setMatchInfo] = useState<MatchSummary | null>(null);
    const [ddragonVersion, setDdragonVersion] = useState<string>("14.24.1");

    // Free member mode: auto-selected segments from match data
    const [autoSegments, setAutoSegments] = useState<VideoMacroSegment[]>([]);
    const [loadingSegments, setLoadingSegments] = useState(false);

    // Time calibration
    const [timeOffset, setTimeOffset] = useState(0);
    const [isCalibrated, setIsCalibrated] = useState(false);

    // Match verification
    const [isVerifying, setIsVerifying] = useState(false);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Analysis mode (macro/micro)
    const [analysisMode, setAnalysisMode] = useState<'macro' | 'micro'>('macro');

    // Turnstile CAPTCHA token for guest bot protection
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

    // Micro analysis state
    const [videoDuration, setVideoDuration] = useState(0);
    const [microStartTime, setMicroStartTime] = useState(0);
    const [microResult, setMicroResult] = useState<VisionAnalysisResult | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Reward ad state
    const [showRewardAd, setShowRewardAd] = useState(false);
    const [adCompleted, setAdCompleted] = useState(false);

    // Upgrade modal (shown once per session when credits hit 0)
    const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);

    // Check credits and load segments on mount
    useEffect(() => {
        checkCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkCredits = async () => {
        setIsLoading(true);
        try {
            const info = await canPerformGuestAnalysis();

            if (info.isPremium) {
                router.replace("/dashboard/coach");
                return;
            }

            if (!info.isGuest && !hasMatchParams) {
                router.replace("/dashboard/coach");
                return;
            }

            if (!info.isGuest && hasMatchParams && matchIdParam && puuidParam) {
                setLoadingSegments(true);
                try {
                    const [segmentResult, matchSummary, version] = await Promise.all([
                        selectAnalysisSegments(matchIdParam, puuidParam, language as 'ja' | 'en' | 'ko', FREE_MAX_SEGMENTS),
                        getMatchSummary(matchIdParam, puuidParam),
                        fetchLatestVersion()
                    ]);
                    if (segmentResult.success && segmentResult.segments) {
                        setAutoSegments(segmentResult.segments);
                    }
                    if (matchSummary) {
                        setMatchInfo(matchSummary);
                    }
                    setDdragonVersion(version);
                } catch (e) {
                    logger.error("Failed to load segments:", e);
                }
                setLoadingSegments(false);
            }

            setCreditInfo(info);
            setIsLoading(false);
        } catch (e) {
            logger.error("Failed to check credits:", e);
            setCreditInfo({
                canAnalyze: true,
                isGuest: true,
                credits: 3,
                maxCredits: 3,
                nextCreditAt: null
            });
            setIsLoading(false);
        }
    };

    // Determine which segments to use
    const activeSegments: (GuestSegment | VideoMacroSegment)[] =
        hasMatchParams && autoSegments.length > 0 ? autoSegments : [...GUEST_FIXED_SEGMENTS];

    // Handle video file selection
    const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            setVideoDuration(0);
            setResult(null);
            setMicroResult(null);
            setError(null);
            setIsCalibrated(false);
            setAdCompleted(false);
        }
    }, []);

    // Extract a single frame
    const extractSingleFrame = async (video: HTMLVideoElement): Promise<string> => {
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(video, 0, 0, 960, 540);
        return canvas.toDataURL("image/jpeg", 0.6);
    };

    // Extract frames for a segment
    const extractFrames = async (
        video: HTMLVideoElement,
        segment: GuestSegment | VideoMacroSegment,
        framesPerSegment: number = FRAMES_PER_SEGMENT,
        offset: number = 0
    ): Promise<{ segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[]> => {
        const frames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];
        const duration = (segment.analysisEndTime - segment.analysisStartTime) / 1000;
        const frameCount = framesPerSegment;
        const interval = duration / frameCount;

        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext("2d");
        if (!ctx) return frames;

        for (let i = 0; i < frameCount; i++) {
            const gameTimeMs = segment.analysisStartTime + (i * interval * 1000);
            const videoTimeSec = (gameTimeMs / 1000) + offset;

            video.currentTime = Math.max(0, videoTimeSec);
            await new Promise<void>((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener("seeked", onSeeked);
                    resolve();
                };
                video.addEventListener("seeked", onSeeked);
            });

            ctx.drawImage(video, 0, 0, 960, 540);
            const base64 = canvas.toDataURL("image/jpeg", 0.6);

            frames.push({
                segmentId: segment.segmentId,
                frameIndex: i,
                gameTime: gameTimeMs,
                base64Data: base64
            });
        }

        return frames;
    };

    // Auto-detect time offset
    const autoDetectTimeOffset = async (videoTimeSec: number, frameBase64: string): Promise<number | null> => {
        try {
            const detectionResult = await detectGameTimeFromFrame(frameBase64);
            if (detectionResult.success && detectionResult.gameTimeSeconds !== undefined) {
                return videoTimeSec - detectionResult.gameTimeSeconds;
            }
            return null;
        } catch (e) {
            logger.error("[Analyze] Time detection error:", e);
            return null;
        }
    };

    // Match verification helper
    const verifyMatch = async (video: HTMLVideoElement) => {
        if (!hasMatchParams || !matchIdParam || !puuidParam || !matchInfo) return;

        setIsVerifying(true);
        try {
            const matchDetail = await fetchMatchDetail(matchIdParam);
            if (!matchDetail.success || !matchDetail.data) {
                throw new Error(t('analyzePage.verifyFetchFailed'));
            }
            const participants = matchDetail.data.info.participants;
            const me = participants.find((p) => p.puuid === puuidParam);
            const myTeamId = me ? me.teamId : 0;
            const verifyContext = {
                myChampion: matchInfo.championName,
                allies: participants.filter((p) => p.teamId === myTeamId).map((p) => p.championName),
                enemies: participants.filter((p) => p.teamId !== myTeamId).map((p) => p.championName)
            };

            const processor = new VideoProcessor();
            const vFrames = await processor.extractVerificationFrames(videoFile!);

            setProgressMsg(t('analyzePage.aiVerifying'));
            const vResult = await verifyMatchVideo(vFrames, verifyContext);

            if (!vResult.success || !vResult.data) {
                throw new Error(t('analyzePage.verifyServerError'));
            }
            if (!vResult.data.isValid) {
                const reasonCode = vResult.data.reason || '';
                const reasonMap: Record<string, string> = {
                    'CHAMPION_MISMATCH': t('analyzePage.championMismatch'),
                    'TEAM_MISMATCH': t('analyzePage.teamMismatch'),
                };
                throw new Error(reasonMap[reasonCode] || t('analyzePage.videoMismatch'));
            }
        } finally {
            setIsVerifying(false);
        }
    };

    // Reward ad completion handler
    const handleAdComplete = () => {
        setAdCompleted(true);
        setShowRewardAd(false);
        if (analysisMode === 'macro') {
            runMacroAnalysis();
        } else {
            runMicroAnalysis();
        }
    };

    // Run analysis (entry point)
    const runAnalysis = async () => {
        if (!videoFile || !videoRef.current) {
            setError(t('analyzePage.selectVideo'));
            return;
        }

        if (!creditInfo?.canAnalyze) {
            setUpgradeModalDismissed(false);
            return;
        }

        if (!adCompleted && creditInfo && !creditInfo.isPremium) {
            setUpgradeModalDismissed(true); // Close upgrade modal to prevent overlap
            setShowRewardAd(true);
            return;
        }

        if (analysisMode === 'macro') {
            await runMacroAnalysis();
        } else {
            await runMicroAnalysis();
        }
    };

    // Run macro analysis
    const runMacroAnalysis = async () => {
        if (!videoFile || !videoRef.current) return;

        setAnalyzing(true);
        setProgress(0);
        setError(null);

        try {
            const video = videoRef.current;

            // Step 1: Time calibration
            setProgressMsg(t('analyzePage.detectingTime'));
            setProgress(5);

            let currentOffset = timeOffset;
            if (!isCalibrated) {
                const testVideoTime = Math.min(120, video.duration * 0.1);
                video.currentTime = testVideoTime;
                await new Promise<void>((resolve) => {
                    const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
                    video.addEventListener("seeked", onSeeked);
                });

                const testFrame = await extractSingleFrame(video);
                const detectedOffset = await autoDetectTimeOffset(testVideoTime, testFrame);

                if (detectedOffset !== null) {
                    currentOffset = detectedOffset;
                    setTimeOffset(detectedOffset);
                    setIsCalibrated(true);
                }
            }

            setProgress(15);

            // Step 1.5: Match verification
            if (hasMatchParams) {
                setProgressMsg(t('analyzePage.verifying'));
                setProgress(18);
                await verifyMatch(video);
            }

            // Step 2: Extract frames for each segment
            const allFrames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];

            for (let i = 0; i < activeSegments.length; i++) {
                const segment = activeSegments[i];
                setProgressMsg(`${t('analyzePage.extractingFrames')} ${i + 1}/${activeSegments.length}`);
                setProgress(15 + (i / activeSegments.length) * 35);

                const videoStartTime = (segment.analysisStartTime / 1000) + currentOffset;
                const videoEndTime = (segment.analysisEndTime / 1000) + currentOffset;

                if (videoStartTime < 0 || videoEndTime > video.duration) {
                    logger.warn(`[Analyze] Segment ${segment.segmentId} out of video range: video=${video.duration}s, required=${videoStartTime}-${videoEndTime}s`);
                }

                const frames = await extractFrames(video, segment, FRAMES_PER_SEGMENT, currentOffset);
                allFrames.push(...frames);
            }

            setProgressMsg(t('analyzePage.startingAnalysis'));
            setProgress(55);

            // Step 3: Call analysis
            const analysisResult = await performGuestAnalysis({
                frames: allFrames,
                language: language as 'ja' | 'en' | 'ko',
                timeOffset: currentOffset,
                matchId: matchIdParam || undefined,
                segments: hasMatchParams ? autoSegments : undefined,
                turnstileToken: turnstileToken || undefined,
            });

            setProgress(100);

            if (analysisResult.success) {
                setResult(analysisResult);
                await checkCredits();
            } else {
                setError(t(`serverErrors.${analysisResult.error}`, analysisResult.error) || t('analyzePage.analysisFailed'));
            }

        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setAnalyzing(false);
        }
    };

    // Run micro analysis
    const runMicroAnalysis = async () => {
        if (!videoFile || !videoRef.current) return;

        setAnalyzing(true);
        setProgress(0);
        setError(null);
        setMicroResult(null);

        try {
            const video = videoRef.current;

            if (video.duration < 30) {
                throw new Error(t('analyzePage.selectVideo'));
            }

            const startSec = Math.min(microStartTime, Math.max(0, video.duration - 30));

            setProgressMsg(t('analyzePage.micro.analyzing'));
            setProgress(10);

            // Match verification
            if (hasMatchParams) {
                setProgressMsg(t('analyzePage.verifying'));
                setProgress(15);
                await verifyMatch(video);
            }

            // Extract frames
            setProgressMsg(t('analyzePage.extractingFrames'));
            setProgress(25);

            const processor = new VideoProcessor();
            const frameData = await processor.extractFrames(videoFile, 1.0, 30, 1280, startSec, (p) => setProgress(25 + (p * 0.3)));
            const frameDataUrls = frameData.map(f => f.dataUrl);

            setProgress(55);
            setProgressMsg(t('analyzePage.startingAnalysis'));

            const isGuestOrFreeMember = creditInfo?.isGuest || !creditInfo?.isPremium;

            if (isGuestOrFreeMember) {
                setProgress(60);
                setProgressMsg(t('analyzePage.micro.polling'));

                const guestResult = await performGuestMicroAnalysis({
                    frames: frameDataUrls,
                    language: language as 'ja' | 'en' | 'ko',
                    matchId: matchIdParam || undefined,
                    puuid: puuidParam || undefined,
                    analysisStartGameTime: startSec,
                    analysisEndGameTime: startSec + 30,
                    turnstileToken: turnstileToken || undefined,
                });

                if (!guestResult.success || !guestResult.result) {
                    throw new Error(t(`serverErrors.${guestResult.error}`, guestResult.error) || t('analyzePage.analysisFailed'));
                }

                setMicroResult(guestResult.result);
                setProgress(100);
                await checkCredits();
            } else {
                const startResult = await startVisionAnalysis({
                    frames: frameDataUrls,
                    matchId: matchIdParam || undefined,
                    puuid: puuidParam || undefined,
                    language: language as 'ja' | 'en' | 'ko',
                    analysisStartGameTime: startSec,
                    analysisEndGameTime: startSec + 30,
                });

                if (!startResult.success || !startResult.jobId) {
                    throw new Error(t(`serverErrors.${startResult.error}`, startResult.error) || t('analyzePage.analysisFailed'));
                }

                setJobId(startResult.jobId);
                setProgress(60);
                setIsPolling(true);
                setProgressMsg(t('analyzePage.micro.polling'));

                const pollInterval = 3000;
                const maxPolls = 60;
                let polls = 0;

                while (polls < maxPolls) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    polls++;

                    const status = await getAnalysisJobStatus(startResult.jobId);
                    setProgress(60 + Math.min(35, (polls / maxPolls) * 35));

                    if (status.status === 'completed' && status.result) {
                        setMicroResult(status.result as VisionAnalysisResult);
                        setProgress(100);
                        await checkCredits();
                        break;
                    } else if (status.status === 'failed') {
                        throw new Error(t(`serverErrors.${status.error}`, status.error) || t('analyzePage.analysisFailed'));
                    } else if (status.status === 'not_found') {
                        throw new Error(t('analyzePage.analysisFailed'));
                    }
                }

                if (polls >= maxPolls) {
                    throw new Error(t('analyzePage.analysisFailed'));
                }
            }

        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setAnalyzing(false);
            setIsPolling(false);
        }
    };

    // Seek to timestamp
    const seekToTimestamp = (gameTimeMs: number) => {
        if (videoRef.current) {
            const videoTimeSec = (gameTimeMs / 1000) + timeOffset;
            videoRef.current.currentTime = Math.max(0, videoTimeSec);
            videoRef.current.pause();
        }
    };

    // Format time
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.floor(Math.abs(seconds) % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Loading screen
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">{t('analyzePage.loading')}</p>
                </div>
            </div>
        );
    }

    const hasResults = !!(result || microResult);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={creditInfo?.isGuest ? "/" : hasMatchParams ? "/dashboard/coach" : "/dashboard"}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                            <FaArrowLeft />
                            <span className="hidden sm:inline">
                                {creditInfo?.isGuest ? t('analyzePage.header.top') : hasMatchParams ? t('analyzePage.header.matchSelect') : t('analyzePage.header.dashboard')}
                            </span>
                        </Link>
                        <Link href="/" className="text-2xl font-black italic tracking-tighter text-white">
                            LoL<span className="text-blue-500">Coach</span>AI
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        {creditInfo && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                creditInfo.isGuest
                                    ? 'bg-slate-700 text-slate-300'
                                    : hasMatchParams
                                        ? 'bg-emerald-600/20 text-emerald-300'
                                        : 'bg-blue-600/20 text-blue-300'
                            }`}>
                                {creditInfo.isGuest ? <FaUser /> : hasMatchParams ? <FaGamepad /> : <FaCrown />}
                                <span>
                                    {creditInfo.credits}/{creditInfo.maxCredits}
                                    {creditInfo.isGuest ? ` ${t('analyzePage.header.guest')}` : hasMatchParams ? ` ${t('analyzePage.header.freeMember')}` : ` ${t('analyzePage.header.perWeek')}`}
                                </span>
                            </div>
                        )}
                        <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition">
                            {t('analyzePage.header.pricing')}
                        </Link>
                        {creditInfo?.isGuest && (
                            <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300 transition">
                                {t('analyzePage.header.login')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="py-8">
                {/* Top Section */}
                <div className="max-w-6xl mx-auto px-4">
                    <div className="mb-6 hidden sm:flex justify-center">
                        <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" isPremium={creditInfo?.isPremium} />
                    </div>

                    {/* Page Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white mb-2">
                            {t('analyzePage.hero.free')}<span className="text-emerald-400">{t('analyzePage.upload.title')}</span>
                        </h1>
                        <p className="text-slate-400">{t('analyzePage.hero.desc')}</p>
                    </div>

                    {/* Soft promo banner at 80% usage */}
                    {creditInfo && !creditInfo.isGuest && !creditInfo.isPremium && creditInfo.maxCredits > 0 && (
                      (() => {
                        const used = creditInfo.maxCredits - creditInfo.credits;
                        const usagePercent = (used / creditInfo.maxCredits) * 100;
                        if (usagePercent < 80) return null;
                        return (
                          <div className="max-w-md mx-auto mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                            <p className="text-xs text-amber-200">
                              {t('analyzePage.usagePromo', 'Only {n} analyses left this week — Premium gives you 20/week').replace('{n}', String(creditInfo.credits))}
                            </p>
                            <Link href="/pricing" className="ml-3 text-xs font-bold text-amber-400 hover:text-amber-300 whitespace-nowrap transition">
                              {t('analyzePage.usagePromoCta', 'Upgrade')}
                            </Link>
                          </div>
                        );
                      })()
                    )}

                    {/* Match Info Card */}
                    {hasMatchParams && matchInfo && (
                        <div className="max-w-md mx-auto mb-8 bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                            <img
                                src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${matchInfo.championName}.png`}
                                alt={matchInfo.championName}
                                className="w-14 h-14 rounded-lg"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white font-bold text-lg">{matchInfo.championName}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        matchInfo.win ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {matchInfo.win ? t('analyzePage.matchInfo.victory') : t('analyzePage.matchInfo.defeat')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <span className="font-mono">{matchInfo.kda}</span>
                                    <span>{new Date(matchInfo.timestamp).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Analysis Mode Tabs */}
                    <div className="flex justify-center gap-2 mb-8">
                        <button
                            onClick={() => { setAnalysisMode('macro'); setAdCompleted(false); }}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 ${
                                analysisMode === 'macro'
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            <FaMapMarkerAlt />
                            {t('analyzePage.tabs.macro')}
                        </button>
                        <button
                            onClick={() => { setAnalysisMode('micro'); setAdCompleted(false); }}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 ${
                                analysisMode === 'micro'
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            <FaSearch />
                            {t('analyzePage.tabs.micro')}
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex justify-center px-4">
                    <div className="w-full max-w-4xl">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Left Column - Video Upload */}
                            <VideoUploader
                                videoUrl={videoUrl}
                                videoRef={videoRef}
                                videoDuration={videoDuration}
                                onVideoSelect={handleVideoSelect}
                                onVideoReset={() => {
                                    setVideoFile(null);
                                    setVideoUrl(null);
                                    setVideoDuration(0);
                                    setResult(null);
                                }}
                                onVideoLoaded={() => {
                                    if (videoRef.current) {
                                        setVideoDuration(videoRef.current.duration);
                                    }
                                }}
                                analysisMode={analysisMode}
                                hasMatchParams={hasMatchParams}
                                autoSegments={autoSegments}
                                activeSegments={activeSegments}
                                loadingSegments={loadingSegments}
                                microStartTime={microStartTime}
                                onMicroStartTimeChange={setMicroStartTime}
                                formatTime={formatTime}
                            />

                            {/* Right Column - Analysis */}
                            <div className="space-y-4">
                                {!hasResults && (
                                    <AnalysisControlPanel
                                        analysisMode={analysisMode}
                                        creditInfo={creditInfo}
                                        videoFile={videoFile}
                                        analyzing={analyzing}
                                        isLoading={isLoading}
                                        progress={progress}
                                        progressMsg={progressMsg}
                                        error={error}
                                        onErrorDismiss={() => setError(null)}
                                        onRunAnalysis={runAnalysis}
                                        onTurnstileVerify={(token) => setTurnstileToken(token)}
                                        onTurnstileExpire={() => setTurnstileToken(null)}
                                    />
                                )}

                                {/* Macro Results */}
                                {result && result.success && (
                                    <MacroResultSection
                                        result={result}
                                        isGuest={!!creditInfo?.isGuest}
                                        showUpgradeCTA={!creditInfo?.isGuest && !creditInfo?.isPremium}
                                        expandedSegment={expandedSegment}
                                        setExpandedSegment={setExpandedSegment}
                                        seekToTimestamp={seekToTimestamp}
                                        onReanalyze={() => { setResult(null); setAdCompleted(false); }}
                                    />
                                )}

                                {/* Micro Results */}
                                {microResult && (
                                    <MicroResultSection
                                        microResult={microResult}
                                        isGuest={!!creditInfo?.isGuest}
                                        showUpgradeCTA={!creditInfo?.isGuest && !creditInfo?.isPremium}
                                        onReanalyze={() => { setMicroResult(null); setAdCompleted(false); }}
                                    />
                                )}

                                {/* Plan Link */}
                                <div className="text-center py-4">
                                    <Link href="/pricing" className="text-sm text-slate-400 hover:text-slate-300 transition">
                                        {t('analyzePage.results.viewPlans')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Mobile Ad */}
                <div className="xl:hidden mt-6 flex justify-center px-4">
                    <AdSenseBanner className="w-full max-w-[336px] h-[280px] bg-slate-800/30 rounded" isPremium={creditInfo?.isPremium} />
                </div>

                {/* Bottom Ad */}
                <div className="mt-8 flex justify-center px-4">
                    <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" isPremium={creditInfo?.isPremium} />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 mt-12 py-8">
                <div className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
                    <p>{t('footer.copyright').replace('{year}', new Date().getFullYear().toString())}</p>
                    <div className="mt-2 flex justify-center gap-4">
                        <Link href="/terms" className="hover:text-slate-300">{t('footer.terms')}</Link>
                        <Link href="/privacy" className="hover:text-slate-300">{t('footer.privacy')}</Link>
                    </div>
                </div>
            </footer>

            {/* Upgrade Modal */}
            {!upgradeModalDismissed && creditInfo && !creditInfo.canAnalyze && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="text-4xl mb-4">
                            <FaCrown className="inline text-amber-400" />
                        </div>
                        <h3 id="upgrade-modal-title" className="text-xl font-bold text-white mb-2">
                            {t('analyzePage.upgradeModal.title', creditInfo.isGuest ? 'Guest analysis credits used up' : 'Weekly analysis limit reached')}
                        </h3>
                        <p className="text-sm text-slate-400 mb-6">
                            {t('analyzePage.upgradeModal.desc', 'Premium allows up to 20 analyses per week. Try free for 7 days.')}
                        </p>
                        <div className="space-y-3">
                            <Link
                                href={creditInfo.isGuest ? "/signup" : "/pricing"}
                                className="block w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                            >
                                {creditInfo.isGuest
                                    ? t('analyzePage.upgradeModal.signupCta', 'Sign up for free')
                                    : t('analyzePage.upgradeModal.upgradeCta', 'Upgrade to Premium')}
                            </Link>
                            <button
                                onClick={() => setUpgradeModalDismissed(true)}
                                className="block w-full py-2.5 text-sm text-slate-400 hover:text-slate-300 transition"
                            >
                                {t('analyzePage.upgradeModal.dismiss', 'Close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reward Ad Modal */}
            <RewardedAdModal
                isOpen={showRewardAd}
                onClose={() => setShowRewardAd(false)}
                onAdComplete={handleAdComplete}
                analysisType={analysisMode}
            />
        </div>
    );
}
