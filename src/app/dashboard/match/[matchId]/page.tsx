import { fetchMatchDetail, fetchMatchTimeline } from "@/app/actions/riot";
import { getMatchAnalysis } from "@/app/actions/analysis";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import Timeline from "./components/Timeline";
import MatchAnalysisPanel from "./components/MatchAnalysisPanel";
import { createClient } from "@/utils/supabase/server";

// This is a Server Component
export default async function MatchDetailsPage({ params }: { params: { matchId: string } }) {
    const { matchId } = params;
    const supabase = await createClient();
    
    // Get Current User & Profile
    const { data: { user } } = await supabase.auth.getUser();
    let userPuuid: string | null = null;
    
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('puuid').eq('id', user.id).single();
        userPuuid = profile?.puuid || null;
    }

    // Fetch data in parallel
    const [matchRes, timelineRes, initialAnalysis] = await Promise.all([
        fetchMatchDetail(matchId),
        fetchMatchTimeline(matchId),
        getMatchAnalysis(matchId)
    ]);

    if (!matchRes.success || !matchRes.data) {
         console.error(`Match Detail Load Failed for ID: ${matchId}`, matchRes.error);
         return (
            <DashboardLayout>
                <div className="p-10 text-center text-red-400">
                    <h2 className="text-2xl font-bold mb-4">Failed to Load Match</h2>
                    <p className="font-mono bg-slate-900 p-4 rounded inline-block text-left">
                        <span className="text-slate-500">ID:</span> {matchId}<br/>
                        <span className="text-slate-500">Error:</span> {matchRes.error || "Unknown Error"}
                    </p>
                    <div className="mt-6">
                        <Link href="/dashboard" className="text-blue-400 hover:underline">Return to Dashboard</Link>
                    </div>
                </div>
            </DashboardLayout>
         );
    }

    const match = matchRes.data;
    const timeline = timelineRes.data;

    // Identify User Participant
    const participant = userPuuid 
        ? match.info.participants.find((p: any) => p.puuid === userPuuid)
        : null;

    const summonerName = participant?.summonerName || "Unknown";
    const championName = participant?.championName || "Unknown";
    const kda = participant ? `${participant.kills}/${participant.deaths}/${participant.assists}` : "0/0/0";
    const win = participant?.win || false;

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                {/* Header / Nav */}
                <div className="flex items-center gap-4 mb-8 text-sm text-slate-400">
                    <Link href="/dashboard" className="hover:text-blue-400 transition flex items-center gap-1">
                        ← Back to Dashboard
                    </Link>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-200 font-mono">{matchId}</span>
                </div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                             <div className="bg-slate-800 p-2 rounded-lg">
                                 <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${championName}.png`} 
                                    alt={championName}
                                    className="w-12 h-12 rounded"
                                    onError={(e) => e.currentTarget.style.display = 'none'} 
                                 />
                             </div>
                             <div>
                                <h1 className="text-2xl font-bold italic tracking-tighter text-white">
                                    MATCH ANALYSIS <span className="text-blue-500">AI</span>
                                </h1>
                                <div className="text-sm text-slate-400 font-mono">
                                    {participant ? (participant.win ? "VICTORY" : "DEFEAT") : "SPECTATOR"} • {kda} KDA
                                </div>
                             </div>
                        </div>

                        <div className="text-xs font-mono text-slate-500 border border-slate-700 px-2 py-1 rounded">
                            PATCH {match.info.gameVersion.split('.').slice(0, 2).join('.')}
                        </div>
                    </div>

                    {/* Timeline Component */}
                    {timeline ? (
                         <div className="glass-panel p-1 rounded-xl overflow-hidden shadow-2xl shadow-blue-900/10">
                            <Timeline match={match} timeline={timeline} />
                         </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                            Timeline data not available for this match.
                        </div>
                    )}

                    {/* AI Analysis Panel */}
                    {participant && (
                        <MatchAnalysisPanel 
                            matchId={matchId}
                            initialAnalysis={initialAnalysis}
                            summonerName={summonerName}
                            championName={championName}
                            kda={kda}
                            win={win}
                        />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
