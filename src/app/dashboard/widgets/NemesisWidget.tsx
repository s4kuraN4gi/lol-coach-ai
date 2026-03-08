"use client";

import Image from "next/image";
import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";
import { useTranslation } from "@/contexts/LanguageContext";
import { useDDragonVersion } from "@/hooks/useDDragonVersion";
import Link from "next/link";

type MatchupData = {
    name: string;
    wins: number;
    games: number;
    winRate: number;
};

function MatchupCard({
    champ,
    type,
    version
}: {
    champ: MatchupData;
    type: 'nemesis' | 'prey';
    version: string;
}) {
    const losses = champ.games - champ.wins;
    const isNemesis = type === 'nemesis';

    return (
        <div className={`bg-slate-800/40 rounded-lg p-2.5 border transition-all duration-300 group/card ${isNemesis ? 'border-red-500/10 hover:border-red-500/30' : 'border-emerald-500/10 hover:border-emerald-500/30'}`}>
            <div className="flex items-center gap-2.5">
                {/* Champion Icon */}
                <div className={`relative w-10 h-10 rounded-lg overflow-hidden ring-2 transition-all ${isNemesis ? 'ring-red-500/30 group-hover/card:ring-red-500/50' : 'ring-emerald-500/30 group-hover/card:ring-emerald-500/50'}`}>
                    <Image
                        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.name}.png`}
                        alt={champ.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-200 truncate">{champ.name}</span>
                        <span className={`text-xs font-bold ${isNemesis ? 'text-red-400' : 'text-emerald-400'}`}>
                            {champ.winRate}%
                        </span>
                    </div>

                    {/* Win Rate Bar */}
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
                        <div
                            className={`h-full transition-all duration-500 ${isNemesis ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                            style={{ width: `${champ.winRate}%` }}
                        />
                    </div>

                    {/* Win/Loss Detail */}
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-emerald-400 font-medium">{champ.wins}W</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-red-400 font-medium">{losses}L</span>
                        <span className="text-slate-400 ml-auto">{champ.games}G</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NemesisWidget({ stats }: { stats: UniqueStats | null }) {
    const { t } = useTranslation();
    const version = useDDragonVersion();

    if (!stats) return (
        <DashboardCard className="h-full">
            <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-slate-400 text-sm">{t('widgets.nemesis.noData')}</span>
                <Link href="/dashboard/coach" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition">
                    {t('widgets.common.tryCoaching', 'Try AI Coaching →')}
                </Link>
            </div>
        </DashboardCard>
    );

    const hasData = stats.nemesis.length > 0 || stats.prey.length > 0;

    return (
        <DashboardCard className="relative group hover:border-purple-500/30 transition-all duration-500 h-full">
            {/* Header */}
            <div className="flex items-center mb-4">
                <div className="p-2 bg-gradient-to-br from-red-500/20 to-emerald-500/20 rounded-lg mr-3">
                    <span className="text-xl">⚔️</span>
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
                    <p className="text-xs text-slate-400">{t('widgets.nemesis.subtitle')}</p>
                </div>
            </div>

            {hasData ? (
                <div className="grid grid-cols-2 gap-3">
                    {/* Nemesis Column */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-red-400 text-sm">👎</span>
                            <span className="text-[10px] text-red-400 font-bold tracking-wider uppercase">
                                {t('widgets.nemesis.nemesisLabel')}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {stats.nemesis.slice(0, 3).map(c => (
                                <MatchupCard key={c.name} champ={c} type="nemesis" version={version} />
                            ))}
                            {stats.nemesis.length === 0 && (
                                <div className="text-[10px] text-slate-600 italic p-2">
                                    {t('widgets.nemesis.noNemesis')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prey Column */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-emerald-400 text-sm">👍</span>
                            <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">
                                {t('widgets.nemesis.preyLabel')}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {stats.prey.slice(0, 3).map(c => (
                                <MatchupCard key={c.name} champ={c} type="prey" version={version} />
                            ))}
                            {stats.prey.length === 0 && (
                                <div className="text-[10px] text-slate-600 italic p-2">
                                    {t('widgets.nemesis.noPrey')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <span className="text-slate-400 text-sm">{t('widgets.nemesis.noData')}</span>
                    <Link href="/dashboard/coach" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition">
                        {t('widgets.common.tryCoaching', 'Try AI Coaching →')}
                    </Link>
                </div>
            )}
        </DashboardCard>
    );
}

