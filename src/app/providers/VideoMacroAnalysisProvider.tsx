"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
    startVideoMacroAnalysis,
    getVideoMacroJobStatus,
    getLatestMacroAnalysisForMatch,
    type VideoMacroAnalysisRequest,
    type VideoMacroAnalysisResult
} from "@/app/actions/videoMacroAnalysis";
import { useTranslation } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";

// --- Types ---
interface VideoMacroAnalysisContextType {
    // State
    isAnalyzing: boolean;
    asyncStatus: 'idle' | 'processing' | 'completed' | 'failed';
    progress: number;
    statusMessage: string;
    error: string | null;
    result: VideoMacroAnalysisResult | null;
    currentJobId: string | null;
    currentMatchId: string | null;

    // Actions
    startAnalysis: (request: VideoMacroAnalysisRequest, userApiKey?: string) => Promise<{ success: boolean; error?: string }>;
    resetAnalysis: () => void;
    clearError: () => void;
    restoreResultForMatch: (matchId: string) => Promise<boolean>;
}

const VideoMacroAnalysisContext = createContext<VideoMacroAnalysisContextType | undefined>(undefined);

const STORAGE_KEY = 'macroJobId';
const MATCH_STORAGE_KEY = 'macroJobMatchId';
const COMPLETED_MATCH_KEY = 'macroCompletedMatchId';

