"use client";

import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";
import { useTranslation } from "@/contexts/LanguageContext";

export default function ClutchWidget({ stats }: { stats: UniqueStats | null }) {
    const { t } = useTranslation();
    
    if (!stats) return <DashboardCard>{t('widgets.clutch.noData')}</DashboardCard>;

    const { clutch } = stats;

    const getColor = (wr: number) => {
        if (wr >= 60) return "text-yellow-400 font-bold";
        if (wr >= 50) return "text-emerald-400";
        return "text-rose-400";
    };

    const getBarColor = (wr: number) => {
         if (wr >= 60) return "bg-yellow-500";
         if (wr >= 50) return "bg-emerald-500";
         return "bg-rose-500";
    };

    return (
        <DashboardCard className="relative  group hover:border-blue-500/30 transition-all duration-500">
             <div className="flex items-center mb-3">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <span className="text-xl">⚖️</span>
                </div>
                <div>
                     <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        {t('widgets.clutch.title')}
                        <InfoTooltip content={{
                            what: t('tooltip.clutch.what'),
                            why: t('tooltip.clutch.why'),
                            how: t('tooltip.clutch.how')
                        }} />
                     </h3>
                     <p className="text-xs text-slate-500">{t('widgets.clutch.subtitle')}</p>
                </div>
             </div>

            <div className="space-y-3">
                 {/* Close Games */}
                 <div>
                     <div className="flex justify-between text-xs text-slate-300 mb-1">
                         <span className="flex items-center gap-2">{t('widgets.clutch.closeGames')}</span>
                         <span className={getColor(clutch.closeWr)}>{clutch.closeWr}% WR ({clutch.closeGames})</span>
                     </div>
                     <div className="h-2 bg-slate-800 rounded-full ">
                         <div className={`h-full rounded-full ${getBarColor(clutch.closeWr)}`} style={{ width: `${clutch.closeWr}%` }}></div>
                     </div>
                 </div>

                 {/* Stomp Games */}
                 <div>
                     <div className="flex justify-between text-xs text-slate-300 mb-1">
                         <span className="flex items-center gap-2">{t('widgets.clutch.stompGames')}</span>
                         <span className={getColor(clutch.stompWr)}>{clutch.stompWr}% WR ({clutch.stompGames})</span>
                     </div>
                     <div className="h-2 bg-slate-800 rounded-full ">
                         <div className={`h-full rounded-full ${getBarColor(clutch.stompWr)}`} style={{ width: `${clutch.stompWr}%` }}></div>
                     </div>
                 </div>
                 
                 <div className="p-2 bg-slate-800/50 rounded text-[10px] text-slate-400 text-center italic mt-2">
                     {clutch.closeWr > clutch.stompWr + 10 ? t('widgets.clutch.icyUnderPressure') : t('widgets.clutch.relyOnSnowball')}
                 </div>
            </div>
        </DashboardCard>
    );
}

