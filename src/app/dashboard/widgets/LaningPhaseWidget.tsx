"use client";

import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";
import { useTranslation } from "@/contexts/LanguageContext";

export default function LaningPhaseWidget({ stats, matchCount }: { stats: UniqueStats | null, matchCount: number }) {
    const { t } = useTranslation();
    
    if (!stats) return <DashboardCard><div className="animate-pulse h-32 bg-slate-800 rounded"></div></DashboardCard>;

    // CS Advantage (Higher is Better)
    const val = stats.survival.csAdvantage; // Renamed from soloDeathRate
    const isGood = val >= 10;
    const isBad = val < 0;

    return (
        <DashboardCard>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
                        ⚔️
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-400 tracking-wider">{t('widgets.laningPhase.title')}</h3>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400 font-mono">
                                {t('widgets.laningPhase.last')} {matchCount}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">{t('widgets.laningPhase.subtitle')}</p>
                    </div>
                </div>
                <InfoTooltip 
                    content={{
                        what: t('tooltip.laningPhase.what'),
                        why: t('tooltip.laningPhase.why'),
                        how: t('tooltip.laningPhase.how')
                    }}
                />
            </div>

            <div className="grid grid-cols-2 gap-2 divide-x divide-slate-700/50 mt-2">
                {/* Left: Offense (CS Advantage) */}
                <div className="flex flex-col items-center justify-center pb-2">
                    <div className="relative w-16 h-16 mb-2 group">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="3"
                            />
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={isGood ? "#4ade80" : isBad ? "#ef4444" : "#facc15"}
                                strokeWidth="3"
                                strokeDasharray={`${Math.min(100, Math.max(0, val + 50))}, 100`} 
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className={`absolute inset-0 flex items-center justify-center font-black text-sm ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                            {val > 0 ? "+" : ""}{val}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('widgets.laningPhase.csAdvantage')}</div>
                        <div className={`text-[10px] ${isGood ? "text-emerald-400" : isBad ? "text-rose-400" : "text-yellow-400"}`}>
                            {isGood ? t('widgets.laningPhase.dominating') : isBad ? t('widgets.laningPhase.behind') : t('widgets.laningPhase.even')}
                        </div>
                    </div>
                </div>

                {/* Right: Offense (CS @ 10) */}
                <div className="flex flex-col items-center justify-center pb-2 pl-2">
                     <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-slate-100 tracking-tighter leading-none">
                            {stats.survival.csAt10}
                        </span>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1">
                            CS @ 10m
                        </span>
                     </div>
                     
                     <div className="w-full max-w-[80px] mt-2">
                        <div className="flex justify-between text-[9px] text-slate-500 mb-0.5 font-mono">
                            <span>{t('widgets.skillRadar.avg')}</span>
                            <span>{t('widgets.laningPhase.target')}: 80</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(100, (stats.survival.csAt10 / 80) * 100)}%` }}
                            ></div>
                        </div>
                     </div>
                </div>
            </div>
        </DashboardCard>
    );
}

