import React from 'react';

type ProfileCardProps = {
    summoner: {
        name: string;
        tagLine: string | null;
        profileIconId: number;
        summonerLevel: number;
    }
};

export default function ProfileCard({ summoner }: ProfileCardProps) {
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${summoner.profileIconId}.png`;

    return (
        <div className="glass-panel p-6 rounded-xl flex items-center gap-6 relative overflow-hidden group h-full">
            {/* Background Glow Effect */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none" />

            {/* Icon Section */}
            <div className="relative shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition duration-500"></div>
                <img 
                    src={iconUrl} 
                    alt="Profile Icon" 
                    className="relative w-20 h-20 rounded-full border-2 border-slate-900 bg-slate-900 z-10"
                />
                <span className="absolute -bottom-2 right-0 bg-slate-800 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-600 z-20 shadow-lg">
                    {summoner.summonerLevel}
                </span>
            </div>
            
            {/* Info Section */}
            <div className="flex-1 min-w-0 z-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight truncate">
                    {summoner.name} 
                </h2>
                {summoner.tagLine && (
                    <p className="text-md text-slate-500 font-medium font-mono">#{summoner.tagLine}</p>
                )}
            </div>
        </div>
    );
}

