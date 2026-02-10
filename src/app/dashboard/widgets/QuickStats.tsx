"use client";

import { QuickStats as QuickStatsType } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import { useTranslation } from "@/contexts/LanguageContext";
import { GiSwordman, GiEyeTarget, GiCrossedSwords, GiHealthNormal } from "react-icons/gi";
import { FaChartLine } from "react-icons/fa";

type Props = {
    stats: QuickStatsType | null;
};

type StatItem = {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
};

export default function QuickStats({ stats }: Props) {
    const { t } = useTranslation();

    if (!stats) {
        return (
            <DashboardCard className="h-full">
                <div className="flex items-center justify-center h-full">
                    <span className="text-slate-500 text-sm">{t('widgets.quickStats.noData')}</span>
                </div>
            </DashboardCard>
        );
    }

    const statItems: StatItem[] = [
        {
            icon: <GiSwordman className="text-red-400" />,
            label: t('widgets.quickStats.kda'),
            value: stats.kda,
            color: stats.kda >= 3 ? 'text-yellow-400' : stats.kda >= 2 ? 'text-blue-400' : 'text-slate-300'
        },
        {
            icon: <GiCrossedSwords className="text-orange-400" />,
            label: t('widgets.quickStats.killParticipation'),
            value: `${stats.killParticipation}%`,
            color: stats.killParticipation >= 60 ? 'text-yellow-400' : stats.killParticipation >= 50 ? 'text-blue-400' : 'text-slate-300'
        },
        {
            icon: <FaChartLine className="text-emerald-400" />,
            label: t('widgets.quickStats.csPerMin'),
            value: stats.csPerMin,
            color: stats.csPerMin >= 8 ? 'text-yellow-400' : stats.csPerMin >= 6 ? 'text-blue-400' : 'text-slate-300'
        },
        {
            icon: <GiEyeTarget className="text-blue-400" />,
            label: t('widgets.quickStats.visionPerMin'),
            value: stats.visionPerMin,
            color: stats.visionPerMin >= 1.0 ? 'text-yellow-400' : stats.visionPerMin >= 0.7 ? 'text-blue-400' : 'text-slate-300'
        },
    ];

    return (
        <DashboardCard className="h-full relative group hover:border-blue-500/30 transition-all duration-500">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg">
                    <span className="text-lg">📊</span>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-200">
                        {t('widgets.quickStats.title')}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                        {t('widgets.quickStats.subtitle').replace('{games}', String(stats.gamesAnalyzed))}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {statItems.map((item, index) => (
                    <div
                        key={index}
                        className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{item.icon}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{item.label}</span>
                        </div>
                        <div className={`text-xl font-black ${item.color}`}>
                            {item.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Average Damage (Full Width) */}
            <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GiHealthNormal className="text-purple-400" />
                        <span className="text-[10px] text-slate-400 font-medium">{t('widgets.quickStats.avgDamage')}</span>
                    </div>
                    <div className={`text-lg font-black ${stats.avgDamage >= 20000 ? 'text-yellow-400' : stats.avgDamage >= 15000 ? 'text-blue-400' : 'text-slate-300'}`}>
                        {(stats.avgDamage / 1000).toFixed(1)}k
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}
