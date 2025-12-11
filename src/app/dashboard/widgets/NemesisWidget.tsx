import { UniqueStats } from "@/app/actions/stats";

export default function NemesisWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return null;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="text-slate-400 text-xs font-bold tracking-wider mb-4">NEMESIS & PREY (Matchups)</div>

            <div className="grid grid-cols-2 gap-4">
                {/* Nemesis (Worst WR) */}
                <div>
                    <div className="text-[10px] items-center gap-1 text-red-400 font-bold mb-2 flex">
                        💀 NEMESIS (Low WR)
                    </div>
                    <div className="space-y-2">
                        {stats.nemesis.map(c => (
                            <div key={c.name} className="flex items-center gap-2 bg-slate-800/30 p-1 rounded border border-red-500/10">
                                <div className="w-6 h-6 rounded overflow-hidden">
                                     <img src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${c.name}.png`} alt={c.name} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-300 leading-none">{c.name}</div>
                                    <div className="text-[9px] text-red-400 font-mono">{c.winRate}% ({c.games})</div>
                                </div>
                            </div>
                        ))}
                        {stats.nemesis.length === 0 && <div className="text-[9px] text-slate-500">None detected</div>}
                    </div>
                </div>

                {/* Prey (Best WR) */}
                <div>
                     <div className="text-[10px] items-center gap-1 text-green-400 font-bold mb-2 flex">
                        🍔 PREY (High WR)
                     </div>
                     <div className="space-y-2">
                        {stats.prey.map(c => (
                            <div key={c.name} className="flex items-center gap-2 bg-slate-800/30 p-1 rounded border border-green-500/10">
                                <div className="w-6 h-6 rounded overflow-hidden">
                                     <img src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${c.name}.png`} alt={c.name} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-300 leading-none">{c.name}</div>
                                    <div className="text-[9px] text-green-400 font-mono">{c.winRate}% ({c.games})</div>
                                </div>
                            </div>
                        ))}
                         {stats.prey.length === 0 && <div className="text-[9px] text-slate-500">None detected</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
