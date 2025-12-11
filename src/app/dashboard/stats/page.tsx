import { createClient } from "@/utils/supabase/server";
import { fetchMatchIds, fetchMatchDetail, fetchRank } from "@/app/actions/riot";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import Link from "next/link";

type HistoryItem = {
    matchId: string;
    champion: string;
    win: boolean;
    kda: string;
    date: string;
    mode: string;
    duration: number;
}

export default async function StatsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Auth Check
    if (!user) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center text-slate-400">Please log in.</div>
            </DashboardLayout>
        );
    }

    // Get Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (!profile || !profile.puuid) {
        return (
             <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <h2 className="text-xl font-bold text-white mb-4">No Account Linked</h2>
                    <p className="text-slate-400 mb-6">Link your Riot Account in settings to view stats.</p>
                    <Link href="/account" className="bg-blue-600 text-white px-6 py-2 rounded-lg">Go to Settings</Link>
                </div>
            </DashboardLayout>
        );
    }

    // Fetch Matches (Server-Side)
    // Fetch count=10 for history page
    const matchIdsRes = await fetchMatchIds(profile.puuid, 10);
    let history: HistoryItem[] = [];
    let stats = { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 };

    if (matchIdsRes.success && matchIdsRes.data) {
        const matchPromises = matchIdsRes.data.map(id => fetchMatchDetail(id));
        const matchesRes = await Promise.all(matchPromises);
        
        history = matchesRes
            .filter(res => res.success && res.data)
            .map(res => res.data)
            .map((m: any) => {
                const p = m.info.participants.find((p: any) => p.puuid === profile.puuid);
                if (!p) return null;
                
                // Aggregate Stats
                stats.wins += p.win ? 1 : 0;
                stats.losses += p.win ? 0 : 1;
                stats.kills += p.kills;
                stats.deaths += p.deaths;
                stats.assists += p.assists;

                return {
                    matchId: m.metadata.matchId,
                    champion: p.championName,
                    win: p.win,
                    kda: `${p.kills}/${p.deaths}/${p.assists}`,
                    date: new Date(m.info.gameCreation).toLocaleDateString(),
                    mode: m.info.gameMode,
                    duration: m.info.gameDuration
                };
            })
            .filter(h => h !== null);
    }

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
    const avgKda = totalGames > 0 
        ? ((stats.kills + stats.assists) / Math.max(1, stats.deaths)).toFixed(2)
        : "0.00";

    return (
        <DashboardLayout>
             <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                 <h1 className="text-3xl font-black italic tracking-tighter text-white mb-8">
                    DETAILED STATS & HISTORY
                 </h1>

                {/* Aggregate Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                     <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">WIN RATE</div>
                        <div className={`text-3xl font-black ${winRate >= 50 ? 'text-blue-400' : 'text-slate-200'}`}>
                            {winRate}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{stats.wins}W - {stats.losses}L</div>
                     </div>
                     <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">KDA RATIO</div>
                        <div className="text-3xl font-black text-yellow-500">{avgKda}</div>
                        <div className="text-xs text-slate-500 mt-1">Avg. Performance</div>
                     </div>
                     {/* More stat cards can go here */}
                </div>

                {/* Match List */}
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                    MATCH GALLERY
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {history.map((match: any) => (
                        <Link 
                            key={match.matchId} 
                            href={`/dashboard/match/${match.matchId}`}
                            className={`
                                relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-all duration-300 group
                                ${match.win ? 'hover:border-blue-500/50' : 'hover:border-red-500/50'}
                            `}
                        >
                             {/* Background Image (Champ) - Placeholder or API */}
                             <div className="absolute inset-0 opacity-20 grayscale group-hover:grayscale-0 transition duration-500">
                                 <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${match.champion}_0.jpg`} 
                                    alt={match.champion}
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.currentTarget.style.display = 'none'} 
                                 />
                             </div>
                             
                             <div className="relative p-6 z-10 flex flex-col h-full justify-between min-h-[160px]">
                                 <div className="flex justify-between items-start">
                                     <div>
                                        <div className="text-2xl font-black text-white italic">{match.champion}</div>
                                        <div className="text-xs text-slate-400 font-mono">{match.mode} • {match.date}</div>
                                     </div>
                                     <div className={`px-2 py-1 rounded text-xs font-bold ${match.win ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                                         {match.win ? "VICTORY" : "DEFEAT"}
                                     </div>
                                 </div>
                                 
                                 <div className="mt-4 flex justify-between items-end">
                                     <div className="text-slate-300 font-mono text-sm">
                                         KDA <span className="text-white font-bold text-lg">{match.kda}</span>
                                     </div>
                                      <div className="text-xs text-blue-400 font-bold opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all">
                                          ANALYZE →
                                      </div>
                                 </div>
                             </div>
                        </Link>
                    ))}
                </div>
                {history.length === 0 && (
                    <div className="text-center py-10 text-slate-500 border border-slate-800 border-dashed rounded-xl">
                        No recent matches found. Play a game to see stats!
                    </div>
                )}
             </div>
        </DashboardLayout>
    )
}
