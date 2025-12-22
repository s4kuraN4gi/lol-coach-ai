"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSummoner } from "../../Providers/SummonerProvider";
import { getStatsFromCache, type MatchStatsDTO, type BasicStatsDTO } from "@/app/actions/stats";
import LoadingAnimation from "../../Components/LoadingAnimation";

type ChampionStat = {
    name: string;
    games: number;
    wins: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgCs: number;
    winRate: number;
    avgKda: string;
}

export default function AllChampionsPage() {
    const { activeSummoner, loading: summonerLoading } = useSummoner();
    const [stats, setStats] = useState<(MatchStatsDTO & BasicStatsDTO) | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<"games" | "winRate" | "kda" | "name">("games");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    useEffect(() => {
        if (summonerLoading) return;
        if (!activeSummoner) {
            setLoading(false);
            return;
        }

        async function load() {
            setLoading(true);
            try {
                const data = await getStatsFromCache(activeSummoner!.puuid);
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [activeSummoner, summonerLoading]);

    const filteredChampions = useMemo(() => {
        if (!stats?.championStats) return [];
        
        let result = [...stats.championStats].filter(c => 
            c.name.toLowerCase().includes(search.toLowerCase())
        );

        result.sort((a, b) => {
            let valA: any = a[sortKey as keyof ChampionStat];
            let valB: any = b[sortKey as keyof ChampionStat];
            
            // Special handling for KDA string "x.xx" or "Perfect"
            if (sortKey === "kda") {
               valA = parseFloat(a.avgKda) || 0;
               valB = parseFloat(b.avgKda) || 0;
            } else if (sortKey === "avgKda") { 
               // Map 'kda' state to 'avgKda' prop
               valA = parseFloat(a.avgKda) || 0;
               valB = parseFloat(b.avgKda) || 0;
            }

            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [stats, search, sortKey, sortDir]);

    if (summonerLoading || loading) return <LoadingAnimation />;

    if (!activeSummoner) {
        return <div className="p-8 text-center text-slate-400">Summoner not selected.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm group">
                        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">
                        All Champions
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Performance statistics across all played champions
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input 
                            type="text" 
                            placeholder="Search Champion..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:border-blue-500 text-slate-200"
                        />
                        <svg className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    
                    <select 
                        value={sortKey} 
                        onChange={(e) => setSortKey(e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                    >
                        <option value="games">Games Played</option>
                        <option value="winRate">Win Rate</option>
                        <option value="avgKda">KDA</option>
                        <option value="name">Name</option>
                    </select>

                    <button 
                        onClick={() => setSortDir(prev => prev === "asc" ? "desc" : "asc")}
                        className="p-2 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors text-slate-400"
                    >
                        {sortDir === "desc" ? "↓" : "↑"}
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredChampions.map((champ) => (
                    <Link 
                        key={champ.name} 
                        href={`/dashboard/champion/${encodeURIComponent(champ.name)}`}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:bg-slate-800 hover:border-blue-500/30 transition-all group relative overflow-hidden"
                    >
                        {/* Background Gradient on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="flex items-center gap-4 relative z-10">
                            {/* Icon */}
                            <div className="w-14 h-14 rounded-lg border border-slate-700 overflow-hidden relative shadow-lg group-hover:border-blue-500/50 transition-colors">
                                <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${champ.name}.png`} 
                                    alt={champ.name}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-100 text-lg truncate group-hover:text-blue-400 transition-colors">
                                    {champ.name}
                                </h3>
                                <div className="text-xs text-slate-500 font-medium">
                                    {champ.games} Games
                                </div>
                            </div>

                            {/* Win Rate Badge */}
                            <div className="text-right">
                                <div className={`text-xl font-bold ${champ.winRate >= 50 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {champ.winRate}%
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                    {champ.avgKda} KDA
                                </div>
                            </div>
                        </div>

                        {/* Additional Stats Row */}
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400 font-mono">
                            <span title="Average Kills/Deaths/Assists">
                                {champ.avgKills}/{champ.avgDeaths}/{champ.avgAssists}
                            </span>
                            <span title="Average CS">
                                {champ.avgCs} CS
                            </span>
                        </div>
                    </Link>
                ))}

                {filteredChampions.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500">
                        No champions found.
                    </div>
                )}
            </div>
        </div>
    );
}