export function VideoMacroAnalysisProvider({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();

    // --- State ---
    const [jobId, setJobId] = useState<string | null>(null);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [asyncStatus, setAsyncStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<VideoMacroAnalysisResult | null>(null);

    const isAnalyzing = asyncStatus === 'processing';

    // --- Persistence & Restoration ---
    useEffect(() => {
        const restoreState = async () => {
            if (typeof window === 'undefined') return;

            const savedJobId = localStorage.getItem(STORAGE_KEY);
            const savedMatchId = localStorage.getItem(MATCH_STORAGE_KEY);
            const completedMatchId = localStorage.getItem(COMPLETED_MATCH_KEY);

            // Case 1: There's a job in progress - restore and poll
            if (savedJobId) {
                setJobId(savedJobId);
                setMatchId(savedMatchId);
                setAsyncStatus('processing');
                setStatusMessage(t('videoMacroProvider.restoringBackground'));
                setProgress(50);
                return;
            }

            // Case 2: There's a completed match - try to restore result from DB
            if (completedMatchId) {
                try {
                    const { found, result: savedResult } = await getLatestMacroAnalysisForMatch(completedMatchId);
                    if (found && savedResult) {
                        setResult(savedResult);
                        setMatchId(completedMatchId);
                        setAsyncStatus('completed');
                        setProgress(100);
                    } else {
                        // Result not found, clear the storage
                        localStorage.removeItem(COMPLETED_MATCH_KEY);
                    }
                } catch (e) {
                    logger.error("[MacroProvider] Failed to restore result:", e);
                    localStorage.removeItem(COMPLETED_MATCH_KEY);
                }
            }
        };

        restoreState();
    }, []);

    // --- Polling Logic ---
    useEffect(() => {
        if (!jobId) return;

        let intervalId: NodeJS.Timeout;
        let isMounted = true;

        const checkStatus = async () => {
            if (!jobId) return;

            try {
                const res = await getVideoMacroJobStatus(jobId);

                if (!isMounted) return;

                if (res.status === 'completed' && res.result) {
                    setResult(res.result);
                    setProgress(100);
                    setStatusMessage(t("analyzePage.progress.analysisComplete"));

                    // Get current matchId before clearing
                    const currentMatch = localStorage.getItem(MATCH_STORAGE_KEY);

                    setTimeout(() => {
                        if (isMounted) {
                            setAsyncStatus('completed');
                            setJobId(null);
                            localStorage.removeItem(STORAGE_KEY);
                            localStorage.removeItem(MATCH_STORAGE_KEY);
                            // Save completed matchId for result restoration
                            if (currentMatch) {
                                localStorage.setItem(COMPLETED_MATCH_KEY, currentMatch);
                            }
                        }
                    }, 1000);

                } else if (res.status === 'failed') {
                    logger.error("[MacroProvider] Job failed:", res.error);
                    setAsyncStatus('failed');
                    setError(t(`serverErrors.${res.error}`, res.error) || t('videoMacroProvider.analysisFailed'));
                    setProgress(0);
                    setJobId(null);
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(MATCH_STORAGE_KEY);

                } else if (res.status === 'processing') {
                    // Simulate progress (50% -> 95%)
                    setProgress(prev => Math.min(prev + 3, 95));
                    setStatusMessage(t('videoMacroProvider.aiAnalyzingServer'));
                }
            } catch (pollError) {
                logger.error("[MacroProvider] Poll error:", pollError);
                if (isMounted) {
                    setAsyncStatus('failed');
                    setError(`${t('videoMacroProvider.pollingError')}: ${pollError instanceof Error ? pollError.message : String(pollError)}`);
                    setJobId(null);
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(MATCH_STORAGE_KEY);
                }
            }
        };

        // Initial check
        checkStatus();

        // Poll every 3 seconds
        intervalId = setInterval(checkStatus, 3000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [jobId]);

    // --- Actions ---

    const clearError = useCallback(() => setError(null), []);

    const resetAnalysis = useCallback(() => {
        setAsyncStatus('idle');
        setResult(null);
        setProgress(0);
        setStatusMessage("");
        setError(null);
        setJobId(null);
        setMatchId(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(MATCH_STORAGE_KEY);
        localStorage.removeItem(COMPLETED_MATCH_KEY);
    }, []);

    // Restore result for a specific match (called by component when match changes)
    // Note: This function intentionally has no dependencies to maintain stable reference
    const restoreResultForMatch = useCallback(async (targetMatchId: string): Promise<boolean> => {
        try {
            const { found, result: savedResult } = await getLatestMacroAnalysisForMatch(targetMatchId);
            if (found && savedResult) {
                setResult(savedResult);
                setMatchId(targetMatchId);
                setAsyncStatus('completed');
                setProgress(100);
                localStorage.setItem(COMPLETED_MATCH_KEY, targetMatchId);
                return true;
            }
        } catch (e) {
            logger.error("[MacroProvider] Failed to restore result:", e);
        }
        return false;
    }, []); // Empty deps for stable reference - state checks moved to effect level

    const startAnalysis = useCallback(async (
        request: VideoMacroAnalysisRequest,
        userApiKey?: string
    ): Promise<{ success: boolean; error?: string }> => {
        // Reset previous state
        setAsyncStatus('processing');
        setProgress(10);
        setStatusMessage(t('coachPage.macro.startingJob'));
        setError(null);
        setResult(null);
        setMatchId(request.matchId);

        try {
            const response = await startVideoMacroAnalysis(request, userApiKey);

            if (!response.success || !response.jobId) {
                setAsyncStatus('failed');
                setError(t(`serverErrors.${response.error}`, response.error) || t('videoMacroProvider.startFailed'));
                setProgress(0);
                return { success: false, error: response.error };
            }

            // Save job ID for persistence
            setJobId(response.jobId);
            localStorage.setItem(STORAGE_KEY, response.jobId);
            localStorage.setItem(MATCH_STORAGE_KEY, request.matchId);

            setProgress(30);
            setStatusMessage(t('videoMacroProvider.analyzingOnServer'));

            return { success: true };

        } catch (e) {
            logger.error("[MacroProvider] Start analysis error:", e);
            const msg = e instanceof Error ? e.message : String(e);
            setAsyncStatus('failed');
            setError(msg);
            setProgress(0);
            return { success: false, error: msg };
        }
    }, []);

    // --- Context Value (memoized to prevent unnecessary re-renders) ---
    const contextValue = useMemo<VideoMacroAnalysisContextType>(() => ({
        isAnalyzing,
        asyncStatus,
        progress,
        statusMessage,
        error,
        result,
        currentJobId: jobId,
        currentMatchId: matchId,
        startAnalysis,
        resetAnalysis,
        clearError,
        restoreResultForMatch
    }), [isAnalyzing, asyncStatus, progress, statusMessage, error, result, jobId, matchId, startAnalysis, resetAnalysis, clearError, restoreResultForMatch]);

    return (
        <VideoMacroAnalysisContext.Provider value={contextValue}>
            {children}
        </VideoMacroAnalysisContext.Provider>
    );
}

export function useVideoMacroAnalysis() {
    const context = useContext(VideoMacroAnalysisContext);
    if (!context) {
        throw new Error("useVideoMacroAnalysis must be used within VideoMacroAnalysisProvider");
    }
    return context;
}
