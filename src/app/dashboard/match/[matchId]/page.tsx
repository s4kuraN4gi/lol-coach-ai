"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchMatchDetail, fetchMatchTimeline } from "@/app/actions/riot";
import { getMatchAnalysis } from "@/app/actions/analysis";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import Link from "next/link";
import Timeline from "./components/Timeline";
import MatchAnalysisPanel from "./components/MatchAnalysisPanel";
import TeamOverviewCard from "./components/TeamOverviewCard"; // Import New Component
import LoadingAnimation from "@/app/Components/LoadingAnimation";
import { useSummoner } from "@/app/Providers/SummonerProvider";

export default function MatchDetailsPage() {
    const params = useParams();
    const matchId = params?.matchId as string;
    const { activeSummoner, loading: summonerLoading } = useSummoner();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<any>(null);
    const [timelineData, setTimelineData] = useState<any>(null);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [isTeamsExpanded, setIsTeamsExpanded] = useState(true);

    useEffect(() => {
        if (!matchId) return;
        
        async function loadMatchData() {
            setLoading(true);
            setError(null);

            try {
                const [matchRes, timelineRes, analysisRes] = await Promise.all([
                    fetchMatchDetail(matchId),
                    fetchMatchTimeline(matchId),
                    getMatchAnalysis(matchId)
                ]);

                if (!matchRes.success || !matchRes.data) {
                    throw new Error(matchRes.error || "Failed to load match details.");
                }

                setMatchData(matchRes.data);
                
                if (timelineRes.success) {
                    setTimelineData(timelineRes.data);
                }
                
                setAnalysisData(analysisRes);

            } catch (e: any) {
                console.error("Match Detail Load Error:", e);
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        }

        loadMatchData();
    }, [matchId]);

    // 1. Loading State
    if (loading || summonerLoading) {
         return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <LoadingAnimation />
                    <p className="mt-4 text-slate-400 animate-pulse">Analyzing Match Data...</p>
                </div>
            </DashboardLayout>
         );
    }

    // 2. Error State
    if (error) {
         return (
            <DashboardLayout>
                <div className="p-10 text-center text-red-400">
                    <h2 className="text-2xl font-bold mb-4">Failed to Load Match</h2>
                    <p className="font-mono bg-slate-900 border border-slate-800 p-4 rounded inline-block text-left text-sm max-w-2xl whitespace-pre-wrap">
                        <span className="text-slate-500">ID:</span> {matchId}<br/>
                        <span className="text-slate-500">Error:</span> {error}
                    </p>
                    <div className="mt-6">
                        <Link href="/dashboard" className="text-blue-400 hover:underline">Return to Dashboard</Link>
                    </div>
                </div>
            </DashboardLayout>
         );
    }

    // Identify User Participant
    const userPuuid = activeSummoner?.puuid;
    const participant = userPuuid && matchData
        ? matchData.info.participants.find((p: any) => p.puuid === userPuuid)
        : null;

    const summonerName = participant?.summonerName || "Unknown";
    const championName = participant?.championName || "Unknown";
    const kda = participant ? `${participant.kills}/${participant.deaths}/${participant.assists}` : "0/0/0";
    const win = participant?.win || false;

    // Split Teams
    const team100 = matchData?.info.participants.filter((p: any) => p.teamId === 100) || [];
    const team200 = matchData?.info.participants.filter((p: any) => p.teamId === 200) || [];
    const team100Win = team100[0]?.win;
    const team200Win = team200[0]?.win;

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                {/* Header / Nav */}
                <div className="flex items-center gap-4 mb-8 text-sm text-slate-400">
                    <Link href="/dashboard/stats" className="hover:text-blue-400 transition flex items-center gap-1">
                        ← Back to Stats
                    </Link>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-200 font-mono">{matchId}</span>
                </div>

                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                             <div className="bg-slate-800 p-2 rounded-lg relative overflow-hidden group">
                                 <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${championName}.png`} 
                                    alt={championName}
                                    className="w-16 h-16 rounded object-cover transform scale-110 group-hover:scale-100 transition duration-500"
                                    onError={(e) => e.currentTarget.style.display = 'none'} 
                                 />
                                 <div className={`absolute inset-0 border-2 rounded-lg ${win ? 'border-blue-500/50' : 'border-red-500/50'}`}></div>
                             </div>
                             <div>
                                <h1 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-2">
                                    MATCH REPORT <span className="text-blue-500 text-sm font-normal py-0.5 px-2 bg-blue-500/10 rounded-full border border-blue-500/30">AI BETA</span>
                                </h1>
                                <div className="flex items-center gap-3 text-sm font-mono mt-1">
                                    <span className={`font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
                                        {win ? "VICTORY" : "DEFEAT"}
                                    </span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-300">{kda} KDA</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-400">{matchData.info.gameMode}</span>
                                </div>
                             </div>
                        </div>

                        <div className="text-xs font-mono text-slate-500 border border-slate-800 bg-slate-900/50 px-3 py-1.5 rounded-full">
                            VER {matchData.info.gameVersion.split('.').slice(0, 2).join('.')}
                        </div>
                    </div>

                    {/* Timeline Component (Full Width) */}
                    {timelineData ? (
                        <div className="transform transition-all duration-500 hover:scale-[1.01]">
                            <Timeline match={matchData} timeline={timelineData} />
                        </div>
                    ) : (
                        <div className="h-48 bg-slate-900 rounded-xl animate-pulse flex items-center justify-center text-slate-700">
                            Loading Timeline...
                        </div>
                    )}

                    {/* Teams Overview Section (Collapsible) */}
                    {matchData && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-300">
                             <div 
                                className="px-4 py-3 bg-slate-800/50 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition"
                                onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                             >
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <span>👥</span> Teams Overview
                                </h3>
                                <button className="w-6 h-6 flex items-center justify-center rounded bg-black/20 text-slate-400 hover:text-white transition">
                                     {isTeamsExpanded ? (
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                     ) : (
                                        <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><path d="M1 9L5 5L1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                     )}
                                </button>
                             </div>
                             
                             <div className={`transition-all duration-500 ease-in-out ${isTeamsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start border-t border-slate-800">
                                    <TeamOverviewCard 
                                        teamId={100} 
                                        teamName="BLUE TEAM" 
                                        participants={team100} 
                                        win={team100Win} 
                                    />
                                    <TeamOverviewCard 
                                        teamId={200} 
                                        teamName="RED TEAM" 
                                        participants={team200} 
                                        win={team200Win} 
                                    />
                                </div>
                             </div>
                        </div>
                    )}

                    {/* AI Analysis Panel (Bottom) */}
                    <div className="w-full">
                        {participant && (
                            <MatchAnalysisPanel 
                                matchId={matchId} 
                                initialAnalysis={analysisData}
                                summonerName={summonerName}
                                championName={participant.championName}
                                win={participant.win}
                                kda={`${participant.kills}/${participant.deaths}/${participant.assists}`}
                            />
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

