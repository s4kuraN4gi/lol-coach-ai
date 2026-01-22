"use client";

import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";
import { useTranslation } from "@/contexts/LanguageContext";

export default function NemesisWidget({ stats }: { stats: UniqueStats | null }) {
    const { t } = useTranslation();
    
    if (!stats) return <DashboardCard>{t('widgets.nemesis.noData')}</DashboardCard>;

    return (
        <DashboardCard className="relative  group hover:border-red-500/30 transition-all duration-500">
             <div className="flex items-center mb-3">
                <div className="p-2 bg-red-500/10 rounded-lg mr-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <span className="text-xl">😈</span>
                </div>
                <div>
                     <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        {t('widgets.nemesis.title')}
                        <InfoTooltip content={{
                            what: t('tooltip.nemesis.what'),
                            why: t('tooltip.nemesis.why'),
                            how: t('tooltip.nemesis.how')
                        }} />
                     </h3>
                     <p className="text-xs text-slate-500">{t('widgets.nemesis.subtitle')}</p>
                </div>
             </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Nemesis (Worst WR) */}
                <div>
                    <div className="text-[10px] items-center gap-1 text-red-400 font-bold mb-2 flex tracking-wider">
                        <span>{t('widgets.nemesis.nemesisLabel')}</span>
                    </div>
                    <div className="space-y-2">
                        {stats.nemesis.map(c => (
                            <div key={c.name} className="flex items-center gap-2 bg-slate-800/30 p-1.5 rounded border border-red-500/10 hover:bg-red-900/10 transition-colors">
                                <div className="w-8 h-8 rounded-md  ring-1 ring-red-500/30">
                                     <img src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${c.name}.png`} alt={c.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-slate-300 leading-none truncate">{c.name}</div>
                                    <div className="text-[9px] text-red-400 font-mono mt-0.5">{c.winRate}% ({c.games} {t('widgets.nemesis.games')})</div>
                                </div>
                            </div>
                        ))}
                        {stats.nemesis.length === 0 && <div className="text-[10px] text-slate-600 italic">{t('widgets.nemesis.noNemesis')}</div>}
                    </div>
                </div>

                {/* Prey (Best WR) */}
                <div>
                     <div className="text-[10px] items-center gap-1 text-emerald-400 font-bold mb-2 flex tracking-wider">
                        <span>{t('widgets.nemesis.preyLabel')}</span>
                     </div>
                     <div className="space-y-2">
                        {stats.prey.map(c => (
                            <div key={c.name} className="flex items-center gap-2 bg-slate-800/30 p-1.5 rounded border border-emerald-500/10 hover:bg-emerald-900/10 transition-colors">
                                <div className="w-8 h-8 rounded-md  ring-1 ring-emerald-500/30">
                                     <img src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${c.name}.png`} alt={c.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-slate-300 leading-none truncate">{c.name}</div>
                                    <div className="text-[9px] text-emerald-400 font-mono mt-0.5">{c.winRate}% ({c.games} {t('widgets.nemesis.games')})</div>
                                </div>
                            </div>
                        ))}
                         {stats.prey.length === 0 && <div className="text-[10px] text-slate-600 italic">{t('widgets.nemesis.noPrey')}</div>}
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}

