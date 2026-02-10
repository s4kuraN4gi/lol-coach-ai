"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaPlay, FaUpload, FaClock, FaChevronDown, FaChevronUp, FaLightbulb, FaMapMarkerAlt, FaLock, FaCrown, FaUser, FaGamepad, FaArrowLeft, FaSearch } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";
import RewardedAdModal from "@/app/Components/ads/RewardedAdModal";
import { GUEST_FIXED_SEGMENTS, type GuestSegment } from "@/app/actions/guestConstants";
import {
    canPerformGuestAnalysis,
    performGuestAnalysis,
    type GuestAnalysisResult,
    type GuestSegmentAnalysis
} from "@/app/actions/guestAnalysis";
import { detectGameTimeFromFrame, selectAnalysisSegments, type VideoMacroSegment } from "@/app/actions/videoMacroAnalysis";
import { getMatchSummary, type MatchSummary } from "@/app/actions/coach";
import { fetchLatestVersion, fetchMatchDetail } from "@/app/actions/riot";
import { startVisionAnalysis, verifyMatchVideo, type VisionAnalysisResult } from "@/app/actions/vision";
import { getAnalysisJobStatus } from "@/app/actions/analysis";
import { VideoProcessor } from "@/lib/videoProcessor";

// Free member segment limit (same as FREE_SEGMENT_LIMIT in VideoMacroAnalysis)
const FREE_SEGMENT_LIMIT = 3;

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

    // Micro analysis state
    const [videoDuration, setVideoDuration] = useState(0);
    const [microStartTime, setMicroStartTime] = useState(0);
    const [microResult, setMicroResult] = useState<VisionAnalysisResult | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Reward ad state
    const [showRewardAd, setShowRewardAd] = useState(false);
    const [adCompleted, setAdCompleted] = useState(false);

    // Micro result sections expand/collapse
    const [expandedMicroSections, setExpandedMicroSections] = useState<Record<string, boolean>>({
        situation: true,
        trade: true,
        mechanics: true,
        improvements: true,
    });

    // Check credits and load segments on mount
    useEffect(() => {
        checkCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkCredits = async () => {
        setIsLoading(true);
        try {
            const info = await canPerformGuestAnalysis();

            // Premium users should always be redirected to /dashboard/coach
            if (info.isPremium) {
                router.replace("/dashboard/coach");
                return;
            }

            // Free members WITHOUT match params should go to /dashboard/coach to select a match
            // Free members WITH match params stay here for analysis (with ads)
            if (!info.isGuest && !hasMatchParams) {
                router.replace("/dashboard/coach");
                return;
            }

            // If free member with match params, load auto-selected segments and match info
            if (!info.isGuest && hasMatchParams && matchIdParam && puuidParam) {
                setLoadingSegments(true);
                try {
                    const [segmentResult, matchSummary, version] = await Promise.all([
                        selectAnalysisSegments(
                            matchIdParam,
                            puuidParam,
                            language as 'ja' | 'en' | 'ko',
                            FREE_SEGMENT_LIMIT
                        ),
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
                    console.error("Failed to load segments:", e);
                }
                setLoadingSegments(false);
            }

            setCreditInfo(info);
            setIsLoading(false);
        } catch (e) {
            console.error("Failed to check credits:", e);
            // Default to guest with 3 credits on error
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

    // Determine which segments to use: auto-selected for free members, fixed for guests
    const activeSegments: (GuestSegment | VideoMacroSegment)[] =
        hasMatchParams && autoSegments.length > 0
            ? autoSegments
            : [...GUEST_FIXED_SEGMENTS];

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
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(video, 0, 0, 1280, 720);
        return canvas.toDataURL("image/jpeg", 0.7);
    };

    // Extract frames for a segment (supports both GuestSegment and VideoMacroSegment)
    const extractFrames = async (
        video: HTMLVideoElement,
        segment: GuestSegment | VideoMacroSegment,
        fps: number = 0.2,
        offset: number = 0
    ): Promise<{ segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[]> => {
        const frames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];
        const duration = (segment.analysisEndTime - segment.analysisStartTime) / 1000;
        const frameCount = Math.ceil(duration * fps);
        const interval = duration / frameCount;

        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
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

            ctx.drawImage(video, 0, 0, 1280, 720);
            const base64 = canvas.toDataURL("image/jpeg", 0.7);

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
            const result = await detectGameTimeFromFrame(frameBase64);
            if (result.success && result.gameTimeSeconds !== undefined) {
                const offset = videoTimeSec - result.gameTimeSeconds;
                console.log(`[Analyze] Auto-detected offset: ${offset}s`);
                return offset;
            }
            return null;
        } catch (e) {
            console.error("[Analyze] Time detection error:", e);
            return null;
        }
    };

    // Reward ad completion handler
    const handleAdComplete = () => {
        setAdCompleted(true);
        setShowRewardAd(false);
        // Re-trigger analysis after ad is complete
        if (analysisMode === 'macro') {
            runMacroAnalysis();
        } else {
            runMicroAnalysis();
        }
    };

    // Run analysis (entry point - checks reward ad, then branches)
    const runAnalysis = async () => {
        if (!videoFile || !videoRef.current) {
            setError(t('analyzePage.selectVideo'));
            return;
        }

        if (!creditInfo?.canAnalyze) {
            setError(creditInfo?.upgradeMessage || t('analyzePage.noCredits'));
            return;
        }

        // Reward ad check for non-premium users
        if (!adCompleted && creditInfo && !creditInfo.isPremium) {
            setShowRewardAd(true);
            return;
        }

        if (analysisMode === 'macro') {
            await runMacroAnalysis();
        } else {
            await runMicroAnalysis();
        }
    };

    // Run macro analysis (existing logic)
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
                    const onSeeked = () => {
                        video.removeEventListener("seeked", onSeeked);
                        resolve();
                    };
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

            // Step 1.5: Match verification (free members with match params only)
            if (hasMatchParams && matchIdParam && puuidParam && matchInfo) {
                setIsVerifying(true);
                setProgressMsg(t('analyzePage.verifying'));
                setProgress(18);

                try {
                    // 1. Get match detail for participant data
                    const matchDetail = await fetchMatchDetail(matchIdParam);
                    if (!matchDetail.success || !matchDetail.data) {
                        throw new Error(t('analyzePage.verifyFetchFailed'));
                    }

                    // 2. Build verification context
                    const participants = matchDetail.data.info.participants;
                    const me = participants.find((p: any) => p.puuid === puuidParam);
                    const myTeamId = me ? me.teamId : 0;
                    const verifyContext = {
                        myChampion: matchInfo.championName,
                        allies: participants.filter((p: any) => p.teamId === myTeamId).map((p: any) => p.championName),
                        enemies: participants.filter((p: any) => p.teamId !== myTeamId).map((p: any) => p.championName)
                    };

                    // 3. Extract verification frames from video
                    const processor = new VideoProcessor();
                    const vFrames = await processor.extractVerificationFrames(videoFile);

                    // 4. AI verification
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
            }

            // Step 2: Extract frames for each segment (uses activeSegments - auto for free, fixed for guest)
            const allFrames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];

            console.log(`[Analyze] Video duration: ${video.duration}s, Offset: ${currentOffset}s`);
            console.log(`[Analyze] Segments to process:`, activeSegments.map(s => ({
                id: s.segmentId,
                start: s.analysisStartTime / 1000,
                end: s.analysisEndTime / 1000,
                videoStart: (s.analysisStartTime / 1000) + currentOffset,
                videoEnd: (s.analysisEndTime / 1000) + currentOffset
            })));

            for (let i = 0; i < activeSegments.length; i++) {
                const segment = activeSegments[i];
                setProgressMsg(`${t('analyzePage.extractingFrames')} ${i + 1}/${activeSegments.length}`);
                setProgress(15 + (i / activeSegments.length) * 35);

                const videoStartTime = (segment.analysisStartTime / 1000) + currentOffset;
                const videoEndTime = (segment.analysisEndTime / 1000) + currentOffset;

                // Check if video is long enough
                if (videoStartTime < 0 || videoEndTime > video.duration) {
                    console.warn(`[Analyze] Segment ${segment.segmentId} out of video range: video=${video.duration}s, required=${videoStartTime}-${videoEndTime}s`);
                }

                const frames = await extractFrames(video, segment, 0.2, currentOffset);
                console.log(`[Analyze] Segment ${segment.segmentId}: extracted ${frames.length} frames`);
                allFrames.push(...frames);
            }

            console.log(`[Analyze] Total frames extracted: ${allFrames.length}`);

            setProgressMsg(t('analyzePage.startingAnalysis'));
            setProgress(55);

            // Step 3: Call analysis (pass matchId for free members to enable segment context)
            const analysisResult = await performGuestAnalysis({
                frames: allFrames,
                language: language as 'ja' | 'en' | 'ko',
                timeOffset: currentOffset,
                matchId: matchIdParam || undefined,
                segments: hasMatchParams ? autoSegments : undefined
            });

            setProgress(100);

            if (analysisResult.success) {
                setResult(analysisResult);
                // Refresh credit info
                await checkCredits();
            } else {
                setError(analysisResult.error || t('analyzePage.analysisFailed'));
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setAnalyzing(false);
        }
    };

    // Run micro analysis (new)
    const runMicroAnalysis = async () => {
        if (!videoFile || !videoRef.current) return;

        setAnalyzing(true);
        setProgress(0);
        setError(null);
        setMicroResult(null);

        try {
            const video = videoRef.current;

            // Step 1: Validate video
            if (video.duration < 30) {
                throw new Error(t('analyzePage.selectVideo'));
            }

            // Clamp microStartTime to valid range
            const startSec = Math.min(microStartTime, Math.max(0, video.duration - 30));

            setProgressMsg(t('analyzePage.micro.analyzing'));
            setProgress(10);

            // Step 2: Match verification (free members with match params only)
            if (hasMatchParams && matchIdParam && puuidParam && matchInfo) {
                setIsVerifying(true);
                setProgressMsg(t('analyzePage.verifying'));
                setProgress(15);

                try {
                    const matchDetail = await fetchMatchDetail(matchIdParam);
                    if (!matchDetail.success || !matchDetail.data) {
                        throw new Error(t('analyzePage.verifyFetchFailed'));
                    }
                    const participants = matchDetail.data.info.participants;
                    const me = participants.find((p: any) => p.puuid === puuidParam);
                    const myTeamId = me ? me.teamId : 0;
                    const verifyContext = {
                        myChampion: matchInfo.championName,
                        allies: participants.filter((p: any) => p.teamId === myTeamId).map((p: any) => p.championName),
                        enemies: participants.filter((p: any) => p.teamId !== myTeamId).map((p: any) => p.championName)
                    };

                    const processor = new VideoProcessor();
                    const vFrames = await processor.extractVerificationFrames(videoFile);

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
            }

            // Step 3: Extract frames (1fps, 30 frames, 1280px)
            setProgressMsg(t('analyzePage.extractingFrames'));
            setProgress(25);

            const processor = new VideoProcessor();
            const frameData = await processor.extractFrames(
                videoFile,
                1.0,    // 1fps
                30,     // max 30 frames
                1280,   // 1280px
                startSec,
                (p) => setProgress(25 + (p * 0.3))
            );

            const frameDataUrls = frameData.map(f => f.dataUrl);
            console.log(`[Analyze:Micro] Extracted ${frameDataUrls.length} frames from ${startSec}s`);

            setProgress(55);

            // Step 4: Start vision analysis job
            setProgressMsg(t('analyzePage.startingAnalysis'));
            const startResult = await startVisionAnalysis({
                frames: frameDataUrls,
                matchId: matchIdParam || undefined,
                puuid: puuidParam || undefined,
                language: language as 'ja' | 'en' | 'ko',
                analysisStartGameTime: startSec,
                analysisEndGameTime: startSec + 30,
            });

            if (!startResult.success || !startResult.jobId) {
                throw new Error(startResult.error || t('analyzePage.analysisFailed'));
            }

            setJobId(startResult.jobId);
            setProgress(60);

            // Step 5: Poll for job completion
            setIsPolling(true);
            setProgressMsg(t('analyzePage.micro.polling'));

            const pollInterval = 3000;
            const maxPolls = 60; // 3 minutes max
            let polls = 0;

            while (polls < maxPolls) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                polls++;

                const status = await getAnalysisJobStatus(startResult.jobId);
                setProgress(60 + Math.min(35, (polls / maxPolls) * 35));

                if (status.status === 'completed' && status.result) {
                    setMicroResult(status.result as VisionAnalysisResult);
                    setProgress(100);
                    // Refresh credit info
                    await checkCredits();
                    break;
                } else if (status.status === 'failed') {
                    throw new Error(status.error || t('analyzePage.analysisFailed'));
                } else if (status.status === 'not_found') {
                    throw new Error(t('analyzePage.analysisFailed'));
                }
                // else: still processing, continue polling
            }

            if (polls >= maxPolls) {
                throw new Error(t('analyzePage.analysisFailed'));
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setAnalyzing(false);
            setIsPolling(false);
        }
    };

    // Toggle micro result sections
    const toggleMicroSection = (section: string) => {
        setExpandedMicroSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Grade color mapping for micro results
    const gradeColors: Record<string, string> = {
        'S': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
        'A': 'text-green-400 bg-green-500/20 border-green-500/50',
        'B': 'text-blue-400 bg-blue-500/20 border-blue-500/50',
        'C': 'text-orange-400 bg-orange-500/20 border-orange-500/50',
        'D': 'text-red-400 bg-red-500/20 border-red-500/50',
    };

    const priorityColors: Record<string, string> = {
        'HIGH': 'bg-red-500/20 text-red-400 border-red-500/50',
        'MEDIUM': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        'LOW': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    };

    const outcomeColors: Record<string, string> = {
        'WIN': 'text-green-400',
        'LOSE': 'text-red-400',
        'EVEN': 'text-yellow-400',
        'NO_TRADE': 'text-slate-400',
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

    // Show loading screen while checking user type (prevents flash for premium users)
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Back button - different destination based on user type */}
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
                        {isLoading ? (
                            <div className="w-24 h-8 bg-slate-700 rounded-full animate-pulse" />
                        ) : creditInfo && (
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
                        <Link
                            href="/pricing"
                            className="text-sm text-slate-400 hover:text-white transition"
                        >
                            {t('analyzePage.header.pricing')}
                        </Link>
                        {creditInfo?.isGuest && (
                            <Link
                                href="/login"
                                className="text-sm text-blue-400 hover:text-blue-300 transition"
                            >
                                {t('analyzePage.header.login')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="py-8">
                {/* Top Section - Centered */}
                <div className="max-w-6xl mx-auto px-4">
                    {/* Ad Banner 1 - Top */}
                    <div className="mb-6 flex justify-center">
                        <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" />
                    </div>

                    {/* Page Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white mb-2">
                            {t('analyzePage.hero.free')}<span className="text-emerald-400">{t('analyzePage.upload.title')}</span>
                        </h1>
                        <p className="text-slate-400">
                            {t('analyzePage.hero.desc')}
                        </p>
                    </div>

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
                                        matchInfo.win
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-red-500/20 text-red-400'
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

                {/* 3-Column Layout: Left Ad | Main Content | Right Ad */}
                <div className="flex justify-center px-4">
                    {/* Left Ad Sidebar - Fixed to outer left on xl screens */}
                    <div className="hidden xl:block flex-shrink-0 w-[160px] mr-6">
                        <div className="sticky top-24">
                            <AdSenseBanner className="w-[160px] h-[600px] bg-slate-800/30 rounded" />
                        </div>
                    </div>

                    {/* Main Content - 2 Column Grid */}
                    <div className="w-full max-w-4xl">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Left Column - Video Upload */}
                            <div className="space-y-4">
                                {/* Video Upload Card */}
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <FaUpload className="text-emerald-400" />
                                        {t('analyzePage.upload.title')}
                                    </h2>

                                    {!videoUrl ? (
                                        <label className="block cursor-pointer">
                                            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition">
                                                <FaUpload className="text-4xl text-slate-600 mx-auto mb-4" />
                                                <p className="text-slate-400 mb-2">
                                                    {t('analyzePage.upload.dragDrop')}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {t('analyzePage.upload.formats')}
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={handleVideoSelect}
                                                className="hidden"
                                            />
                                        </label>
                                    ) : (
                                        <div className="space-y-4">
                                            <video
                                                ref={videoRef}
                                                src={videoUrl}
                                                controls
                                                onLoadedMetadata={() => {
                                                    if (videoRef.current) {
                                                        setVideoDuration(videoRef.current.duration);
                                                    }
                                                }}
                                                className="w-full rounded-lg bg-black"
                                            />
                                            <button
                                                onClick={() => {
                                                    setVideoFile(null);
                                                    setVideoUrl(null);
                                                    setVideoDuration(0);
                                                    setResult(null);
                                                }}
                                                className="text-sm text-slate-400 hover:text-white transition"
                                            >
                                                {t('analyzePage.upload.changeVideo')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Mode-specific left column content */}
                                {analysisMode === 'macro' ? (
                                    /* Segments Info - Auto-selected for free members, fixed for guests */
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                                            <FaClock className={hasMatchParams && autoSegments.length > 0 ? "text-emerald-400" : "text-blue-400"} />
                                            {hasMatchParams && autoSegments.length > 0
                                                ? t('analyzePage.segments.titleAuto')
                                                : t('analyzePage.segments.titleFixed')}
                                        </h3>
                                        {loadingSegments ? (
                                            <div className="flex items-center gap-2 text-slate-400 py-4">
                                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                                {t('analyzePage.segments.loading')}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {activeSegments.map((seg, idx) => (
                                                    <div key={seg.segmentId} className="flex items-center gap-3 text-sm">
                                                        <span className={`font-mono w-12 ${hasMatchParams && autoSegments.length > 0 ? "text-emerald-400" : "text-emerald-400"}`}>
                                                            {seg.targetTimestampStr}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            {seg.eventDescription}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p className="mt-3 text-xs text-slate-500">
                                            {hasMatchParams && autoSegments.length > 0
                                                ? t('analyzePage.segments.autoNote')
                                                : t('analyzePage.segments.registerNote')}
                                        </p>
                                    </div>
                                ) : (
                                    /* Micro Analysis - Clip Selector */
                                    <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-6">
                                        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                                            <FaSearch className="text-purple-400" />
                                            {t('analyzePage.micro.clipSelector')}
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-2">
                                                    {t('analyzePage.micro.clipFrom')}
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={Math.max(0, videoDuration - 30)}
                                                        step={1}
                                                        value={microStartTime}
                                                        onChange={(e) => setMicroStartTime(Number(e.target.value))}
                                                        className="flex-1 accent-purple-500"
                                                    />
                                                    <span className="text-white font-mono text-sm min-w-[50px] text-right">
                                                        {formatTime(microStartTime)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                    <span>0:00</span>
                                                    <span className="text-purple-400 font-medium">
                                                        {formatTime(microStartTime)} - {formatTime(microStartTime + 30)}
                                                    </span>
                                                    <span>{formatTime(videoDuration)}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {t('analyzePage.micro.clipDescription')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                    {/* Right Column - Analysis */}
                    <div className="space-y-4">
                        {/* Error Display */}
                        {error && (
                            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                <p className="text-red-300 text-sm">{error}</p>
                                <button
                                    onClick={() => setError(null)}
                                    className="text-xs text-red-400 mt-2 hover:text-red-300"
                                >
                                    {t('analyzePage.segments.close')}
                                </button>
                            </div>
                        )}

                        {/* Analysis Card */}
                        {!result && !microResult && (
                            <div className={`bg-slate-900 border rounded-xl p-6 ${
                                analysisMode === 'macro' ? 'border-emerald-500/30' : 'border-purple-500/30'
                            }`}>
                                <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                                    analysisMode === 'macro' ? 'text-emerald-400' : 'text-purple-400'
                                }`}>
                                    {analysisMode === 'macro' ? <FaMapMarkerAlt /> : <FaSearch />}
                                    {analysisMode === 'macro'
                                        ? t('analyzePage.analysis.macroTitle')
                                        : t('analyzePage.tabs.micro')}
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        analysisMode === 'macro'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-purple-500/20 text-purple-300'
                                    }`}>
                                        AI
                                    </span>
                                </h2>

                                {/* Progress */}
                                {analyzing && (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                                            <span>{progressMsg}</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                    analysisMode === 'macro' ? 'bg-emerald-500' : 'bg-purple-500'
                                                }`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Credit Warning - Contextual upgrade prompt */}
                                {creditInfo && !creditInfo.canAnalyze && (
                                    <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <p className="text-slate-300 text-sm mb-3">
                                            {creditInfo.isGuest
                                                ? t('analyzePage.analysis.guestNoCredits')
                                                : t('analyzePage.analysis.weeklyLimit')}
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            {creditInfo.isGuest ? (
                                                <>
                                                    <Link
                                                        href="/signup"
                                                        className="flex-1 py-2 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
                                                    >
                                                        {t('analyzePage.analysis.freeRegister')}
                                                    </Link>
                                                    <Link
                                                        href="/pricing"
                                                        className="flex-1 py-2 text-center text-slate-400 hover:text-white text-sm border border-slate-600 rounded-lg transition"
                                                    >
                                                        {t('analyzePage.analysis.comparePlans')}
                                                    </Link>
                                                </>
                                            ) : (
                                                <Link
                                                    href="/pricing"
                                                    className="py-2 px-4 text-center text-slate-400 hover:text-white text-sm transition"
                                                >
                                                    {t('analyzePage.analysis.viewPlans')}
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Analysis Button */}
                                <button
                                    onClick={runAnalysis}
                                    disabled={!videoFile || analyzing || isLoading || !creditInfo?.canAnalyze}
                                    className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                                        !videoFile || analyzing || isLoading || !creditInfo?.canAnalyze
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : analysisMode === 'macro'
                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                                    }`}
                                >
                                    {analysisMode === 'macro' ? <FaMapMarkerAlt /> : <FaSearch />}
                                    {isLoading ? t('analyzePage.buttons.loading') :
                                     analyzing ? t('analyzePage.buttons.analyzing') :
                                     !videoFile ? t('analyzePage.buttons.selectVideo') :
                                     !creditInfo?.canAnalyze ? t('analyzePage.buttons.noCredits') :
                                     t('analyzePage.buttons.startAnalysis').replace('{credits}', String(creditInfo.credits))}
                                </button>
                            </div>
                        )}

                        {/* Results */}
                        {result && result.success && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
                                {/* Warnings (if any) */}
                                {result.warnings && result.warnings.length > 0 && (
                                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                                        <h4 className="text-yellow-400 font-bold text-sm mb-2">{t('analyzePage.results.warning')}</h4>
                                        <ul className="text-xs text-yellow-300/80 space-y-1">
                                            {result.warnings.map((w, i) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-slate-400 mt-2">
                                            {t('analyzePage.results.completed').replace('{completed}', String(result.completedSegments)).replace('{requested}', String(result.requestedSegments))}
                                        </p>
                                    </div>
                                )}

                                {/* Overall Summary */}
                                <div className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border border-emerald-500/50 rounded-xl p-5">
                                    <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                                        <FaLightbulb />
                                        {t('analyzePage.results.summary')}
                                    </h3>
                                    <div className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                                        <p className="text-white">{result.overallSummary.mainIssue}</p>
                                    </div>
                                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                        <div className="text-xs text-blue-400 font-bold mb-1">
                                            {t('analyzePage.results.homework')}
                                        </div>
                                        <h4 className="text-white font-bold mb-1">
                                            {result.overallSummary.homework.title}
                                        </h4>
                                        <p className="text-sm text-slate-300 mb-2">
                                            {result.overallSummary.homework.description}
                                        </p>
                                        <p className="text-xs text-cyan-400">
                                            ✅ {result.overallSummary.homework.howToCheck}
                                        </p>
                                    </div>
                                </div>

                                {/* Segment Results */}
                                <div className="space-y-2">
                                    <h4 className="font-bold text-slate-300 text-sm">
                                        {t('analyzePage.results.sceneAnalysis')}
                                    </h4>
                                    {result.segments.map((seg) => (
                                        <div
                                            key={seg.segmentId}
                                            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                                        >
                                            <button
                                                onClick={() => setExpandedSegment(
                                                    expandedSegment === seg.segmentId ? null : seg.segmentId
                                                )}
                                                className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-emerald-400 font-mono">
                                                        {seg.timestamp}
                                                    </span>
                                                    <span className="text-sm text-white">
                                                        {seg.winningPattern.title}
                                                    </span>
                                                </div>
                                                {expandedSegment === seg.segmentId
                                                    ? <FaChevronUp className="text-slate-400" />
                                                    : <FaChevronDown className="text-slate-400" />}
                                            </button>

                                            {expandedSegment === seg.segmentId && (
                                                <div className="p-4 border-t border-slate-700 space-y-3 animate-in slide-in-from-top-2">
                                                    {/* Observation */}
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-2 bg-slate-900/50 rounded">
                                                            <span className="text-slate-500">{t('analyzePage.results.position')}</span>
                                                            <p className="text-slate-300">{seg.observation.userPosition}</p>
                                                        </div>
                                                        <div className="p-2 bg-slate-900/50 rounded">
                                                            <span className="text-slate-500">{t('analyzePage.results.wave')}</span>
                                                            <p className="text-slate-300">{seg.observation.waveState}</p>
                                                        </div>
                                                    </div>

                                                    {/* Winning Pattern */}
                                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                                        <div className="text-xs font-bold text-emerald-400 mb-2">
                                                            {t('analyzePage.results.winPattern')} {seg.winningPattern.macroConceptUsed}
                                                        </div>
                                                        <ol className="space-y-1">
                                                            {seg.winningPattern.steps.map((step, i) => (
                                                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                                    <span className="text-emerald-400 font-bold">{i + 1}.</span>
                                                                    {step}
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </div>

                                                    {/* Improvement */}
                                                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                                        <div className="text-xs font-bold text-orange-400 mb-1">
                                                            {t('analyzePage.results.improvement')}
                                                        </div>
                                                        <p className="text-sm text-slate-300 mb-2">
                                                            {seg.improvement.description}
                                                        </p>
                                                        <p className="text-xs text-yellow-400">
                                                            💡 {seg.improvement.actionableAdvice}
                                                        </p>
                                                    </div>

                                                    {/* Seek Button */}
                                                    <button
                                                        onClick={() => {
                                                            const [min, sec] = seg.timestamp.split(':').map(Number);
                                                            seekToTimestamp((min * 60 + sec - 30) * 1000);
                                                        }}
                                                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                                    >
                                                        <FaPlay /> {t('analyzePage.results.checkVideo')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Re-analyze Button */}
                                <button
                                    onClick={() => { setResult(null); setAdCompleted(false); }}
                                    className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
                                >
                                    {t('analyzePage.results.reanalyze')}
                                </button>

                                {/* Remaining Credits */}
                                <div className="text-center text-sm text-slate-500">
                                    {t('analyzePage.results.remainingCredits').replace('{remaining}', String(result.remainingCredits))}
                                </div>
                            </div>
                        )}

                        {/* Micro Analysis Results */}
                        {microResult && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
                                {/* Header with Grade */}
                                {microResult.enhanced ? (
                                    <>
                                        <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-purple-500/50">
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{t('analyzePage.micro.clipSelector')}</h4>
                                                <p className="text-sm text-slate-400">
                                                    {microResult.enhanced.championContext.championName} ({microResult.enhanced.championContext.role})
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${gradeColors[microResult.enhanced.overallGrade]}`}>
                                                    {microResult.enhanced.overallGrade}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                            <p className="text-sm text-slate-300 leading-relaxed">{microResult.summary}</p>
                                        </div>

                                        {/* Situation Snapshot */}
                                        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                                            <button
                                                onClick={() => toggleMicroSection('situation')}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                                            >
                                                <h5 className="font-bold text-white flex items-center gap-2">
                                                    <span className="text-purple-400">📊</span>
                                                    {t('analyzePage.micro.situationSnapshot')}
                                                    <span className="text-xs text-slate-500">@ {microResult.enhanced.situationSnapshot.gameTime}</span>
                                                </h5>
                                                {expandedMicroSections.situation ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                            </button>
                                            {expandedMicroSections.situation && (
                                                <div className="p-4 border-t border-slate-800">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30">
                                                            <h6 className="text-xs font-bold text-blue-400 mb-2">{t('coachPage.micro.myStatus', 'Me')}</h6>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">HP</span>
                                                                    <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {microResult.enhanced!.situationSnapshot.myStatus.hpPercent}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Mana</span>
                                                                    <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                                        {microResult.enhanced!.situationSnapshot.myStatus.manaPercent}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Lv</span>
                                                                    <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.myStatus.level}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                                            <h6 className="text-xs font-bold text-red-400 mb-2">{t('coachPage.micro.enemyStatus', 'Enemy')}</h6>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">HP</span>
                                                                    <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Mana</span>
                                                                    <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                                        {microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Lv</span>
                                                                    <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.enemyStatus.level}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Wave</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.wavePosition}</p>
                                                        </div>
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Jungler</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.junglerThreat}</p>
                                                        </div>
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Minions</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.minionAdvantage}</p>
                                                        </div>
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Vision</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.visionControl}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Trade Analysis */}
                                        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                                            <button
                                                onClick={() => toggleMicroSection('trade')}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                                            >
                                                <h5 className="font-bold text-white flex items-center gap-2">
                                                    <span className="text-orange-400">⚔️</span>
                                                    {t('analyzePage.micro.tradeAnalysis')}
                                                    <span className={`text-xs font-bold ${outcomeColors[microResult.enhanced!.tradeAnalysis.outcome]}`}>
                                                        {microResult.enhanced!.tradeAnalysis.outcome}
                                                    </span>
                                                </h5>
                                                {expandedMicroSections.trade ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                            </button>
                                            {expandedMicroSections.trade && (
                                                <div className="p-4 border-t border-slate-800 space-y-3">
                                                    <p className="text-sm text-slate-300">{microResult.enhanced!.tradeAnalysis.reason}</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Damage Given</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.hpExchanged.damageGiven}</p>
                                                        </div>
                                                        <div className="p-2 bg-slate-800/50 rounded">
                                                            <span className="text-slate-500">Damage Taken</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.hpExchanged.damageTaken}</p>
                                                        </div>
                                                    </div>
                                                    {microResult.enhanced!.tradeAnalysis.cooldownContext && (
                                                        <div className="p-2 bg-slate-800/50 rounded text-xs">
                                                            <span className="text-slate-500">CD Context</span>
                                                            <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.cooldownContext}</p>
                                                        </div>
                                                    )}
                                                    {microResult.enhanced!.tradeAnalysis.optimalAction && (
                                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                                            <h6 className="text-xs font-bold text-emerald-400 mb-1">Optimal Action</h6>
                                                            <p className="text-sm text-slate-300">{microResult.enhanced!.tradeAnalysis.optimalAction}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Mechanics Evaluation */}
                                        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                                            <button
                                                onClick={() => toggleMicroSection('mechanics')}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                                            >
                                                <h5 className="font-bold text-white flex items-center gap-2">
                                                    <span className="text-cyan-400">🎮</span>
                                                    {t('analyzePage.micro.mechanics')}
                                                </h5>
                                                {expandedMicroSections.mechanics ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                            </button>
                                            {expandedMicroSections.mechanics && (
                                                <div className="p-4 border-t border-slate-800 space-y-3">
                                                    {/* Positioning */}
                                                    <div className="p-2 bg-slate-800/50 rounded text-sm">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs text-slate-500">Positioning</span>
                                                            <span className="text-xs font-bold text-purple-400">{microResult.enhanced!.mechanicsEvaluation.positioningScore}</span>
                                                        </div>
                                                        <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.positioningNote}</p>
                                                    </div>
                                                    {/* Combo */}
                                                    <div className="p-2 bg-slate-800/50 rounded text-sm">
                                                        <span className="text-xs text-slate-500">Combo Execution</span>
                                                        <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.comboExecution}</p>
                                                    </div>
                                                    {/* Auto Attack Weaving */}
                                                    <div className="p-2 bg-slate-800/50 rounded text-sm">
                                                        <span className="text-xs text-slate-500">Auto-Attack Weaving</span>
                                                        <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.autoAttackWeaving}</p>
                                                    </div>
                                                    {/* Skills Used */}
                                                    {microResult.enhanced!.mechanicsEvaluation.skillsUsed.length > 0 && (
                                                        <div className="space-y-1">
                                                            <span className="text-xs text-slate-500">Skills</span>
                                                            {microResult.enhanced!.mechanicsEvaluation.skillsUsed.map((skill, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 text-xs p-1.5 bg-slate-900/50 rounded">
                                                                    <span className="font-mono font-bold text-white">{skill.skill}</span>
                                                                    <span className={skill.hit === true ? 'text-green-400' : skill.hit === false ? 'text-red-400' : 'text-slate-400'}>
                                                                        {skill.hit === true ? 'Hit' : skill.hit === false ? 'Missed' : 'N/A'}
                                                                    </span>
                                                                    <span className="text-slate-500">{skill.timing}</span>
                                                                    <span className="text-slate-400 flex-1 truncate">{skill.note}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Improvements */}
                                        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                                            <button
                                                onClick={() => toggleMicroSection('improvements')}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                                            >
                                                <h5 className="font-bold text-white flex items-center gap-2">
                                                    <span className="text-yellow-400">💡</span>
                                                    {t('analyzePage.micro.improvements')}
                                                    <span className="text-xs text-slate-500">({microResult.enhanced!.improvements.length})</span>
                                                </h5>
                                                {expandedMicroSections.improvements ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                            </button>
                                            {expandedMicroSections.improvements && (
                                                <div className="p-4 border-t border-slate-800 space-y-3">
                                                    {microResult.enhanced!.improvements.map((imp, idx) => (
                                                        <div key={idx} className="p-3 bg-slate-800/50 rounded-lg border-l-2 border-yellow-500/50">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[imp.priority]}`}>
                                                                    {imp.priority}
                                                                </span>
                                                                <span className="text-xs text-slate-500">{imp.category}</span>
                                                            </div>
                                                            <p className="text-sm text-white font-medium mb-1">{imp.title}</p>
                                                            <p className="text-sm text-red-400/80">{imp.currentBehavior}</p>
                                                            <p className="text-sm text-emerald-400/80">{imp.idealBehavior}</p>
                                                            {imp.practice && (
                                                                <p className="text-xs text-cyan-400 mt-2">🎯 {imp.practice}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    /* Legacy fallback (no enhanced data) */
                                    <div className="bg-slate-900 p-4 rounded-xl border border-purple-500/50">
                                        <h4 className="font-bold text-white mb-3">{t('analyzePage.micro.clipSelector')}</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <h5 className="text-xs font-bold text-purple-400 mb-1">{t('analyzePage.results.summary')}</h5>
                                                <p className="text-sm text-slate-300">{microResult.summary}</p>
                                            </div>
                                            {microResult.mistakes.length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-bold text-red-400 mb-1">{t('analyzePage.results.improvement')}</h5>
                                                    <ul className="space-y-2">
                                                        {microResult.mistakes.map((mk, idx) => (
                                                            <li key={idx} className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded border-l-2 border-red-500">
                                                                <span className="font-bold text-red-300">[{mk.timestamp}] {mk.title}</span><br />
                                                                {mk.advice}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {microResult.finalAdvice && (
                                                <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                                                    <p className="text-sm text-slate-300">{microResult.finalAdvice}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Re-analyze Button */}
                                <button
                                    onClick={() => { setMicroResult(null); setAdCompleted(false); }}
                                    className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
                                >
                                    {t('analyzePage.results.reanalyze')}
                                </button>
                            </div>
                        )}

                        {/* Minimal Plan Link */}
                        <div className="text-center py-4">
                            <Link
                                href="/pricing"
                                className="text-sm text-slate-500 hover:text-slate-300 transition"
                            >
                                {t('analyzePage.results.viewPlans')}
                            </Link>
                        </div>

                        </div>
                        {/* End of 2-column grid */}
                        </div>
                    </div>

                    {/* Right Ad Sidebar - Fixed to outer right on xl screens */}
                    <div className="hidden xl:block flex-shrink-0 w-[160px] ml-6">
                        <div className="sticky top-24">
                            <AdSenseBanner className="w-[160px] h-[600px] bg-slate-800/30 rounded" />
                        </div>
                    </div>
                </div>

                {/* Mobile Ad - Only shown on smaller screens */}
                <div className="xl:hidden mt-6 flex justify-center px-4">
                    <AdSenseBanner className="w-full max-w-[336px] h-[280px] bg-slate-800/30 rounded" />
                </div>

                {/* Ad Banner 4 - Bottom */}
                <div className="mt-8 flex justify-center px-4">
                    <AdSenseBanner className="w-full max-w-[728px] h-[90px] bg-slate-800/30 rounded" />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 mt-12 py-8">
                <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
                    <p>{t('footer.copyright').replace('{year}', '2024')}</p>
                    <div className="mt-2 flex justify-center gap-4">
                        <Link href="/terms" className="hover:text-slate-300">{t('footer.terms')}</Link>
                        <Link href="/privacy" className="hover:text-slate-300">{t('footer.privacy')}</Link>
                    </div>
                </div>
            </footer>

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
