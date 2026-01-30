"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FaPlay, FaClock, FaMapMarkerAlt, FaDragon, FaSkull, FaBolt, FaChevronDown, FaChevronUp, FaLightbulb, FaShoppingCart } from "react-icons/fa";
import { selectAnalysisSegments, analyzeVideoMacro, detectGameTimeFromFrame, type VideoMacroSegment, type SegmentAnalysis, type VideoMacroAnalysisResult } from "@/app/actions/videoMacroAnalysis";

type Props = {
    matchId: string;
    puuid: string;
    videoFile: File | null;
    videoElement: HTMLVideoElement | null;
    onAnalysisComplete?: (result: VideoMacroAnalysisResult) => void;
    disabled?: boolean;
};

export default function VideoMacroAnalysis({ matchId, puuid, videoFile, videoElement, onAnalysisComplete, disabled }: Props) {
    // State
    const [segments, setSegments] = useState<VideoMacroSegment[]>([]);
    const [loadingSegments, setLoadingSegments] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState("");
    const [result, setResult] = useState<VideoMacroAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedSegment, setExpandedSegment] = useState<number | null>(null);

    // Time offset: videoTime = gameTime + timeOffset
    // Auto-detected from first frame analysis
    const [timeOffset, setTimeOffset] = useState<number>(0);
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [calibrationStatus, setCalibrationStatus] = useState<string>("");

    // Load segments when match changes
    useEffect(() => {
        if (matchId && puuid) {
            loadSegments();
        }
    }, [matchId, puuid]);

    const loadSegments = async () => {
        setLoadingSegments(true);
        setError(null);
        try {
            const res = await selectAnalysisSegments(matchId, puuid);
            if (res.success && res.segments) {
                setSegments(res.segments);
            } else {
                setError(res.error || "セグメントの取得に失敗しました");
            }
        } catch (e: any) {
            setError(e.message);
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

    // Run analysis
    const runAnalysis = async () => {
        if (!videoFile || !videoElement || segments.length === 0) {
            setError("動画またはセグメントが選択されていません");
            return;
        }

        setAnalyzing(true);
        setProgress(0);
        setError(null);
        setResult(null);

        try {
            // Step 1: Auto-detect time offset if not calibrated
            let currentOffset = timeOffset;
            if (!isCalibrated) {
                setProgressMsg("時間同期を自動検出中...");
                setProgress(5);

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

            setProgress(10);

            // Step 2: Extract frames for each segment
            const allFrames: { segmentId: number; frameIndex: number; gameTime: number; base64Data: string }[] = [];

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                setProgressMsg(`セグメント ${i + 1}/${segments.length} のフレーム抽出中...`);
                setProgress(10 + (i / segments.length) * 40);

                // Use 0.2fps (1 frame per 5 seconds) = 6 frames per 30sec segment
                // This significantly reduces payload size while maintaining analysis quality
                const frames = await extractFrames(videoElement, segment, 0.2, currentOffset);
                allFrames.push(...frames);
            }

            setProgressMsg("AIが分析中...");
            setProgress(60);

            // Check payload size (rough estimate)
            const payloadSize = allFrames.reduce((acc, f) => acc + f.base64Data.length, 0);
            console.log(`[VideoMacro] Total frames: ${allFrames.length}, Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);

            // If payload is too large (>8MB), warn and reduce quality further
            if (payloadSize > 8 * 1024 * 1024) {
                console.warn("[VideoMacro] Payload too large, analysis may fail");
                setError(`フレームデータが大きすぎます (${(payloadSize / 1024 / 1024).toFixed(1)}MB)。動画の解像度を下げてください。`);
                setAnalyzing(false);
                return;
            }

            // Call API
            const analysisResult = await analyzeVideoMacro({
                matchId,
                puuid,
                segments,
                frames: allFrames
            });

            setProgress(100);
            setResult(analysisResult);

            if (analysisResult.success) {
                const completedMsg = `分析完了! (${analysisResult.completedSegments}/${analysisResult.requestedSegments} セグメント)`;
                setProgressMsg(completedMsg);
                console.log(`[VideoMacro] ${completedMsg}`);
                if (analysisResult.warnings && analysisResult.warnings.length > 0) {
                    console.warn('[VideoMacro] Warnings:', analysisResult.warnings);
                }
                onAnalysisComplete?.(analysisResult);
            } else {
                setError(analysisResult.error || "分析に失敗しました");
            }
        } catch (e: any) {
            setError(e.message);
        }

        setAnalyzing(false);
    };

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
            case 'OBJECTIVE': return 'オブジェクト';
            case 'DEATH': return 'デス';
            case 'TURNING_POINT': return 'ターニングポイント';
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
        setCalibrationStatus("ゲーム内時間を検出中...");
        try {
            const result = await detectGameTimeFromFrame(frameBase64);
            if (result.success && result.gameTimeSeconds !== undefined) {
                // offset = videoTime - gameTime
                const offset = videoTimeSec - result.gameTimeSeconds;
                console.log(`[VideoMacro] Auto-detected: videoTime=${videoTimeSec}s, gameTime=${result.gameTimeStr}(${result.gameTimeSeconds}s), offset=${offset}s`);
                setCalibrationStatus(`検出成功: ${result.gameTimeStr}`);
                return offset;
            } else {
                setCalibrationStatus("時間検出失敗 - 手動設定が必要");
                return null;
            }
        } catch (e: any) {
            console.error("[VideoMacro] Time detection error:", e);
            setCalibrationStatus("検出エラー");
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
                <FaMapMarkerAlt /> 動画マクロ分析
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">NEW</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
                動画から5つの重要シーンを抽出し、「どう動けば勝てたか」を分析します
            </p>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Time Calibration Status */}
            {!result && videoFile && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                        <FaClock className="text-slate-400" />
                        <span className="text-sm text-slate-300">時間同期</span>
                        {isCalibrated ? (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✓ 自動検出済み
                            </span>
                        ) : (
                            <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">
                                分析開始時に自動検出
                            </span>
                        )}
                    </div>
                    {isCalibrated && timeOffset !== 0 && (
                        <div className="mt-2 text-xs text-slate-400">
                            オフセット: <span className="text-emerald-300 font-mono">{formatTime(timeOffset)}</span>
                            <span className="text-slate-500 ml-2">
                                (動画が{timeOffset > 0 ? `${formatTime(timeOffset)}早い` : `${formatTime(Math.abs(timeOffset))}遅い`})
                            </span>
                        </div>
                    )}
                    {calibrationStatus && !isCalibrated && (
                        <div className="mt-2 text-xs text-amber-400">{calibrationStatus}</div>
                    )}
                </div>
            )}

            {/* Segment Selection */}
            {!result && (
                <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-300">分析対象シーン (5箇所)</span>
                        <button
                            onClick={loadSegments}
                            disabled={loadingSegments}
                            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                        >
                            {loadingSegments ? "読込中..." : "再読込"}
                        </button>
                    </div>

                    {loadingSegments ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
                        </div>
                    ) : segments.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            セグメントが見つかりません
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {segments.map((seg, idx) => (
                                <div
                                    key={seg.segmentId}
                                    className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition cursor-pointer"
                                    onClick={() => seekToTimestamp(seg.analysisStartTime)}
                                >
                                    <div className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-full text-lg">
                                        {getSegmentIcon(seg.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">
                                                {formatTimeMs(seg.analysisStartTime)} → {seg.targetTimestampStr}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                seg.type === 'OBJECTIVE' ? 'bg-purple-500/20 text-purple-300' :
                                                seg.type === 'DEATH' ? 'bg-red-500/20 text-red-300' :
                                                'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {getSegmentTypeName(seg.type)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{seg.eventDescription}</p>
                                    </div>
                                    <FaPlay className="text-slate-500 text-xs" />
                                </div>
                            ))}
                        </div>
                    )}
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
                <button
                    onClick={runAnalysis}
                    disabled={disabled || !videoFile || segments.length === 0}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                        disabled || !videoFile || segments.length === 0
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    }`}
                >
                    <FaMapMarkerAlt />
                    {!videoFile ? '動画を選択してください' :
                     segments.length === 0 ? 'セグメントを読み込み中...' :
                     'マクロ分析を開始'}
                </button>
            )}

            {/* Results Display */}
            {result && result.success && (
                <div className="space-y-4 animate-in slide-in-from-bottom-5">
                    {/* Segment Stats Warning */}
                    {result.requestedSegments && result.completedSegments !== undefined && result.completedSegments < result.requestedSegments && (
                        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="text-xs text-yellow-400">
                                ⚠️ {result.requestedSegments}個中{result.completedSegments}個のセグメントを分析しました
                                {result.warnings && result.warnings.length > 0 && (
                                    <details className="mt-1">
                                        <summary className="cursor-pointer text-yellow-500 hover:text-yellow-400">詳細を表示</summary>
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
                            <FaLightbulb /> 分析サマリー
                        </h4>
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-xs text-red-400 font-bold mb-1">最大の課題</div>
                            <p className="text-sm text-white font-semibold">{result.overallSummary.mainIssue}</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="text-xs text-blue-400 font-bold mb-1">📝 今日の宿題</div>
                            <h5 className="text-white font-bold mb-1">{result.overallSummary.homework.title}</h5>
                            <p className="text-sm text-slate-300 mb-2">{result.overallSummary.homework.description}</p>
                            <div className="text-xs text-cyan-400 mb-2">
                                ✅ {result.overallSummary.homework.howToCheck}
                            </div>
                            {result.overallSummary.homework.relatedTimestamps && result.overallSummary.homework.relatedTimestamps.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                    <div className="text-xs text-slate-400 font-bold mb-2">📌 関連シーン</div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.overallSummary.homework.relatedTimestamps.map((ts, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    const [min, sec] = ts.split(':').map(Number);
                                                    seekToTimestamp((min * 60 + sec - 30) * 1000);
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
                                <FaShoppingCart /> ビルド推奨
                            </h4>
                            <div className="space-y-3">
                                {/* User Build Info */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-400">あなた:</span>
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
                                        <div className="text-xs text-purple-400 font-bold mb-2">💎 推奨コアアイテム</div>
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
                        <h4 className="font-bold text-slate-300 text-sm">シーン別分析</h4>
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
                                            <div className="text-xs font-bold text-slate-400 mb-2">📍 状況観察</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">自分の位置:</span>
                                                    <p className="text-slate-300">{seg.observation.userPosition}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">味方の位置:</span>
                                                    <p className="text-slate-300">{seg.observation.allyPositions}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">ウェーブ状態:</span>
                                                    <p className="text-slate-300">{seg.observation.waveState}</p>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <span className="text-slate-500">オブジェクト:</span>
                                                    <p className="text-slate-300">{seg.observation.objectiveState}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Winning Pattern */}
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                            <div className="text-xs font-bold text-emerald-400 mb-2">✨ 勝ちパターン: {seg.winningPattern.title}</div>
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
                                            <div className="text-xs font-bold text-orange-400 mb-2">⚡ 実際との差</div>
                                            <p className="text-sm text-slate-300 mb-2">{seg.gap.description}</p>
                                            <div className="text-xs text-yellow-400 mb-1">決定的なタイミング: {seg.gap.criticalMoment}</div>
                                            <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                                                <div className="text-xs text-green-400 font-bold">💡 こうすべきだった</div>
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
                                            <FaPlay /> このシーンを動画で確認
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Re-analyze Button */}
                    <button
                        onClick={() => {
                            setResult(null);
                            loadSegments();
                        }}
                        className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
                    >
                        別のセグメントで再分析
                    </button>
                </div>
            )}
        </div>
    );
}
