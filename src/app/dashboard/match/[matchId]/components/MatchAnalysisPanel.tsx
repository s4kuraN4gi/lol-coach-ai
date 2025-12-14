"use client";

import React, { useState, useEffect, useRef } from 'react';
import { analyzeMatchQuick } from '@/app/actions/analysis';
import { useAuth } from '@/app/Providers/AuthProvider';
import { useSummoner } from '@/app/Providers/SummonerProvider'; // Need PUUID

// Imports cleaned up
// import InsightCard from './Analysis/InsightCard';
// import BuildTable from './Analysis/BuildTable';

type MatchAnalysisPanelProps = {
    matchId: string;
    initialAnalysis: string | null;
    summonerName: string;
    championName: string;
    kda: string;
    win: boolean;
};

export default function MatchAnalysisPanel({
    matchId,
    initialAnalysis,
    summonerName,
    championName,
    kda,
    win
}: MatchAnalysisPanelProps) {
    // State
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [rawLegacyText, setRawLegacyText] = useState<string | null>(initialAnalysis || null);
    
    const [mode, setMode] = useState<'LANING' | 'MACRO' | 'TEAMFIGHT'>('MACRO');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    
    const { user } = useAuth();
    const { activeSummoner } = useSummoner();

    // Effect: Cooldown Timer
    useEffect(() => {
        if (cooldownSeconds > 0) {
            const timer = setTimeout(() => setCooldownSeconds(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldownSeconds]);

    // Effect: Try to parse initial analysis if it's JSON (Migration support)
    useEffect(() => {
        if (initialAnalysis) {
            try {
                // Check if it looks like JSON structure for AnalysisResult
                if (initialAnalysis.trim().startsWith('{') && initialAnalysis.includes('"insights"')) {
                    const parsed = JSON.parse(initialAnalysis);
                    setAnalysisData(parsed);
                    setRawLegacyText(null); // Hide legacy view if successful
                } else {
                    // It's legacy text
                    setRawLegacyText(initialAnalysis);
                }
            } catch (e) {
                // Fallback to legacy text
                setRawLegacyText(initialAnalysis);
            }
        }
    }, [initialAnalysis]);

    // Ref for scrolling
    const panelRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        if (panelRef.current) {
            panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleAnalyze = async () => {
        if (cooldownSeconds > 0) return; // Prevent click during cooldown

        if (!activeSummoner?.puuid) {
            setError("Summoner PUUID not found. Please reload.");
            scrollToTop();
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        
        const keyToUse = apiKey || localStorage.getItem("gemini_api_key") || undefined;

        try {
            // New Quick Analysis V2
            const res = await analyzeMatchQuick(matchId, summonerName, activeSummoner.puuid, keyToUse);
            
            if (res.success && res.data) {
                setAnalysisData(res.data);
                setRawLegacyText(null); // Clear legacy view
                setCooldownSeconds(0); // Reset cooldown on success
                if (apiKey) {
                     localStorage.setItem("gemini_api_key", apiKey);
                }
            } else {
                if (res.error?.includes("API Key")) {
                    setShowKeyInput(true);
                    setError("API Key is required/invalid. Please enter your Gemini API Key.");
                } else {
                    setError(res.error || "Analysis failed.");
                    // Trigger Cooldown on Failure
                    setCooldownSeconds(60);
                }
            }
        } catch (e: any) {
            setError(e.message || "Unknown error occurred.");
            setCooldownSeconds(60);
        } finally {
            setIsAnalyzing(false);
            // Scroll to top to show results or error
            // Small timeout to allow render
            setTimeout(() => scrollToTop(), 100);
        }
    };

    return (
        <div ref={panelRef} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl mt-6">
            <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="text-xl">🤖</span> AI MATCH DIAGNOSIS <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white ml-2">V2.5</span>
                </h3>
            </div>

            <div className="p-6">
                {/* Mode Selector (Always visible to allow mode switch even before analyzing if we support re-analysis?) 
                    Actually, we should show it. Re-analyzing wipes valid result? Yes for now. 
                */}
                {/* Mode Selector Removed for Quick Analysis */}

                {error && (
                    <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4 text-sm whitespace-pre-wrap flex justify-between items-center">
                        <span>{error}</span>
                        {cooldownSeconds > 0 && (
                             <span className="font-bold text-white bg-red-600/50 px-2 py-1 rounded text-xs ml-4 whitespace-nowrap">
                                 Wait {cooldownSeconds}s
                             </span>
                        )}
                    </div>
                )}

                {/* 1. New Structured Analysis View */}
                {analysisData ? (
                    <div className="animate-fadeIn space-y-8">
                        {/* Report Card UI */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* 1. Grade & Badge */}
                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 mb-2">
                                    {analysisData.grade || "?"}
                                </div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">OVERALL GRADE</div>
                                
                                {analysisData.badge && (
                                    <div className={`bg-slate-900/80 px-4 py-2 rounded-full border border-slate-700 flex items-center gap-2 ${analysisData.badge.color || 'text-white'}`}>
                                        <span className="text-xl">{analysisData.badge.icon}</span>
                                        <span className="font-bold text-sm">{analysisData.badge.label}</span>
                                    </div>
                                )}
                            </div>

                            {/* 2. Lane Verdict */}
                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 flex flex-col text-center relative overflow-hidden">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">LANE VERDICT</div>
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className={`text-3xl font-black mb-2 ${
                                        analysisData.laneVerdict?.result === 'WIN' ? 'text-blue-400' : 
                                        analysisData.laneVerdict?.result === 'LOSS' ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                        {analysisData.laneVerdict?.result || "EVEN"}
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed italic">
                                        "{analysisData.laneVerdict?.reason}"
                                    </p>
                                </div>
                            </div>
                            
                             {/* 3. Key Advice */}
                            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 flex flex-col text-center relative overflow-hidden md:col-span-1">
                                <div className="text-xs font-bold text-yellow-500/80 uppercase tracking-widest mb-4">KEY FIX</div>
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-md text-white font-medium leading-relaxed">
                                        💡 {analysisData.keyFeedback}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-6 text-right text-xs text-slate-500 font-mono">
                            Analysis generated by Gemini 2.0 Flash (Mode: {mode})
                            {/* Re-Analyze Button Hidden upon Success */}
                        </div>
                    </div>
                ) : (
                    // 2. Legacy View or Empty State
                    <div className="min-h-[200px]">
                        {rawLegacyText ? (
                            <div className="animate-fadeIn">
                                {/* Legacy Text Render */}
                                <div className="p-4 bg-slate-950 rounded border border-slate-800 text-slate-400 text-sm mb-4">
                                     <p className="mb-2 text-yellow-500/80 text-xs uppercase font-bold">⚠️ Legacy Analysis Format</p>
                                    {rawLegacyText.split("\n").map((line, index) => (
                                        <p key={index} className="mb-2">{line}</p>
                                    ))}
                                </div>
                                <div className="text-center">
                                    <p className="text-slate-400 text-sm mb-4">
                                        Update to V2 Analysis for detailed Build & Macro coaching.
                                    </p>
                                    <button 
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || cooldownSeconds > 0}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? "Updating..." : cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : "Upgrade Analysis to V2"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Empty State
                            <div className="text-center py-4">
                                <div className="mb-6">
                                    <h4 className="text-slate-300 font-bold mb-2">Start AI Coaching Session</h4>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto">
                                        Select a focus mode above and request a detailed breakdown of your {mode.toLowerCase()} performance.
                                    </p>
                                </div>

                                {showKeyInput && (
                                     <div className="max-w-sm mx-auto mb-4 animate-fadeIn">
                                        <label className="block text-left text-xs text-slate-400 mb-1">Your Gemini API Key (Free)</label>
                                        <input 
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="AIzaSy..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-500 text-left mt-1">
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline hover:text-blue-400">Get a free key here</a>. Key is stored locally.
                                        </p>
                                     </div>
                                )}

                                <button 
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || cooldownSeconds > 0}
                                    className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold px-8 py-3 rounded-full shadow-lg hover:shadow-cyan-500/25 hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed border border-white/10"
                                >
                                    {isAnalyzing ? "ANALYZING REPLAY..." : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : "✨ ANALYZE MATCH"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
