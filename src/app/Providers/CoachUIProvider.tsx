"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import type { MatchSummary, AnalysisResult } from "@/app/actions/coach";
import { getVideoAnalysisStatus, getLatestActiveAnalysis } from "@/app/actions/analysis";
import { AnalysisMode } from "@/app/actions/promptUtils";

interface CoachUIContextType {
    // Selection state
    selectedMatch: MatchSummary | null;
    setSelectedMatch: (match: MatchSummary | null) => void;
    
    // Tab state
    detailTab: 'MACRO' | 'MICRO';
    setDetailTab: (tab: 'MACRO' | 'MICRO') => void;
    
    // Video state
    localFile: File | null;
    setLocalFile: (file: File | null) => void;
    videoPreviewUrl: string | undefined;
    
    videoSourceType: "YOUTUBE" | "LOCAL";
    setVideoSourceType: (type: "YOUTUBE" | "LOCAL") => void;
    
    youtubeUrl: string;
    setYoutubeUrl: (url: string) => void;
    
    // Analysis inputs
    startTime: number;
    setStartTime: (time: number) => void;
    
    specificQuestion: string;
    setSpecificQuestion: (q: string) => void;
    
    analysisMode: AnalysisMode;
    setAnalysisMode: (mode: AnalysisMode) => void;

    focusTime: string;
    setFocusTime: (time: string) => void;
    
    // Results & Status
    analysisData: AnalysisResult | null;
    setAnalysisData: (data: AnalysisResult | null) => void;
    
    asyncStatus: 'idle' | 'processing' | 'completed' | 'failed';
    setAsyncStatus: (status: 'idle' | 'processing' | 'completed' | 'failed') => void;
    
    progress: number;
    setProgress: React.Dispatch<React.SetStateAction<number>>;

    errorMsg: string | null;
    setErrorMsg: (msg: string | null) => void;

    // Actions
    resetCoachUI: () => void;
    restoreFromLatest: (matches: MatchSummary[]) => Promise<void>;
}

const CoachUIContext = createContext<CoachUIContextType | undefined>(undefined);

export function CoachUIProvider({ children }: { children: React.ReactNode }) {
    const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
    const [detailTab, setDetailTab] = useState<'MACRO' | 'MICRO'>('MACRO');
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [videoSourceType, setVideoSourceType] = useState<"YOUTUBE" | "LOCAL">("LOCAL");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [startTime, setStartTime] = useState(0);
    const [specificQuestion, setSpecificQuestion] = useState("");
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("MACRO");
    const [focusTime, setFocusTime] = useState("");
    
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
    const [asyncStatus, setAsyncStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const autoResumeChecked = useRef(false);

    // Memoized URL for video preview to prevent reload on re-renders
    const videoPreviewUrl = useMemo(() => {
        if (localFile) {
            return URL.createObjectURL(localFile);
        }
        return undefined;
    }, [localFile]);

    // Polling logic for Macro Analysis (Background persistence)
    useEffect(() => {
        if (!selectedMatch || asyncStatus !== 'processing') return;

        let intervalId: NodeJS.Timeout;
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const res = await getVideoAnalysisStatus(selectedMatch.matchId);
                if (!isMounted) return;

                if (res.status === 'completed' && res.result) {
                    setAnalysisData(res.result as AnalysisResult);
                    setAsyncStatus('completed');
                    setProgress(100);
                } else if (res.status === 'failed') {
                    setAsyncStatus('failed');
                    setErrorMsg(res.error || "Analysis failed");
                    setProgress(0);
                }
            } catch (error) {
                console.error("Polling error in CoachUIProvider:", error);
            }
        };

        checkStatus();
        intervalId = setInterval(checkStatus, 3000);
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [selectedMatch?.matchId, asyncStatus]);

    // Smooth Progress Simulation
    useEffect(() => {
        if (asyncStatus !== 'processing') return;
        
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return 95; 
                
                let increment = 0;
                if (prev < 30) increment = 2;
                else if (prev < 60) increment = 0.5;
                else if (prev < 85) increment = 0.2;
                else increment = 0.05;
                
                return Math.min(prev + increment, 95);
            });
        }, 200);
        
        return () => clearInterval(interval);
    }, [asyncStatus]);

    const restoreFromLatest = async (matches: MatchSummary[]) => {
        if (autoResumeChecked.current) return;
        autoResumeChecked.current = true;

        try {
            const latest = await getLatestActiveAnalysis();
            if (latest && (latest.status === 'processing' || latest.status === 'completed')) {
                const found = matches.find(m => m.matchId === latest.matchId);
                if (found) {
                    setSelectedMatch(found);
                    if (latest.inputs) {
                        const inp = latest.inputs as any;
                        if (inp.videoSourceType) setVideoSourceType(inp.videoSourceType);
                        if (inp.videoUrl) setYoutubeUrl(inp.videoUrl);
                        if (inp.focusTime) setFocusTime(inp.focusTime);
                        if (inp.specificQuestion) setSpecificQuestion(inp.specificQuestion);
                        if (inp.mode) setAnalysisMode(inp.mode);
                    }

                    if (latest.status === 'completed' && latest.result) {
                        setAnalysisData(latest.result as AnalysisResult);
                        setAsyncStatus('completed');
                        setProgress(100);
                    } else {
                        setAsyncStatus('processing');
                    }
                }
            }
        } catch (e) {
            console.error("Restore error:", e);
        }
    };

    const resetCoachUI = () => {
        setSelectedMatch(null);
        setAnalysisData(null);
        setAsyncStatus('idle');
        setLocalFile(null);
        setYoutubeUrl("");
        setStartTime(0);
        setSpecificQuestion("");
        setFocusTime("");
        setDetailTab('MACRO');
        setVideoSourceType("LOCAL");
        setProgress(0);
        setErrorMsg(null);
    };

    return (
        <CoachUIContext.Provider value={{
            selectedMatch, setSelectedMatch,
            detailTab, setDetailTab,
            localFile, setLocalFile,
            videoPreviewUrl,
            videoSourceType, setVideoSourceType,
            youtubeUrl, setYoutubeUrl,
            startTime, setStartTime,
            specificQuestion, setSpecificQuestion,
            analysisMode, setAnalysisMode,
            focusTime, setFocusTime,
            analysisData, setAnalysisData,
            asyncStatus, setAsyncStatus,
            progress, setProgress,
            errorMsg, setErrorMsg,
            resetCoachUI,
            restoreFromLatest
        }}>
            {children}
        </CoachUIContext.Provider>
    );
}

export function useCoachUI() {
    const context = useContext(CoachUIContext);
    if (!context) {
        throw new Error("useCoachUI must be used within a CoachUIProvider");
    }
    return context;
}
