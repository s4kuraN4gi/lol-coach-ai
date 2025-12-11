import Link from "next/link";

type Participant = {
    puuid: string;
    teamId: number;
    summonerName: string;
    championName: string;
    kills: number;
    deaths: number;
    assists: number;
    visionScore: number;
    totalMinionsKilled: number;
    item0: number; // Item ID
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number; // Trinket
}

type TeamOverviewCardProps = {
    teamId: number;
    teamName: string;
    participants: Participant[];
    win: boolean;
}

export default function TeamOverviewCard({ teamId, teamName, participants, win }: TeamOverviewCardProps) {
    return (
        <div className={`rounded-xl border ${win ? 'border-blue-500/30 bg-blue-900/10' : 'border-red-500/30 bg-red-900/10'} overflow-hidden`}>
            <div className={`px-4 py-2 text-xs font-bold tracking-wider ${win ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'} flex justify-between`}>
                <span>{teamName}</span>
                <span>{win ? "VICTORY" : "DEFEAT"}</span>
            </div>
            
            <div className="divide-y divide-slate-800">
                {participants.map((p) => (
                    <div key={p.puuid} className="p-3 flex items-center gap-3 hover:bg-white/5 transition">
                        {/* Champion Icon */}
                        <div className="relative">
                            <img 
                                src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${p.championName}.png`}
                                alt={p.championName}
                                className="w-10 h-10 rounded"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-slate-900 text-[10px] text-slate-400 px-1 rounded border border-slate-700">
                                {((p.totalMinionsKilled || 0 )).toString()} CS
                            </div>
                        </div>

                        {/* Name & KDA */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{p.summonerName}</div>
                            <div className="text-xs text-slate-400 font-mono">
                                <span className="text-white">{p.kills}/{p.deaths}/{p.assists}</span>
                                <span className="mx-2 text-slate-600">|</span>
                                👁️ {p.visionScore}
                            </div>
                        </div>

                        {/* Items (Simplified) */}
                        <div className="flex gap-0.5">
                            {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((itemId, idx) => (
                                itemId !== 0 ? (
                                    <img 
                                        key={idx}
                                        src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${itemId}.png`}
                                        alt="Item"
                                        className="w-6 h-6 rounded bg-slate-800"
                                    />
                                ) : (
                                    <div key={idx} className="w-6 h-6 rounded bg-slate-800/50" />
                                )
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
