import React from 'react';
import { LeagueEntryDTO } from '@/app/actions/riot';

type RankCardProps = {
    rank: LeagueEntryDTO;
    currentQueue: "SOLO" | "FLEX";
    onQueueChange: (queue: "SOLO" | "FLEX") => void;
    lpHistory: { win: boolean, timestamp: number }[];
};

export default function RankCard({
    rank,
    currentQueue,
    onQueueChange,
    lpHistory
}: RankCardProps) {
    const wins = rank.wins;
    const losses = rank.losses;
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    
    // Calculate Trend
    const last10 = lpHistory.slice(0, 10);
    const recentWins = last10.filter(m => m.win).length;
    const recentWinRate = last10.length > 0 ? Math.round((recentWins / last10.length) * 100) : 0;

    return (
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden h-full flex flex-col justify-center">
             <div className="flex justify-between items-start mb-4">
                 <div className="flex bg-slate-900/80 rounded-lg p-1 border border-slate-700">
                    <button 
                        onClick={() => onQueueChange("SOLO")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${currentQueue === "SOLO" ? "bg-primary-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                    >
                        SOLO/DUO
                    </button>
                    <button 
                        onClick={() => onQueueChange("FLEX")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${currentQueue === "FLEX" ? "bg-primary-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                    >
                        FLEX
                    </button>
                </div>
                
                <div className="text-right">
                    <p className="text-xs text-slate-400 font-mono">RECENT FORM ({last10.length})</p>
                    <p className={`text-md font-bold ${recentWinRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                        {recentWinRate}% WR
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Rank Icon Placeholder */}
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 relative group">
                    <span className="text-2xl font-black text-slate-600 group-hover:text-slate-500 transition-colors">
                        {rank.tier ? rank.tier[0] : "?"}
                    </span>
                    {rank.tier && (
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 blur-md opacity-50"></div>
                    )}
                </div>

                <div className="flex-1">
                    <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold mb-1">
                        {currentQueue === "SOLO" ? "Ranked Solo" : "Ranked Flex"}
                    </p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-3xl font-black text-primary">
                            {rank.tier} {rank.rank}
                        </p>
                        <p className="text-xl text-slate-300 font-mono">{rank.leaguePoints} LP</p>
                    </div>
                </div>

                <div className="text-right border-l border-slate-700 pl-6 hidden sm:block">
                     <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Total WR</p>
                    <p className={`text-2xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {winRate}%
                    </p>
                    <p className="text-xs text-slate-500 font-mono">{wins}W - {losses}L</p>
                </div>
            </div>
        </div>
    );
}
