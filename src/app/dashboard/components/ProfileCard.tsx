
import React from 'react';

type ProfileCardProps = {
    summonerName: string;
    tagLine: string | null;
    level: number;
    iconId: number;
    tier?: string;
    rank?: string;
    lp?: number;
    wins?: number;
    losses?: number;
    currentQueue: "SOLO" | "FLEX";
    onQueueChange: (queue: "SOLO" | "FLEX") => void;
};

export default function ProfileCard({
    summonerName,
    tagLine,
    level,
    iconId,
    tier,
    rank,
    lp,
    wins = 0,
    losses = 0,
    currentQueue,
    onQueueChange
}: ProfileCardProps) {
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${iconId}.png`;
    // Rank Icon placeholder - in production you would map tiers to assets
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    return (
        <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
            {/* Background Glow Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            {/* Icon Section */}
            <div className="relative shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-yellow-500 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition duration-500"></div>
                <img 
                    src={iconUrl} 
                    alt="Profile Icon" 
                    className="relative w-24 h-24 rounded-full border-2 border-slate-900 bg-slate-900 z-10"
                />
                <span className="absolute -bottom-2 right-0 bg-slate-800 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-600 z-20 shadow-lg">
                    {level}
                </span>
            </div>
            
            {/* Info Section */}
            <div className="flex-1 w-full z-10">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-2xl font-bold flex items-end gap-2 text-slate-100 tracking-tight">
                        {summonerName} 
                        {tagLine && <span className="text-lg text-slate-500 font-medium mb-1">#{tagLine}</span>}
                    </h2>
                    
                    {/* Queue Switcher */}
                    <div className="flex bg-slate-900/80 rounded-lg p-1 border border-slate-700">
                        <button 
                            onClick={() => onQueueChange("SOLO")}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${currentQueue === "SOLO" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            SOLO/DUO
                        </button>
                        <button 
                            onClick={() => onQueueChange("FLEX")}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${currentQueue === "FLEX" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            FLEX
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6 mt-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div className="text-left">
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">
                            {currentQueue === "SOLO" ? "Ranked Solo" : "Ranked Flex"}
                        </p>
                        <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
                            {tier ? `${tier} ${rank}` : "UNRANKED"}
                        </p>
                        {tier && <p className="text-sm text-slate-300 font-mono">{lp} LP</p>}
                    </div>
                    
                    {tier && (
                        <div className="text-left border-l border-slate-700 pl-6">
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Win Rate</p>
                            <p className={`text-xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {winRate}%
                            </p>
                            <p className="text-xs text-slate-500 font-mono">{wins}W - {losses}L</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
