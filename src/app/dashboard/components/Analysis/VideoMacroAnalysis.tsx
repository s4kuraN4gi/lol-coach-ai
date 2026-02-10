"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FaPlay, FaClock, FaMapMarkerAlt, FaDragon, FaSkull, FaBolt, FaChevronDown, FaChevronUp, FaLightbulb, FaShoppingCart } from "react-icons/fa";
import { selectAnalysisSegments, detectGameTimeFromFrame, type VideoMacroSegment, type VideoMacroAnalysisResult } from "@/app/actions/videoMacroAnalysis";
import { useTranslation } from "@/contexts/LanguageContext";
import { getAnalysisStatus } from "@/app/actions/analysis";
import { useVideoMacroAnalysis } from "@/app/Providers/VideoMacroAnalysisProvider";

type Props = {
    matchId: string;
    puuid: string;
    videoFile: File | null;
    videoElement: HTMLVideoElement | null;
    onAnalysisComplete?: (result: VideoMacroAnalysisResult) => void;
    disabled?: boolean;
    isPremium?: boolean;  // Premium users get 5 segments, free users get 2
    weeklyRemaining?: number;  // Remaining weekly analysis count
    weeklyLimit?: number;  // Weekly analysis limit for the user's plan
};

// Segment limits by plan
const FREE_SEGMENT_LIMIT = 3;
const PREMIUM_SEGMENT_LIMIT = 5;

