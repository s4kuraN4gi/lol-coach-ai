"use client";

import React, { createContext, useContext, useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { MatchSummary } from "@/app/actions/coach";
import { getLatestActiveAnalysis } from "@/app/actions/analysis";

// localStorage keys
const DETAIL_TAB_KEY = 'coachDetailTab';
const SELECTED_MATCH_KEY = 'coachSelectedMatchId';

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

    // Analysis inputs (MICRO only)
    startTime: number;
    setStartTime: (time: number) => void;

    specificQuestion: string;
    setSpecificQuestion: (q: string) => void;

    errorMsg: string | null;
    setErrorMsg: (msg: string | null) => void;

    // Actions
    resetCoachUI: () => void;
    restoreFromLatest: (matches: MatchSummary[]) => Promise<void>;
}

const CoachUIContext = createContext<CoachUIContextType | undefined>(undefined);

export function CoachUIProvider({ children }: { children: React.ReactNode }) {
    const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
    const [detailTab, setDetailTabState] = useState<'MACRO' | 'MICRO'>('MACRO');
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [videoSourceType, setVideoSourceType] = useState<"YOUTUBE" | "LOCAL">("LOCAL");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [startTime, setStartTime] = useState(0);
    const [specificQuestion, setSpecificQuestion] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const autoResumeChecked = useRef(false);
    const initializedRef = useRef(false);

    // Wrapper to persist detailTab to localStorage
    const setDetailTab = useCallback((tab: 'MACRO' | 'MICRO') => {
        setDetailTabState(tab);
        if (typeof window !== 'undefined') {
            localStorage.setItem(DETAIL_TAB_KEY, tab);
        }
    }, []);

    // Initialize from localStorage and detect active analysis tab
    useEffect(() => {
        if (initializedRef.current || typeof window === 'undefined') return;
        initializedRef.current = true;

        // Check for active analysis jobs to determine which tab should be active
        const microJobId = localStorage.getItem('microJobId');
        const macroJobId = localStorage.getItem('macroJobId');

        if (microJobId) {
            // MICRO analysis in progress - switch to MICRO tab
            console.log("[CoachUI] Active MICRO job detected, switching to MICRO tab");
            setDetailTabState('MICRO');
            localStorage.setItem(DETAIL_TAB_KEY, 'MICRO');
        } else if (macroJobId) {
            // MACRO analysis in progress - switch to MACRO tab
            console.log("[CoachUI] Active MACRO job detected, switching to MACRO tab");
            setDetailTabState('MACRO');
            localStorage.setItem(DETAIL_TAB_KEY, 'MACRO');
        } else {
            // No active analysis - restore saved tab preference
            const savedTab = localStorage.getItem(DETAIL_TAB_KEY) as 'MACRO' | 'MICRO' | null;
            if (savedTab && (savedTab === 'MACRO' || savedTab === 'MICRO')) {
                console.log("[CoachUI] Restoring saved tab:", savedTab);
                setDetailTabState(savedTab);
            }
        }
    }, []);

    // Memoized URL for video preview to prevent reload on re-renders
    const videoPreviewUrl = useMemo(() => {
        if (localFile) {
            return URL.createObjectURL(localFile);
        }
        return undefined;
    }, [localFile]);

    const restoreFromLatest = async (matches: MatchSummary[]) => {
        if (autoResumeChecked.current) return;
        autoResumeChecked.current = true;

        try {
            const latest = await getLatestActiveAnalysis();
            if (latest && (latest.status === 'processing' || latest.status === 'completed')) {
                const found = matches.find(m => m.matchId === latest.matchId);
                if (found) {
                    setSelectedMatch(found);

                    // Restore tab based on analysis type
                    if (latest.analysis_type === 'micro') {
                        setDetailTab('MICRO');
                    } else if (latest.analysis_type === 'macro') {
                        setDetailTab('MACRO');
                    }

                    if (latest.inputs) {
                        const inp = latest.inputs as any;
                        if (inp.videoSourceType) setVideoSourceType(inp.videoSourceType);
                        if (inp.videoUrl) setYoutubeUrl(inp.videoUrl);
                        if (inp.specificQuestion) setSpecificQuestion(inp.specificQuestion);
                    }
                }
            }
        } catch (e) {
            console.error("Restore error:", e);
        }
    };

    const resetCoachUI = () => {
        setSelectedMatch(null);
        setLocalFile(null);
        setYoutubeUrl("");
        setStartTime(0);
        setSpecificQuestion("");
        setDetailTab('MACRO');
        setVideoSourceType("LOCAL");
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
