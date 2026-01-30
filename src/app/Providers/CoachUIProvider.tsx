"use client";

import React, { createContext, useContext, useState, useMemo, useRef } from "react";
import type { MatchSummary } from "@/app/actions/coach";
import { getLatestActiveAnalysis } from "@/app/actions/analysis";

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
    const [detailTab, setDetailTab] = useState<'MACRO' | 'MICRO'>('MACRO');
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [videoSourceType, setVideoSourceType] = useState<"YOUTUBE" | "LOCAL">("LOCAL");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [startTime, setStartTime] = useState(0);
    const [specificQuestion, setSpecificQuestion] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const autoResumeChecked = useRef(false);

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
