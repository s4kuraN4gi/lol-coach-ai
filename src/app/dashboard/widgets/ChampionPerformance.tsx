"use client";

import { ChampionStat } from "@/app/actions/stats";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

export default function ChampionPerformance({ stats }: { stats: ChampionStat[] }) {
    const { t } = useTranslation();
    
    if (!stats || stats.length === 0) {
        return (
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px] text-center">
                 <div className="text-slate-500 font-bold mb-2">{t('widgets.championPerformance.noData')}</div>
                 <div className="text-xs text-slate-600">{t('widgets.championPerformance.noDataDesc')}</div>
            </div>
        )
    }

    const topChamp = stats[0];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
             {/* Background Splash for Top Champ */}
             <div className="absolute inset-0 opacity-10 grayscale group-hover:grayscale-0 transition duration-700">
                  <img 
                    src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${topChamp.name}_0.jpg`} 
                    alt="Background" 
                    className="w-full h-full object-cover"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
             </div>

             <div className="relative z-10">
                 <div className="flex justify-between items-center mb-4">
                    <div className="text-slate-400 text-xs font-bold tracking-wider">{t('widgets.championPerformance.title')}</div>
                    <Link href="/dashboard/champions" className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded">
                        {t('widgets.championPerformance.viewAll')}
                    </Link>
                 </div>

                 {/* Top 1 Highlight */}
                 {/* Top 1 Highlight */}
                 <Link href={`/dashboard/champion/${encodeURIComponent(topChamp.name)}`} className="flex items-center gap-4 mb-6 hover:bg-white/5 p-2 -ml-2 rounded-lg transition overflow-visible group/top cursor-pointer">
                     <div className="w-16 h-16 rounded-lg border-2 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] overflow-hidden relative">
                         <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${topChamp.name}.png`} 
                            alt={topChamp.name}
                            className="w-full h-full object-cover"
                         />
                         <div className="absolute bottom-0 right-0 bg-yellow-500 text-black font-black text-[10px] px-1">#1</div>
                     </div>
                     <div className="flex-1">
                         <div className="text-xl font-black text-white italic group-hover/top:text-blue-400 transition-colors">{topChamp.name}</div>
                         <div className="flex items-center gap-2 text-xs">
                             <span className={topChamp.winRate >= 60 ? "text-yellow-400 font-bold" : topChamp.winRate >= 50 ? "text-blue-400 font-bold" : "text-slate-400"}>
                                 {topChamp.winRate}% WR
                             </span>
                             <span className="text-slate-500">•</span>
                             <span className="text-slate-300">{topChamp.games} {t('widgets.championPerformance.games')}</span>
                         </div>
                         <div className="text-xs text-slate-400 mt-0.5 font-mono">
                             KDA {topChamp.avgKda}
                         </div>
                     </div>
                     <div className="opacity-0 group-hover/top:opacity-100 transition-opacity text-slate-400 pr-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </div>
                 </Link>
                 
                 {/* List 2 & 3 */}
                 <div className="space-y-3">
                     {stats.slice(1, 3).map((champ, i) => (
                         <Link key={champ.name} href={`/dashboard/champion/${encodeURIComponent(champ.name)}`} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-blue-500/30 transition group/list cursor-pointer">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded border border-slate-600 overflow-hidden">
                                    <img 
                                        src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${champ.name}.png`} 
                                        alt={champ.name}
                                        className="w-full h-full object-cover"
                                    />
                                 </div>
                                 <div className="flex-1">
                                     <div className="text-sm font-bold text-slate-200 group-hover/list:text-blue-400 transition-colors">{champ.name}</div>
                                     <div className="text-[10px] text-slate-500">{champ.games} {t('widgets.championPerformance.games')}</div>
                                 </div>
                             </div>
                             <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className={`text-sm font-black tabular-nums ${champ.winRate >= 50 ? 'text-blue-400' : 'text-slate-400'}`}>
                                        {champ.winRate}%
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                        {champ.avgKda} KDA
                                    </div>
                                </div>
                                <svg className="w-4 h-4 text-slate-600 group-hover/list:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                             </div>
                         </Link>
                     ))}
                 </div>
             </div>
        </div>
    )
}

