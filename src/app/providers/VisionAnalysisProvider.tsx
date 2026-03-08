"use strict";
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { VideoProcessor } from "@/lib/videoProcessor";
import {
    startVisionAnalysis,
    verifyMatchVideo,
    VisionAnalysisResult,
    MatchVerificationResult
} from "@/app/actions/vision";
import { getAnalysisJobStatus, getLatestMicroAnalysisForMatch } from "@/app/actions/analysis";
import { fetchMatchDetail } from "@/app/actions/riot";
import type { MatchSummary } from "@/app/actions/coach";
import { useTranslation } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";

const MICRO_JOB_STORAGE_KEY = 'microJobId';
const MICRO_MATCH_STORAGE_KEY = 'microJobMatchId';
const MICRO_COMPLETED_MATCH_KEY = 'microCompletedMatchId';

// --- Types ---
interface VisionAnalysisContextType {
    // State
    isVisionAnalyzing: boolean;
    isVerifying: boolean;
    asyncStatus: 'idle' | 'processing' | 'completed' | 'failed';
    visionProgress: number;
    visionMsg: string;
    visionError: string | null;
    globalVisionResult: VisionAnalysisResult | null;
    debugFrames: { url: string; info: string }[];
    currentMatchId: string | null;

    // Actions
    startGlobalAnalysis: (file: File, match: MatchSummary, puuid: string, question: string, startTime?: number) => Promise<void>;
    verifyVideo: (file: File, match: MatchSummary, puuid: string, onProgress?: (msg: string) => void) => Promise<void>;
    resetAnalysis: (keepDebugFrames?: boolean) => void;
    clearError: () => void;
    setIsVerifying: (v: boolean) => void;
    restoreResultForMatch: (matchId: string) => Promise<boolean>;
}

const VisionAnalysisContext = createContext<VisionAnalysisContextType | undefined>(undefined);

