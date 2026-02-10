"use strict";
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
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
                console.log("[GlobalProvider] Restoring Micro Job:", savedJobId);
                setMicroJobId(savedJobId);
                setMatchId(savedMatchId);
                setAsyncStatus('processing');
                setStatusMessage(t('visionAnalysis.restoringBackground'));
                return;
            }

            // Case 2: There's a completed match - try to restore result from DB
            if (completedMatchId) {
                console.log("[GlobalProvider] Restoring completed result for match:", completedMatchId);
                try {
                    const { found, result: savedResult } = await getLatestMicroAnalysisForMatch(completedMatchId);
                    if (found && savedResult) {
                        console.log("[GlobalProvider] Restored completed result from DB");
                        setVisionResult(savedResult as VisionAnalysisResult);
                        setMatchId(completedMatchId);
                        setAsyncStatus('completed');
                        setProgress(100);
                    } else {
                        // Result not found, clear the storage
                        localStorage.removeItem(MICRO_COMPLETED_MATCH_KEY);
                    }
                } catch (e) {
                    console.error("[GlobalProvider] Failed to restore result:", e);
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
            console.log("[GlobalProvider] Polling job status:", microJobId);

            let res: any;
            try {
                res = await getAnalysisJobStatus(microJobId);
                console.log("[GlobalProvider] Poll result status:", res.status);
            } catch (pollError: any) {
                console.error("[GlobalProvider] POLL ERROR (getAnalysisJobStatus):", pollError.message);
                console.error("[GlobalProvider] Error stack:", pollError.stack);
                // Show error to user with location info
                setAsyncStatus('failed');
                setErrorMsg(`[POLL] ${pollError.message}`);
                setMicroJobId(null);
                localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
                localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
                return;
            }

            if (!isMounted) return;

            if (res.status === 'completed' && res.result) {
                console.log("[GlobalProvider] Job Completed, result keys:", Object.keys(res.result));
                // Check for corrupted result
                if (res.result.error && res.result.error.includes('corrupted')) {
                    console.error("[GlobalProvider] Result was corrupted");
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
                console.error("[GlobalProvider] Job Failed", res.error);
                setAsyncStatus('failed');
                setErrorMsg(res.error || t('visionAnalysis.analysisFailed'));
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

    const clearError = () => setErrorMsg(null);
    
    const resetAnalysis = (keepDebugFrames: boolean = false) => {
        setAsyncStatus('idle');
        setVisionResult(null);
        setProgress(0);
        setStatusMessage("");
        if (!keepDebugFrames) {
            console.log("[GlobalProvider] Clearing Debug Frames");
            setDebugFrames([]);
        } else {
            console.log("[GlobalProvider] Keeping Debug Frames");
        }
        setErrorMsg(null);
        setMicroJobId(null);
        setMatchId(null);
        setIsVerifying(false);
        localStorage.removeItem(MICRO_JOB_STORAGE_KEY);
        localStorage.removeItem(MICRO_MATCH_STORAGE_KEY);
        localStorage.removeItem(MICRO_COMPLETED_MATCH_KEY);
    };

    // Restore result for a specific match (called by component when match changes)
    // Note: This function intentionally has no dependencies to maintain stable reference
    const restoreResultForMatch = useCallback(async (targetMatchId: string): Promise<boolean> => {
        console.log("[GlobalProvider] Trying to restore MICRO result for match:", targetMatchId);
        try {
            const { found, result: savedResult } = await getLatestMicroAnalysisForMatch(targetMatchId);
            if (found && savedResult) {
                console.log("[GlobalProvider] Found and restored MICRO result from DB");
                setVisionResult(savedResult as VisionAnalysisResult);
                setMatchId(targetMatchId);
                setAsyncStatus('completed');
                setProgress(100);
                localStorage.setItem(MICRO_COMPLETED_MATCH_KEY, targetMatchId);
                return true;
            }
        } catch (e) {
            console.error("[GlobalProvider] Failed to restore MICRO result:", e);
        }
        return false;
    }, []); // Empty deps for stable reference - state checks moved to effect level

    // --- Reuseable Verification Logic ---
    const verifyVideo = useCallback(async (file: File, match: MatchSummary, puuid: string, onProgress?: (msg: string) => void) => {
        if (!file || !match) return;

        console.log("[GlobalProvider] Starting Verification:", file.name);
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

            const me = matchInfo.participants.find((p: any) => p.puuid === puuid);
            if (!me) throw new Error(t('visionAnalysis.playerNotFound'));
            const myTeamId = me.teamId;

            const context = {
                myChampion: me.championName,
                allies: matchInfo.participants.filter((p: any) => p.teamId === myTeamId).map((p: any) => p.championName),
                enemies: matchInfo.participants.filter((p: any) => p.teamId !== myTeamId).map((p: any) => p.championName),
            };

            // 2. Extract Frames (FAST)
            updateMsg(t('visionAnalysis.extractingVerificationFrames'));
            const processor = new VideoProcessor();
            // Extract 3 frames from random points (e.g. 10%, 50%, 80%) to be robust
            // For now, simpler: just use start (0s) or existing method
            // Let's use getFrames around a few seconds
            const frames = await processor.extractVerificationFrames(file); // Use specific method
            
            // [DEBUG] Expose frames to UI
            console.log(`[GlobalProvider] Setting Debug Frames. Count: ${frames.length}`);
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

            console.log("[GlobalProvider] Verification Passed!", vResult);

        } catch (e: any) {
            console.error(e);
            throw e;
        }
    }, [t]);

    // Main Entry Point
    const startAnalysis = async (file: File, match: MatchSummary, puuid: string, question: string, startTime: number = 0) => {
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
            console.log("[GlobalProvider] Calling fetchMatchDetail for:", match.matchId);
            let matchDetail: any;
            try {
                matchDetail = await fetchMatchDetail(match.matchId);
                console.log("[GlobalProvider] fetchMatchDetail returned:", matchDetail.success);
            } catch (fetchError: any) {
                console.error("[GlobalProvider] FETCH ERROR (fetchMatchDetail):", fetchError.message);
                throw new Error(`[FETCH] ${fetchError.message}`);
            }
            if (!matchDetail.success || !matchDetail.data) {
                throw new Error(t('visionAnalysis.cannotSkipVerification'));
            }
            const parts = matchDetail.data.info.participants;
            const me = parts.find((p: any) => p.puuid === puuid);
            const myTeamId = me ? me.teamId : 0;
            const context = {
                myChampion: match.championName, 
                allies: parts.filter((p: any) => p.teamId === myTeamId).map((p: any) => p.championName),
                enemies: parts.filter((p: any) => p.teamId !== myTeamId).map((p: any) => p.championName)
            };

            // 1-B. Extract Verification Frames
            const processor = new VideoProcessor();
            const vFrames = await processor.extractVerificationFrames(file); // Fast extraction

            // [DEBUG] Expose frames (Internal Check)
            console.log(`[GlobalProvider] Setting Internal Frames. Count: ${vFrames.length}`);
            setDebugFrames(vFrames.map((f, i) => ({
                url: `data:image/jpeg;base64,${f}`, // Fix: Prepend data prefix
                info: `Internal Verify ${i+1}`
            })));

            // 1-C. Server Check
            console.log("[GlobalProvider] Calling verifyMatchVideo...");
            let vResult: any;
            try {
                vResult = await verifyMatchVideo(vFrames, context);
                console.log("[GlobalProvider] verifyMatchVideo returned:", vResult.success);
            } catch (verifyError: any) {
                console.error("[GlobalProvider] VERIFY ERROR (verifyMatchVideo):", verifyError.message);
                throw new Error(`[VERIFY] ${verifyError.message}`);
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
            console.log("[GlobalProvider] Frame size breakdown:");
            console.log("  - Frame count:", frames.length);
            console.log("  - Frame dimensions:", frames[0]?.width, "x", frames[0]?.height);
            console.log("  - Individual frame sizes (KB):", frameDataUrls.map(url => Math.round(url.length / 1024)));
            console.log("  - Total frame data size:", Math.round(totalFrameSize / 1024), "KB");
            console.log("  - Average frame size:", Math.round(totalFrameSize / frames.length / 1024), "KB");

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
            } catch (serializeError: any) {
                console.error("[GlobalProvider] Failed to serialize request:", serializeError.message);
                throw new Error(`[SERIALIZE] ${serializeError.message}`);
            }

            console.log("[GlobalProvider] Request stats:", {
                frameCount: frames.length,
                frameSizeKB: Math.round(totalFrameSize / 1024),
                fullPayloadKB: Math.round(serializedPayload.length / 1024),
                matchId: match.matchId,
                startTime: startTime
            });

            // Verify serialization round-trip works
            try {
                JSON.parse(serializedPayload);
                console.log("[GlobalProvider] Serialization round-trip OK");
            } catch (parseError: any) {
                console.error("[GlobalProvider] Serialization round-trip FAILED:", parseError.message);
                console.error("[GlobalProvider] Payload preview (first 500 chars):", serializedPayload.substring(0, 500));
                console.error("[GlobalProvider] Payload preview (last 500 chars):", serializedPayload.substring(serializedPayload.length - 500));
                throw new Error(`[ROUNDTRIP] ${parseError.message}`);
            }

            console.log("[GlobalProvider] Calling startVisionAnalysis...");
            let result: any;
            try {
                result = await startVisionAnalysis(analysisRequest);
                console.log("[GlobalProvider] startVisionAnalysis returned:", result.success, result.jobId);
            } catch (startError: any) {
                console.error("[GlobalProvider] START ERROR (startVisionAnalysis):", startError.message);
                console.error("[GlobalProvider] Full error:", startError);
                console.error("[GlobalProvider] Payload size was:", Math.round(serializedPayload.length / 1024), "KB");
                throw new Error(`[START] ${startError.message}`);
            }

            if (!result.success || !result.jobId) {
                throw new Error(result.error || t('visionAnalysis.jobStartFailed'));
            }

            // --- Step 4: Handover to Polling ---
            console.log("[GlobalProvider] Job Started:", result.jobId);
            setMicroJobId(result.jobId);
            setMatchId(match.matchId);
            localStorage.setItem(MICRO_JOB_STORAGE_KEY, result.jobId);
            localStorage.setItem(MICRO_MATCH_STORAGE_KEY, match.matchId);

            // Polling effect will take over from here...

        } catch (e: any) {
            console.error(e);
            setAsyncStatus('failed');
            setIsVerifying(false);
            setErrorMsg(e.message || t('visionAnalysis.unexpectedError'));
            setStatusMessage(t('visionAnalysis.error'));
        }
    };


    return (
        <VisionAnalysisContext.Provider value={{
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
        }}>
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