export default function VideoMacroAnalysis({ matchId, puuid, videoFile, videoElement, onAnalysisComplete, disabled, isPremium = false, weeklyRemaining, weeklyLimit }: Props) {
    const maxSegments = isPremium ? PREMIUM_SEGMENT_LIMIT : FREE_SEGMENT_LIMIT;
    const { t, language } = useTranslation();

    // Provider state (for async background analysis)
    const {
        isAnalyzing: providerAnalyzing,
        asyncStatus,
        progress: providerProgress,
        statusMessage: providerStatusMsg,
        error: providerError,
        result: providerResult,
        currentMatchId,
        startAnalysis,
        resetAnalysis,
        clearError,
        restoreResultForMatch
    } = useVideoMacroAnalysis();

    // Local UI state
    const [segments, setSegments] = useState<VideoMacroSegment[]>([]);
    const [loadingSegments, setLoadingSegments] = useState(false);
    const [extractingFrames, setExtractingFrames] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [localProgressMsg, setLocalProgressMsg] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [expandedSegment, setExpandedSegment] = useState<number | null>(null);

    // Combined state: local frame extraction + provider async analysis
    const analyzing = extractingFrames || providerAnalyzing;
    const progress = extractingFrames ? localProgress : providerProgress;
    const progressMsg = extractingFrames ? localProgressMsg : providerStatusMsg;
    const error = localError || providerError;

    // Use provider result if it's for this match
    const result = (providerResult && currentMatchId === matchId) ? providerResult : null;

    // Time offset: videoTime = gameTime + timeOffset
    // Auto-detected from first frame analysis
    const [timeOffset, setTimeOffset] = useState<number>(0);
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [calibrationStatus, setCalibrationStatus] = useState<string>("");

    // Load segments and try to restore results when match changes or plan changes
    useEffect(() => {
        if (matchId && puuid) {
            loadSegments();
            // Try to restore previous analysis result for this match
            restoreResultForMatch(matchId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId, puuid, maxSegments]); // Intentionally exclude restoreResultForMatch to prevent infinite loop

    const loadSegments = async () => {
        setLoadingSegments(true);
        setLocalError(null);
        try {
            const res = await selectAnalysisSegments(matchId, puuid, language as 'ja' | 'en' | 'ko', maxSegments);
            if (res.success && res.segments) {
                setSegments(res.segments);
            } else {
                setLocalError(res.error || t('coachPage.videoMacro.errors.segmentFetchFailed', 'Failed to fetch segments'));
            }
        } catch (e: any) {
            setLocalError(e.message);
        }
        setLoadingSegments(false);
    };

    // Extract frames from video at specific timestamps
    // Frames are resized to reduce payload size for server action
    const extractFrames = useCallback(async (
        video: HTMLVideoElement,
        segment: VideoMacroSegment,
        fps: number = 0.5,
        offset: number = 0  // Time offset: videoTime = gameTime + offset
    ): Promise<{ segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[]> => {
        const frames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];
        const duration = (segment.analysisEndTime - segment.analysisStartTime) / 1000; // seconds
        const frameCount = Math.ceil(duration * fps);
        const interval = duration / frameCount;

        // Resize to 1280x720 (720p) for better minimap visibility
        // Higher resolution needed for AI to read minimap accurately
        const targetWidth = 1280;
        const targetHeight = 720;

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return frames;

        for (let i = 0; i < frameCount; i++) {
            const gameTimeMs = segment.analysisStartTime + (i * interval * 1000);
            // Apply time offset: videoTime = gameTime + offset
            const videoTimeSec = (gameTimeMs / 1000) + offset;

            // Seek to position (ensure non-negative)
            video.currentTime = Math.max(0, videoTimeSec);
            await new Promise<void>((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener("seeked", onSeeked);
                    resolve();
                };
                video.addEventListener("seeked", onSeeked);
            });

            // Capture and resize frame
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            // Use JPEG quality 0.7 for better minimap visibility
            const base64 = canvas.toDataURL("image/jpeg", 0.7);

            frames.push({
                segmentId: segment.segmentId,
                frameIndex: i,
                gameTime: gameTimeMs,
                base64Data: base64
            });
        }

        return frames;
    }, []);

    // Run analysis (async background processing)
    const runAnalysis = async () => {
        if (!videoFile || !videoElement || segments.length === 0) {
            setLocalError(t('coachPage.videoMacro.errors.noVideoOrSegments', 'No video or segments selected'));
            return;
        }

        setExtractingFrames(true);
        setLocalProgress(0);
        setLocalError(null);
        clearError();

        try {
            // Step 0: Re-check premium/credit status before starting
            setLocalProgressMsg(t('coachPage.videoMacro.progress.checkingStatus', 'Checking account status...'));
            const freshStatus = await getAnalysisStatus();
            if (!freshStatus) {
                setLocalError(t('coachPage.videoMacro.errors.noProfile', 'User profile not found'));
                setExtractingFrames(false);
                return;
            }

            // Check if user can analyze (premium or has credits)
            if (!freshStatus.is_premium && freshStatus.analysis_credits <= 0) {
                setLocalError(t('coachPage.videoMacro.errors.noCredits', 'クレジットが不足しています。プレミアムプランにアップグレードするか、クレジットを追加してください。'));
                setExtractingFrames(false);
                return;
            }

            // Step 1: Auto-detect time offset if not calibrated
            let currentOffset = timeOffset;
            if (!isCalibrated) {
                setLocalProgressMsg(t('coachPage.videoMacro.progress.detectingTimeSync', 'Auto-detecting time sync...'));
                setLocalProgress(5);

                // Seek to a position where game time should be visible (e.g., 2 minutes into video)
                const testVideoTime = Math.min(120, videoElement.duration * 0.1); // 2min or 10% of video
                videoElement.currentTime = testVideoTime;
                await new Promise<void>((resolve) => {
                    const onSeeked = () => {
                        videoElement.removeEventListener("seeked", onSeeked);
                        resolve();
                    };
                    videoElement.addEventListener("seeked", onSeeked);
                });

                // Extract a frame and detect game time
                const testFrame = await extractSingleFrame(videoElement);
                const detectedOffset = await autoDetectTimeOffset(testVideoTime, testFrame);

                if (detectedOffset !== null) {
                    currentOffset = detectedOffset;
                    setTimeOffset(detectedOffset);
                    setIsCalibrated(true);
                } else {
                    // Fallback: assume no offset
                    console.warn("[VideoMacro] Could not detect time, assuming offset=0");
                    currentOffset = 0;
                }
            }

            setLocalProgress(10);

            // Step 2: Extract frames for each segment (client-side)
            const allFrames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                setLocalProgressMsg(t('coachPage.videoMacro.progress.extractingFrames', 'Extracting frames...') + ` ${i + 1}/${segments.length}`);
                setLocalProgress(10 + (i / segments.length) * 40);

                // Use 0.2fps (1 frame per 5 seconds) = 6 frames per 30sec segment
                const frames = await extractFrames(videoElement, segment, 0.2, currentOffset);
                allFrames.push(...frames);
            }

            setLocalProgressMsg(t('coachPage.videoMacro.progress.preparingUpload', 'Preparing upload...'));
            setLocalProgress(55);

            // Check payload size (rough estimate)
            const payloadSize = allFrames.reduce((acc, f) => acc + f.base64Data.length, 0);
            console.log(`[VideoMacro] Total frames: ${allFrames.length}, Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);

            // If payload is too large (>8MB), warn and reduce quality further
            if (payloadSize > 8 * 1024 * 1024) {
                console.warn("[VideoMacro] Payload too large, analysis may fail");
                setLocalError(t('coachPage.videoMacro.errors.payloadTooLarge', 'Frame data too large') + ` (${(payloadSize / 1024 / 1024).toFixed(1)}MB)`);
                setExtractingFrames(false);
                return;
            }

            // Step 3: Start async background analysis via provider
            setLocalProgressMsg(t('coachPage.videoMacro.progress.startingAnalysis', 'Starting analysis...'));
            setLocalProgress(60);

            const startResult = await startAnalysis({
                matchId,
                puuid,
                segments,
                frames: allFrames,
                language: language as 'ja' | 'en' | 'ko',
                timeOffset: currentOffset
            });

            // Frame extraction complete, provider will handle the rest
            setExtractingFrames(false);

            if (!startResult.success) {
                setLocalError(startResult.error || t('coachPage.videoMacro.errors.analysisFailed', 'Analysis failed'));
            }
            // If successful, provider will poll for results and update state

        } catch (e: any) {
            setLocalError(e.message);
            setExtractingFrames(false);
        }
    };

    // Handle analysis completion (call onAnalysisComplete when result is ready)
    // Store callback in ref to avoid dependency issues
    const onAnalysisCompleteRef = useRef(onAnalysisComplete);
    onAnalysisCompleteRef.current = onAnalysisComplete;

    const prevResultRef = useRef<VideoMacroAnalysisResult | null>(null);
    useEffect(() => {
        // Only call callback when result changes from null/different to a new successful result
        if (result && result.success && result !== prevResultRef.current) {
            prevResultRef.current = result;
            onAnalysisCompleteRef.current?.(result);
        }
    }, [result]);

    // Restore timeOffset from result when loaded (for video seek functionality)
    useEffect(() => {
        if (result?.timeOffset !== undefined) {
            setTimeOffset(result.timeOffset);
            setIsCalibrated(true);
        }
    }, [result]);

    // Segment type icon
    const getSegmentIcon = (type: string) => {
        switch (type) {
            case 'OBJECTIVE': return <FaDragon className="text-purple-400" />;
            case 'DEATH': return <FaSkull className="text-red-400" />;
            case 'TURNING_POINT': return <FaBolt className="text-yellow-400" />;
            default: return <FaMapMarkerAlt className="text-blue-400" />;
        }
    };

    const getSegmentTypeName = (type: string) => {
        switch (type) {
            case 'OBJECTIVE': return t('coachPage.videoMacro.segmentTypes.objective', 'Objective');
            case 'DEATH': return t('coachPage.videoMacro.segmentTypes.death', 'Death');
            case 'TURNING_POINT': return t('coachPage.videoMacro.segmentTypes.turningPoint', 'Turning Point');
            default: return type;
        }
    };

    // Seek video to timestamp (with offset applied)
    // videoTime = gameTime + offset
    // Does not auto-play - user can review the frame and play manually
    const seekToTimestamp = (gameTimeMs: number) => {
        if (videoElement) {
            const videoTimeSec = (gameTimeMs / 1000) + timeOffset;
            videoElement.currentTime = Math.max(0, videoTimeSec);
            videoElement.pause(); // Ensure video is paused for review
        }
    };

    // Auto-detect time offset from a frame
    const autoDetectTimeOffset = async (videoTimeSec: number, frameBase64: string): Promise<number | null> => {
        setCalibrationStatus(t('coachPage.videoMacro.calibration.detecting', 'Detecting game time...'));
        try {
            const result = await detectGameTimeFromFrame(frameBase64);
            if (result.success && result.gameTimeSeconds !== undefined) {
                // offset = videoTime - gameTime
                const offset = videoTimeSec - result.gameTimeSeconds;
                console.log(`[VideoMacro] Auto-detected: videoTime=${videoTimeSec}s, gameTime=${result.gameTimeStr}(${result.gameTimeSeconds}s), offset=${offset}s`);
                setCalibrationStatus(`${t('coachPage.videoMacro.calibration.detected', 'Detected')}: ${result.gameTimeStr}`);
                return offset;
            } else {
                setCalibrationStatus(t('coachPage.videoMacro.calibration.failed', 'Detection failed'));
                return null;
            }
        } catch (e: any) {
            console.error("[VideoMacro] Time detection error:", e);
            setCalibrationStatus(t('coachPage.videoMacro.calibration.error', 'Detection error'));
            return null;
        }
    };

    // Extract a single frame at current video position for calibration
    const extractSingleFrame = async (video: HTMLVideoElement): Promise<string> => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(video, 0, 0, 1280, 720);
        return canvas.toDataURL("image/jpeg", 0.7);
    };

    // Format seconds to mm:ss
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.floor(Math.abs(seconds) % 60);
        const sign = seconds < 0 ? '-' : '';
        return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format milliseconds to mm:ss (for segment timestamps)
    const formatTimeMs = (ms: number): string => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 relative overflow-hidden">
            {/* Header */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <h3 className="font-bold text-emerald-400 text-lg mb-2 flex items-center gap-2">
                <FaMapMarkerAlt /> {t('coachPage.videoMacro.title', 'Video Macro Analysis')}
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">NEW</span>
            </h3>
            <p className="text-xs text-slate-400 mb-2">
                {t('coachPage.videoMacro.description', 'Extracts key scenes from video and analyzes how you could have won')}
            </p>

            {/* Segment Limit Indicator */}
            {!result && (
                <div className="mb-4 flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${isPremium ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                        {isPremium ? (
                            <>✨ {t('coachPage.videoMacro.premium', 'Premium')}: {maxSegments}{t('coachPage.videoMacro.segments', 'segments')}</>
                        ) : (
                            <>{t('coachPage.videoMacro.free', 'Free')}: {maxSegments}{t('coachPage.videoMacro.segments', 'segments')} <span className="text-emerald-400">({t('coachPage.videoMacro.upgradeTo5', 'Upgrade to 5')})</span></>
                        )}
                    </span>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {error}
                    <button onClick={() => { setLocalError(null); clearError(); }} className="ml-2 text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Time Calibration Status */}
            {!result && videoFile && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                        <FaClock className="text-slate-400" />
                        <span className="text-sm text-slate-300">{t('coachPage.videoMacro.timeSync.label', 'Time Sync')}</span>
                        {isCalibrated ? (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✓ {t('coachPage.videoMacro.timeSync.autoDetected', 'Auto-detected')}
                            </span>
                        ) : (
                            <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">
                                {t('coachPage.videoMacro.timeSync.onAnalysisStart', 'Detected on analysis start')}
                            </span>
                        )}
                    </div>
                    {isCalibrated && timeOffset !== 0 && (
                        <div className="mt-2 text-xs text-slate-400">
                            {t('coachPage.videoMacro.timeSync.offset', 'Offset')}: <span className="text-emerald-300 font-mono">{formatTime(timeOffset)}</span>
                            <span className="text-slate-500 ml-2">
                                ({t('coachPage.videoMacro.timeSync.video', 'Video')} {timeOffset > 0 ? `+${formatTime(timeOffset)}` : formatTime(timeOffset)})
                            </span>
                        </div>
                    )}
                    {calibrationStatus && !isCalibrated && (
                        <div className="mt-2 text-xs text-amber-400">{calibrationStatus}</div>
                    )}
                </div>
            )}

            {/* Segment Loading Indicator (hidden, but shows status) */}
            {!result && !analyzing && loadingSegments && (
                <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-500"></div>
                    {t('coachPage.videoMacro.segments.loading', 'Loading segments...')}
                </div>
            )}

            {/* Analysis Progress */}
            {analyzing && (
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{progressMsg}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Analysis Button */}
            {!result && !analyzing && (
                <div className="space-y-2">
                    <button
                        onClick={runAnalysis}
                        disabled={disabled || !videoFile || segments.length === 0 || loadingSegments}
                        className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                            disabled || !videoFile || segments.length === 0 || loadingSegments
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        }`}
                    >
                        <FaMapMarkerAlt />
                        {disabled && weeklyRemaining === 0 ? t('coachPage.videoMacro.buttons.weeklyLimitReached', 'Weekly limit reached') :
                         !videoFile ? t('coachPage.videoMacro.buttons.selectVideo', 'Please select a video') :
                         loadingSegments ? t('coachPage.videoMacro.buttons.loadingSegments', 'Loading segments...') :
                         segments.length === 0 ? t('coachPage.videoMacro.errors.segmentFetchFailed', 'Failed to load segments') :
                         weeklyRemaining !== undefined && weeklyLimit !== undefined
                            ? `${t('coachPage.videoMacro.buttons.startAnalysis', 'Start Macro Analysis')} (${weeklyRemaining}/${weeklyLimit})`
                            : t('coachPage.videoMacro.buttons.startAnalysis', 'Start Macro Analysis')}
                    </button>
                    {/* Upgrade prompt when limit reached */}
                    {disabled && weeklyRemaining === 0 && !isPremium && (
                        <div className="text-center text-xs text-slate-400">
                            {t('coachPage.videoMacro.buttons.upgradePrompt', 'Upgrade to Premium for 20 analyses/week')}
                        </div>
                    )}
                </div>
            )}

            {/* Results Display */}
            {result && result.success && (
                <div className="space-y-4 animate-in slide-in-from-bottom-5">
                    {/* Segment Stats Warning */}
                    {result.requestedSegments && result.completedSegments !== undefined && result.completedSegments < result.requestedSegments && (
                        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="text-xs text-yellow-400">
                                ⚠️ {result.completedSegments}/{result.requestedSegments} {t('coachPage.videoMacro.results.segmentsAnalyzed', 'segments analyzed')}
                                {result.warnings && result.warnings.length > 0 && (
                                    <details className="mt-1">
                                        <summary className="cursor-pointer text-yellow-500 hover:text-yellow-400">{t('coachPage.videoMacro.results.showDetails', 'Show details')}</summary>
                                        <ul className="mt-1 text-[10px] text-yellow-300/70 list-disc list-inside">
                                            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Overall Summary */}
                    <div className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border border-emerald-500/50 rounded-xl p-4">
                        <h4 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                            <FaLightbulb /> {t('coachPage.videoMacro.results.summary', 'Analysis Summary')}
                        </h4>
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-xs text-red-400 font-bold mb-1">{t('coachPage.videoMacro.results.mainIssue', 'Main Issue')}</div>
                            <p className="text-sm text-white font-semibold">{result.overallSummary.mainIssue}</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="text-xs text-blue-400 font-bold mb-1">📝 {t('coachPage.videoMacro.results.homework', "Today's Homework")}</div>
                            <h5 className="text-white font-bold mb-1">{result.overallSummary.homework.title}</h5>
                            <p className="text-sm text-slate-300 mb-2">{result.overallSummary.homework.description}</p>
                            <div className="text-xs text-cyan-400 mb-2">
                                ✅ {result.overallSummary.homework.howToCheck}
                            </div>
                            {result.overallSummary.homework.relatedTimestamps && result.overallSummary.homework.relatedTimestamps.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                    <div className="text-xs text-slate-400 font-bold mb-2">📌 {t('coachPage.videoMacro.results.relatedScenes', 'Related Scenes')}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.overallSummary.homework.relatedTimestamps.map((ts, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    const [min, sec] = ts.split(':').map(Number);
                                                    seekToTimestamp((min * 60 + sec) * 1000);
                                                }}
                                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded border border-slate-600 transition flex items-center gap-1"
                                            >
                                                <FaPlay className="text-[10px]" /> {ts}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Build Recommendation */}
                    {result.buildRecommendation && (
                        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-xl p-4">
                            <h4 className="font-bold text-purple-400 mb-3 flex items-center gap-2">
                                <FaShoppingCart /> {t('coachPage.videoMacro.build.title', 'Build Recommendation')}
                            </h4>
                            <div className="space-y-3">
                                {/* User Build Info */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-400">{t('coachPage.videoMacro.build.you', 'You')}:</span>
                                    <span className="text-white font-bold">{result.buildRecommendation.userChampionName}</span>
                                    <span className="text-slate-500">vs</span>
                                    <span className="text-red-400 font-bold">{result.buildRecommendation.opponentChampionName}</span>
                                </div>

                                {/* AI Analysis */}
                                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {result.buildRecommendation.analysis}
                                    </p>
                                </div>

                                {/* Item IDs (simplified display - can be enhanced with Data Dragon images later) */}
                                {result.buildRecommendation.recommendedItems.length > 0 && (
                                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                        <div className="text-xs text-purple-400 font-bold mb-2">💎 {t('coachPage.videoMacro.build.recommendedCore', 'Recommended Core Items')}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {result.buildRecommendation.recommendedItems.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="px-3 py-1.5 bg-slate-800 text-slate-200 text-sm rounded-lg border border-purple-500/30 font-medium"
                                                    title={`Item ID: ${item.id}`}
                                                >
                                                    {item.itemName}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Segment Results */}
                    <div className="space-y-2">
                        <h4 className="font-bold text-slate-300 text-sm">{t('coachPage.videoMacro.results.sceneAnalysis', 'Scene Analysis')}</h4>
                        {result.segments.map((seg, idx) => (
                            <div
                                key={seg.segmentId}
                                className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                            >
                                {/* Segment Header */}
                                <button
                                    onClick={() => setExpandedSegment(expandedSegment === seg.segmentId ? null : seg.segmentId)}
                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-full">
                                            {getSegmentIcon(seg.type)}
                                        </div>
                                        <div className="text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">
                                                    {(() => {
                                                        // Calculate start time (30 seconds before)
                                                        const [min, sec] = seg.timestamp.split(':').map(Number);
                                                        const totalSec = min * 60 + sec;
                                                        const startSec = Math.max(0, totalSec - 30);
                                                        const startMin = Math.floor(startSec / 60);
                                                        const startSecRem = startSec % 60;
                                                        return `${startMin}:${startSecRem.toString().padStart(2, '0')} → ${seg.timestamp}`;
                                                    })()}
                                                </span>
                                                <span className="text-xs text-emerald-400">{seg.winningPattern.macroConceptUsed}</span>
                                            </div>
                                            <p className="text-xs text-slate-400">{seg.winningPattern.title}</p>
                                        </div>
                                    </div>
                                    {expandedSegment === seg.segmentId ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                </button>

                                {/* Expanded Content */}
                                {expandedSegment === seg.segmentId && (
                                    <div className="p-4 border-t border-slate-700 space-y-4 animate-in slide-in-from-top-2">
                                        {/* Observation */}
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 mb-2">📍 {t('coachPage.videoMacro.scene.observation', 'Observation')}</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">{t('coachPage.videoMacro.scene.yourPosition', 'Your Position')}:</span>
                                                    <p className="text-slate-300">{seg.observation.userPosition}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">{t('coachPage.videoMacro.scene.allyPositions', 'Ally Positions')}:</span>
                                                    <p className="text-slate-300">{seg.observation.allyPositions}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">{t('coachPage.videoMacro.scene.waveState', 'Wave State')}:</span>
                                                    <p className="text-slate-300">{seg.observation.waveState}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">{t('coachPage.videoMacro.scene.objective', 'Objective')}:</span>
                                                    <p className="text-slate-300">{seg.observation.objectiveState}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Winning Pattern */}
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                            <div className="text-xs font-bold text-emerald-400 mb-2">✨ {t('coachPage.videoMacro.scene.winningPattern', 'Winning Pattern')}: {seg.winningPattern.title}</div>
                                            <ol className="space-y-1">
                                                {seg.winningPattern.steps.map((step, i) => (
                                                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                        <span className="text-emerald-400 font-bold">{i + 1}.</span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>

                                        {/* Gap Analysis */}
                                        <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                            <div className="text-xs font-bold text-orange-400 mb-2">⚡ {t('coachPage.videoMacro.scene.gap', 'Gap with Reality')}</div>
                                            <p className="text-sm text-slate-300 mb-2">{seg.gap.description}</p>
                                            <div className="text-xs text-yellow-400 mb-1">{t('coachPage.videoMacro.scene.criticalMoment', 'Critical Moment')}: {seg.gap.criticalMoment}</div>
                                            <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                                                <div className="text-xs text-green-400 font-bold">💡 {t('coachPage.videoMacro.scene.shouldHaveDone', 'What should have been done')}</div>
                                                <p className="text-sm text-white">{seg.gap.whatShouldHaveDone}</p>
                                            </div>
                                        </div>

                                        {/* Seek Button */}
                                        <button
                                            onClick={() => {
                                                const [min, sec] = seg.timestamp.split(':').map(Number);
                                                seekToTimestamp((min * 60 + sec - 30) * 1000);
                                            }}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                        >
                                            <FaPlay /> {t('coachPage.videoMacro.scene.checkInVideo', 'Check in video')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Re-analyze Button */}
                    <button
                        onClick={() => {
                            resetAnalysis();
                            loadSegments();
                        }}
                        className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
                    >
                        {t('coachPage.videoMacro.buttons.reanalyze', 'Re-analyze with different segments')}
                    </button>
                </div>
            )}
        </div>
    );
}
