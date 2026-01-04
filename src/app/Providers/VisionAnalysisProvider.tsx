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
import { getAnalysisJobStatus } from "@/app/actions/analysis";
import { fetchMatchDetail } from "@/app/actions/riot";
import type { MatchSummary } from "@/app/actions/coach";

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
    
    // Actions
    startGlobalAnalysis: (file: File, match: MatchSummary, puuid: string, question: string, startTime?: number) => Promise<void>;
    verifyVideo: (file: File, match: MatchSummary, puuid: string, onProgress?: (msg: string) => void) => Promise<void>;
    resetAnalysis: (keepDebugFrames?: boolean) => void;
    clearError: () => void;
    setIsVerifying: (v: boolean) => void;
}

const VisionAnalysisContext = createContext<VisionAnalysisContextType | undefined>(undefined);

export function VisionAnalysisProvider({ children }: { children: React.ReactNode }) {
    // --- State ---
    const [microJobId, setMicroJobId] = useState<string | null>(null);
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
        if (typeof window !== 'undefined') {
            const savedJobId = localStorage.getItem('microJobId');
            if (savedJobId) {
                console.log("[GlobalProvider] Restoring Micro Job:", savedJobId);
                setMicroJobId(savedJobId);
                setAsyncStatus('processing');
                setStatusMessage("バックグラウンド解析を復元中...");
            }
        }
    }, []);

    // --- Polling Logic ---
    useEffect(() => {
        if (!microJobId) return;

        let intervalId: NodeJS.Timeout;
        let isMounted = true;

        const checkMicroStatus = async () => {
            if (!microJobId) return;
            const res = await getAnalysisJobStatus(microJobId);
            
            if (!isMounted) return;

            if (res.status === 'completed' && res.result) {
                console.log("[GlobalProvider] Job Completed");
                setVisionResult(res.result as VisionAnalysisResult);
                
                // Success Flow
                setProgress(100);
                setStatusMessage("完了！レポート作成中...");
                
                // Slight delay before finalizing purely for UX (so user sees 100%)
                setTimeout(() => {
                    if (isMounted) {
                        setAsyncStatus('completed');
                        setMicroJobId(null);
                        localStorage.removeItem('microJobId');
                    }
                }, 1000);

            } else if (res.status === 'failed') {
                console.error("[GlobalProvider] Job Failed", res.error);
                setAsyncStatus('failed');
                setErrorMsg(res.error || "解析に失敗しました。");
                setProgress(0);
                setMicroJobId(null);
                localStorage.removeItem('microJobId');

            } else if (res.status === 'processing') {
                 // Simulate Progress (50% -> 90%)
                 setProgress(prev => Math.min(prev + 5, 90));
                 setStatusMessage("AI解析中... (サーバー処理中)");
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
        setIsVerifying(false);
        localStorage.removeItem('microJobId');
    };

    // --- Reuseable Verification Logic ---
    const verifyVideo = useCallback(async (file: File, match: MatchSummary, puuid: string, onProgress?: (msg: string) => void) => {
        if (!file || !match) return;

        console.log("[GlobalProvider] Starting Verification:", file.name);
        const updateMsg = (msg: string) => {
            setStatusMessage(msg);
            if (onProgress) onProgress(msg);
        };

        try {
            updateMsg("動画の整合性を確認中...");

            // 1. Get Match Context
            const matchRes = await fetchMatchDetail(match.matchId);
            if (!matchRes.success || !matchRes.data) throw new Error("試合データの取得に失敗しました");
            const matchInfo = matchRes.data.info;

            const me = matchInfo.participants.find((p: any) => p.puuid === puuid);
            if (!me) throw new Error("指定されたPUUIDのプレイヤーが見つかりません");
            const myTeamId = me.teamId;

            const context = {
                myChampion: me.championName,
                allies: matchInfo.participants.filter((p: any) => p.teamId === myTeamId).map((p: any) => p.championName),
                enemies: matchInfo.participants.filter((p: any) => p.teamId !== myTeamId).map((p: any) => p.championName),
            };

            // 2. Extract Frames (FAST)
            updateMsg("照合用フレームを抽出中...");
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
            updateMsg("AI照合実行中...");
            const vResult = await verifyMatchVideo(frames, context);

            if (!vResult.success || !vResult.data) {
                throw new Error(`検証サーバーエラー: ${vResult.error || "不明"}`);
            }
            if (!vResult.data.isValid) {
                 const reason = vResult.data.reason || "選択した試合とは異なる動画が選択されています。";
                 throw new Error(`MATCH_INTEGRITY_ERROR: ${reason}`);
            }
            
            console.log("[GlobalProvider] Verification Passed!", vResult);

        } catch (e: any) {
            console.error(e);
            throw e; 
        }
    }, []);

    // Main Entry Point
    const startAnalysis = async (file: File, match: MatchSummary, puuid: string, question: string, startTime: number = 0) => {
        // Reset previous state, but keep debug frames (from verifyVideo)
        resetAnalysis(true);
        setAsyncStatus('processing');
        setProgress(0);
        setStatusMessage("準備中...");

        try {
            // --- Step 1: Verification ---
            // "Integrity Check"
            setIsVerifying(true);
            setStatusMessage("動画と試合データの照合中...");
            
            // 1-A. Context
            const matchDetail = await fetchMatchDetail(match.matchId);
            if (!matchDetail.success || !matchDetail.data) {
                throw new Error("試合情報の取得に失敗したため、検証をスキップできません。");
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
            const vResult = await verifyMatchVideo(vFrames, context);
            
            if (!vResult.success || !vResult.data) {
                throw new Error(`検証サーバーエラー: ${vResult.error || "不明"}`);
            }
            if (!vResult.data.isValid) {
                 const reason = vResult.data.reason || "選択した試合とは異なる動画が選択されています。";
                 throw new Error(`MATCH_INTEGRITY_ERROR: ${reason}`);
            }
            setIsVerifying(false);

            // --- Step 2: Frame Extraction ---
            setStatusMessage(startTime > 0 ? `指定位置(${Math.floor(startTime)}s)からフレームを抽出中...` : "動画からフレームを抽出中...");
            
            // Extract 1fps, max 30 frames (30s), 1280px (to reduce payload)
            // Added startTime argument
            const frames = await processor.extractFrames(file, 1.0, 30, 1280, startTime, (pct) => {
                setProgress(pct * 0.5); // 0-50%
            });

            if (frames.length === 0) throw new Error("フレーム抽出に失敗しました (0枚)");

            // Debug Info
            setDebugFrames(frames.slice(0, 4).map(f => ({
                url: f.dataUrl,
                info: `${f.width}x${f.height}`
            })));

            setStatusMessage(`AI解析中... (${frames.length}枚の画像を送信)`);

            // --- Step 3: Start Server Job ---
            const result = await startVisionAnalysis({
                frames: frames.map(f => f.dataUrl),
                question: question,
                description: "",
                matchId: match.matchId,
                puuid: puuid
            });

            if (!result.success || !result.jobId) {
                throw new Error(result.error || "解析ジョブの開始に失敗しました");
            }

            // --- Step 4: Handover to Polling ---
            console.log("[GlobalProvider] Job Started:", result.jobId);
            setMicroJobId(result.jobId);
            localStorage.setItem('microJobId', result.jobId); // Persist
            
            // Polling effect will take over from here...

        } catch (e: any) {
            console.error(e);
            setAsyncStatus('failed');
            setIsVerifying(false);
            setErrorMsg(e.message || "予期せぬエラーが発生しました");
            setStatusMessage("エラー");
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
            startGlobalAnalysis: startAnalysis,
            verifyVideo,
            resetAnalysis,
            clearError,
            setIsVerifying
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