export function VisionAnalysisProvider({ children }: { children: React.ReactNode }) {
    const { language, t } = useTranslation();

    // --- State ---
    const [microJobId, setMicroJobId] = useState<string | null>(null);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [asyncStatus, setAsyncStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
    const [debugFrames, setDebugFrames] = useState<{ url: string; info: string }[]>([]);
    const [isVerifying, setIsVerifying] = useState(false);

    // Helper for "Analyzing" busy state (Processing or Verifying)
    const isAnalyzing = asyncStatus === 'processing';

    // --- Persistence & Restoration ---
    // Load Job ID from LocalStorage on mount
    useEffect(() => {
        const restoreState = async () => {
            if (typeof window === 'undefined') return;

            const savedJobId = localStorage.getItem(MICRO_JOB_STORAGE_KEY);
            const savedMatchId = localStorage.getItem(MICRO_MATCH_STORAGE_KEY);
            const completedMatchId = localStorage.getItem(MICRO_COMPLETED_MATCH_KEY);

            // Case 1: There's a job in progress - restore and poll
            if (savedJobId) {
                setMicroJobId(savedJobId);
                setMatchId(savedMatchId);
                setAsyncStatus('processing');
                setStatusMessage(t('visionAnalysis.restoringBackground'));
                return;
            }

            // Case 2: There's a completed match - try to restore result from DB
            if (completedMatchId) {
                try {
                    const { found, result: savedResult } = await getLatestMicroAnalysisForMatch(completedMatchId);
                    if (found && savedResult) {
                        setVisionResult(savedResult as VisionAnalysisResult);
                        setMatchId(completedMatchId);
                        setAsyncStatus('completed');
                        setProgress(100);
                    } else {
                        // Result not found, clear the storage
                        localStorage.removeItem(MICRO_COMPLETED_MATCH_KEY);
                    }
                } catch (e) {
                    logger.error("[GlobalProvider] Failed to restore result:", e);
                    localStorage.removeItem(MICRO_COMPLETED_MATCH_KEY);
                }
            }
        };

        restoreState();
    }, []);

    // --- Polling Logic ---
    useEffect(() => {
        if (!microJobId) return;

        let intervalId: NodeJS.Timeout;
        let isMounted = true;

        const checkMicroStatus = async () => {
            if (!microJobId) return;
            let res: Awaited<ReturnType<typeof getAnalysisJobStatus>> | null = null;
            try {
                res = await getAnalysisJobStatus(microJobId);
            } catch (pollError) {
                const msg = pollError instanceof Error ? pollError.message : String(pollError);
                logger.error("[GlobalProvider] POLL ERROR:", msg);
                // Show error to user with location info
                setAsyncStatus('failed');
                setErrorMsg(`[POLL] ${msg}`);
                setMicroJobId(null);
                localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
                localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
                return;
            }

            if (!isMounted) return;

            if (res.status === 'completed' && res.result) {
                // Check for corrupted result
                if (res.result.error && res.result.error.includes('corrupted')) {
                    logger.error("[GlobalProvider] Result was corrupted");
                    setAsyncStatus('failed');
                    setErrorMsg(t('visionAnalysis.resultCorrupted'));
                    setMicroJobId(null);
                    localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
                    localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
                    return;
                }
                setVisionResult(res.result as VisionAnalysisResult);

                // Success Flow
                setProgress(100);
                setStatusMessage(t('visionAnalysis.completedCreatingReport'));

                // Get current matchId before clearing
                const currentMatch = localStorage.getItem(MICRO_MATCH_STORAGE_KEY);

                // Slight delay before finalizing purely for UX (so user sees 100%)
                setTimeout(() => {
                    if (isMounted) {
                        setAsyncStatus('completed');
                        setMicroJobId(null);
                        localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
                        localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
                        // Save completed matchId for result restoration
                        if (currentMatch) {
                            localStorage.setItem(MICRO_COMPLETED_MATCH_KEY, currentMatch);
                        }
                    }
                }, 1000);

            } else if (res.status === 'failed') {
                logger.error("[GlobalProvider] Job Failed", res.error);
                setAsyncStatus('failed');
                setErrorMsg(t(`serverErrors.${res.error}`, res.error) || t('visionAnalysis.analysisFailed'));
                setProgress(0);
                setMicroJobId(null);
                localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
                localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);

            } else if (res.status === 'processing') {
                 // Simulate Progress (50% -> 90%)
                 setProgress(prev => Math.min(prev + 5, 90));
                 setStatusMessage(t('visionAnalysis.aiAnalyzingServer'));
            }
        };

        // Poll every 3s
        intervalId = setInterval(checkMicroStatus, 3000);
        return () => {
             isMounted = false;
             clearInterval(intervalId);
        };
    }, [microJobId]);

    // --- Actions ---

    const clearError = useCallback(() => setErrorMsg(null), []);

    const resetAnalysis = useCallback((keepDebugFrames: boolean = false) => {
        setAsyncStatus('idle');
        setVisionResult(null);
        setProgress(0);
        setStatusMessage("");
        if (!keepDebugFrames) {
            setDebugFrames([]);
        }
        setErrorMsg(null);
        setMicroJobId(null);
        setMatchId(null);
        setIsVerifying(false);
        localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
        localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
        localStorage.removeItem(MICRO_COMPLETED_MATCH_KEY);
    }, []);

    // Restore result for a specific match (called by component when match changes)
    // Note: This function intentionally has no dependencies to maintain stable reference
    const restoreResultForMatch = useCallback(async (targetMatchId: string): Promise<boolean> => {
        try {
            const { found, result: savedResult } = await getLatestMicroAnalysisForMatch(targetMatchId);
            if (found && savedResult) {
                setVisionResult(savedResult as VisionAnalysisResult);
                setMatchId(targetMatchId);
                setAsyncStatus('completed');
                setProgress(100);
                localStorage.setItem(MICRO_COMPLETED_MATCH_KEY, targetMatchId);
                return true;
            }
        } catch (e) {
            logger.error("[GlobalProvider] Failed to restore MICRO result:", e);
        }
        return false;
    }, []); // Empty deps for stable reference - state checks moved to effect level

    // --- Reuseable Verification Logic ---
    const verifyVideo = useCallback(async (file: File, match: MatchSummary, puuid: string, onProgress?: (msg: string) => void) => {
        if (!file || !match) return;

        const updateMsg = (msg: string) => {
            setStatusMessage(msg);
            if (onProgress) onProgress(msg);
        };

        try {
            updateMsg(t('visionAnalysis.verifyingVideo'));

            // 1. Get Match Context
            const matchRes = await fetchMatchDetail(match.matchId);
            if (!matchRes.success || !matchRes.data) throw new Error(t('visionAnalysis.matchDataFetchFailed'));
            const matchInfo = matchRes.data.info;

            const me = matchInfo.participants.find((p) => p.puuid === puuid);
            if (!me) throw new Error(t('visionAnalysis.playerNotFound'));
            const myTeamId = me.teamId;

            const context = {
                myChampion: me.championName,
                allies: matchInfo.participants.filter((p) => p.teamId === myTeamId).map((p) => p.championName),
                enemies: matchInfo.participants.filter((p) => p.teamId !== myTeamId).map((p) => p.championName),
            };

            // 2. Extract Frames (FAST)
            updateMsg(t('visionAnalysis.extractingVerificationFrames'));
            const processor = new VideoProcessor();
            // Extract 3 frames from random points (e.g. 10%, 50%, 80%) to be robust
            // For now, simpler: just use start (0s) or existing method
            // Let's use getFrames around a few seconds
            const frames = await processor.extractVerificationFrames(file); // Use specific method
            
            setDebugFrames(frames.map((f, i) => ({
                url: `data:image/jpeg;base64,${f}`, // Fix: Prepend data prefix
                info: `Verify Frame ${i+1}`
            })));
            
            // 3. Verify
            updateMsg(t('visionAnalysis.aiVerifying'));
            const vResult = await verifyMatchVideo(frames, context);

            if (!vResult.success || !vResult.data) {
                throw new Error(t('visionAnalysis.verificationServerError').replace('{error}', vResult.error || t('visionAnalysis.unknownError')));
            }
            if (!vResult.data.isValid) {
                 const reasonCode = vResult.data.reason || '';
                 const reasonMap: Record<string, string> = {
                     'CHAMPION_MISMATCH': t('visionAnalysis.championMismatch'),
                     'TEAM_MISMATCH': t('visionAnalysis.teamMismatch'),
                 };
                 const reason = reasonMap[reasonCode] || t('visionAnalysis.videoMismatch');
                 throw new Error(`MATCH_INTEGRITY_ERROR: ${reason}`);
            }

        } catch (e) {
            logger.error(e);
            throw e;
        }
    }, [t]);

    // Main Entry Point
    const startAnalysis = useCallback(async (file: File, match: MatchSummary, puuid: string, question: string, startTime: number = 0) => {
        // Reset previous state, but keep debug frames (from verifyVideo)
        resetAnalysis(true);
        setAsyncStatus('processing');
        setProgress(0);
        setStatusMessage(t('visionAnalysis.preparing'));

        try {
            // --- Step 1: Verification ---
            // "Integrity Check"
            setIsVerifying(true);
            setStatusMessage(t('visionAnalysis.verifyingVideoMatch'));
            
            // 1-A. Context
            let matchDetail: Awaited<ReturnType<typeof fetchMatchDetail>> | null = null;
            try {
                matchDetail = await fetchMatchDetail(match.matchId);
            } catch (fetchError) {
                const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
                logger.error("[GlobalProvider] FETCH ERROR:", msg);
                throw new Error(`[FETCH] ${msg}`);
            }
            if (!matchDetail.success || !matchDetail.data) {
                logger.error("[GlobalProvider] matchDetail failed:", matchDetail.error);
                throw new Error(t('visionAnalysis.cannotSkipVerification') + ` (${matchDetail.error || 'unknown'})`);
            }
            const parts = matchDetail.data.info.participants;
            const me = parts.find((p) => p.puuid === puuid);
            const myTeamId = me ? me.teamId : 0;
            const context = {
                myChampion: match.championName, 
                allies: parts.filter((p) => p.teamId === myTeamId).map((p) => p.championName),
                enemies: parts.filter((p) => p.teamId !== myTeamId).map((p) => p.championName)
            };

            // 1-B. Extract Verification Frames
            const processor = new VideoProcessor();
            const vFrames = await processor.extractVerificationFrames(file); // Fast extraction

            // [DEBUG] Expose frames (Internal Check)
            setDebugFrames(vFrames.map((f, i) => ({
                url: `data:image/jpeg;base64,${f}`, // Fix: Prepend data prefix
                info: `Internal Verify ${i+1}`
            })));

            // 1-C. Server Check
            let vResult: Awaited<ReturnType<typeof verifyMatchVideo>> | null = null;
            try {
                vResult = await verifyMatchVideo(vFrames, context);
            } catch (verifyError) {
                const msg = verifyError instanceof Error ? verifyError.message : String(verifyError);
                logger.error("[GlobalProvider] VERIFY ERROR (verifyMatchVideo):", msg);
                throw new Error(`[VERIFY] ${msg}`);
            }

            if (!vResult.success || !vResult.data) {
                throw new Error(t('visionAnalysis.verificationServerError').replace('{error}', vResult.error || t('visionAnalysis.unknownError')));
            }
            if (!vResult.data.isValid) {
                 const reasonCode = vResult.data.reason || '';
                 const reasonMap: Record<string, string> = {
                     'CHAMPION_MISMATCH': t('visionAnalysis.championMismatch'),
                     'TEAM_MISMATCH': t('visionAnalysis.teamMismatch'),
                 };
                 const reason = reasonMap[reasonCode] || t('visionAnalysis.videoMismatch');
                 throw new Error(`MATCH_INTEGRITY_ERROR: ${reason}`);
            }
            setIsVerifying(false);

            // --- Step 2: Frame Extraction ---
            setStatusMessage(startTime > 0 ? t('visionAnalysis.extractingFromPosition').replace('{startTime}', String(Math.floor(startTime))) : t('visionAnalysis.extractingFromVideo'));

            // Extract 1fps, max 30 frames (30s), 1280px
            const frames = await processor.extractFrames(file, 1.0, 30, 1280, startTime, (pct) => {
                setProgress(pct * 0.5); // 0-50%
            });

            if (frames.length === 0) throw new Error(t('visionAnalysis.frameExtractionFailed'));

            // Debug Info
            setDebugFrames(frames.slice(0, 4).map(f => ({
                url: f.dataUrl,
                info: `${f.width}x${f.height}`
            })));

            setStatusMessage(t('visionAnalysis.aiAnalyzingFrames').replace('{frameCount}', String(frames.length)));

            // --- Step 3: Start Server Job ---
            // Calculate total frame size for debugging
            const frameDataUrls = frames.map(f => f.dataUrl);
            const totalFrameSize = frameDataUrls.reduce((sum, url) => sum + url.length, 0);

            // Detailed frame size breakdown

            // Build the request object
            const analysisRequest = {
                frames: frameDataUrls,
                question: question,
                description: "",
                matchId: match.matchId,
                puuid: puuid,
                language: language as 'ja' | 'en' | 'ko'
            };

            // Measure full serialized payload size
            let serializedPayload: string;
            try {
                serializedPayload = JSON.stringify(analysisRequest);
            } catch (serializeError) {
                const msg = serializeError instanceof Error ? serializeError.message : String(serializeError);
                logger.error("[GlobalProvider] Failed to serialize request:", msg);
                throw new Error(`[SERIALIZE] ${msg}`);
            }

            // Verify serialization round-trip works
            try {
                JSON.parse(serializedPayload);
            } catch (parseError) {
                const msg = parseError instanceof Error ? parseError.message : String(parseError);
                logger.error("[GlobalProvider] Serialization round-trip FAILED:", msg);
                logger.error("[GlobalProvider] Payload preview (first 500 chars):", serializedPayload.substring(0, 500));
                logger.error("[GlobalProvider] Payload preview (last 500 chars):", serializedPayload.substring(serializedPayload.length - 500));
                throw new Error(`[ROUNDTRIP] ${msg}`);
            }

            let result: Awaited<ReturnType<typeof startVisionAnalysis>> | null = null;
            try {
                result = await startVisionAnalysis(analysisRequest);
            } catch (startError) {
                const msg = startError instanceof Error ? startError.message : String(startError);
                logger.error("[GlobalProvider] START ERROR (startVisionAnalysis):", msg);
                logger.error("[GlobalProvider] Full error:", startError);
                logger.error("[GlobalProvider] Payload size was:", Math.round(serializedPayload.length / 1024), "KB");
                throw new Error(`[START] ${msg}`);
            }

            if (!result.success || !result.jobId) {
                throw new Error(result.error || t('visionAnalysis.jobStartFailed'));
            }

            // --- Step 4: Handover to Polling ---
            setMicroJobId(result.jobId);
            setMatchId(match.matchId);
            localStorage.setItem(MICRO_JOB_STORAGE_KEY, result.jobId);
            localStorage.setItem(MICRO_MATCH_STORAGE_KEY, match.matchId);

            // Polling effect will take over from here...

        } catch (e) {
            logger.error(e);
            setAsyncStatus('failed');
            setIsVerifying(false);
            setErrorMsg(e instanceof Error ? e.message : t('visionAnalysis.unexpectedError'));
            setStatusMessage(t('visionAnalysis.error'));
        }
    }, [t, language, resetAnalysis]);


    const contextValue = useMemo<VisionAnalysisContextType>(() => ({
        isVisionAnalyzing: isAnalyzing,
        isVerifying,
        asyncStatus,
        visionProgress: progress,
        visionMsg: statusMessage,
        visionError: errorMsg,
        globalVisionResult: visionResult,
        debugFrames,
        currentMatchId: matchId,
        startGlobalAnalysis: startAnalysis,
        verifyVideo,
        resetAnalysis,
        clearError,
        setIsVerifying,
        restoreResultForMatch
    }), [isAnalyzing, isVerifying, asyncStatus, progress, statusMessage, errorMsg, visionResult, debugFrames, matchId, startAnalysis, verifyVideo, resetAnalysis, clearError, setIsVerifying, restoreResultForMatch]);

    return (
        <VisionAnalysisContext.Provider value={contextValue}>
            {children}
        </VisionAnalysisContext.Provider>
    );
}

export function useVisionAnalysis() {
    const context = useContext(VisionAnalysisContext);
    if (!context) {
        throw new Error("useVisionAnalysis must be used within a VisionAnalysisProvider");
    }
    return context;
}
