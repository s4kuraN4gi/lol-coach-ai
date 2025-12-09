
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
    losses = 0
}: ProfileCardProps) {
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${iconId}.png`;
    // Rank Icon placeholder - in production you would map tiers to assets
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex items-center gap-6">
            <div className="relative">
                <img 
                    src={iconUrl} 
                    alt="Profile Icon" 
                    className="w-24 h-24 rounded-full border-4 border-blue-500"
                />
                <span className="absolute bottom-0 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded-full border border-white">
                    {level}
                </span>
            </div>
            
            <div className="flex-1">
                <h2 className="text-2xl font-bold flex items-end gap-2">
                    {summonerName} 
                    {tagLine && <span className="text-sm text-gray-400 font-normal mb-1">#{tagLine}</span>}
                </h2>
                
                <div className="mt-2 flex items-center gap-4">
                    <div className="text-left">
                        <p className="text-sm text-gray-500">Rank</p>
                        <p className="text-xl font-bold text-blue-700">
                            {tier ? `${tier} ${rank}` : "Unranked"}
                        </p>
                        {tier && <p className="text-sm text-gray-600">{lp} LP</p>}
                    </div>
                    
                    {tier && (
                        <div className="text-left border-l pl-4">
                            <p className="text-sm text-gray-500">Win Rate</p>
                            <p className="text-lg font-semibold">{winRate}%</p>
                            <p className="text-xs text-gray-400">{wins}W {losses}L</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
