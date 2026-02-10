"use client";

import { useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardCard from "../components/DashboardCard";
import { type RadarStats, type CoachFeedbackSummary } from "@/app/actions/stats";
import { FaLightbulb } from "react-icons/fa";
import { GiSwordClash, GiEyeTarget, GiGoldBar, GiHeartShield, GiCrossedSwords } from "react-icons/gi";

type Props = {
    radarStats: RadarStats | null;
    coachFeedback: CoachFeedbackSummary | null;
    recentWinRate: number; // Last 10 games win rate
};

type FocusTip = {
    icon: React.ReactNode;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'vision' | 'combat' | 'farming' | 'objective' | 'survival' | 'macro' | 'micro';
};

// Generate focus tips based on stats
function generateFocusTips(
    radarStats: RadarStats | null,
    coachFeedback: CoachFeedbackSummary | null,
    recentWinRate: number,
    t: (key: string) => string
): FocusTip[] {
    const tips: FocusTip[] = [];

    // Analyze radar stats for weaknesses
    if (radarStats) {
        // Vision Score is low
        if (radarStats.vision < 50) {
            tips.push({
                icon: <GiEyeTarget className="text-blue-400" />,
                title: t('widgets.nextFocus.tips.vision.title'),
                description: t('widgets.nextFocus.tips.vision.desc'),
                priority: radarStats.vision < 30 ? 'high' : 'medium',
                category: 'vision'
            });
        }

        // Farming is low
        if (radarStats.farming < 50) {
            tips.push({
                icon: <GiGoldBar className="text-yellow-400" />,
                title: t('widgets.nextFocus.tips.farming.title'),
                description: t('widgets.nextFocus.tips.farming.desc'),
                priority: radarStats.farming < 30 ? 'high' : 'medium',
                category: 'farming'
            });
        }

        // Survival is low (dies too much)
        if (radarStats.survival < 50) {
            tips.push({
                icon: <GiHeartShield className="text-red-400" />,
                title: t('widgets.nextFocus.tips.survival.title'),
                description: t('widgets.nextFocus.tips.survival.desc'),
                priority: radarStats.survival < 30 ? 'high' : 'medium',
                category: 'survival'
            });
        }

        // Objective damage is low
        if (radarStats.objective < 40) {
            tips.push({
                icon: <GiCrossedSwords className="text-purple-400" />,
                title: t('widgets.nextFocus.tips.objective.title'),
                description: t('widgets.nextFocus.tips.objective.desc'),
                priority: 'medium',
                category: 'objective'
            });
        }
    }

    // Add tips from AI coach feedback
    if (coachFeedback) {
        // Top macro issue
        if (coachFeedback.macroIssues.length > 0) {
            const topMacro = coachFeedback.macroIssues[0];
            tips.push({
                icon: <FaLightbulb className="text-emerald-400" />,
                title: `${t('widgets.nextFocus.tips.macro.title')}: ${topMacro.concept}`,
                description: t('widgets.nextFocus.tips.macro.desc'),
                priority: topMacro.count >= 3 ? 'high' : 'medium',
                category: 'macro'
            });
        }

        // Top micro issue
        if (coachFeedback.microIssues.length > 0) {
            const topMicro = coachFeedback.microIssues[0];
            tips.push({
                icon: <GiSwordClash className="text-orange-400" />,
                title: `${t('widgets.nextFocus.tips.micro.title')}: ${topMicro.category}`,
                description: t('widgets.nextFocus.tips.micro.desc'),
                priority: topMicro.count >= 3 ? 'high' : 'medium',
                category: 'micro'
            });
        }
    }

    // Losing streak tip
    if (recentWinRate < 40) {
        tips.push({
            icon: <GiHeartShield className="text-cyan-400" />,
            title: t('widgets.nextFocus.tips.mental.title'),
            description: t('widgets.nextFocus.tips.mental.desc'),
            priority: 'high',
            category: 'survival'
        });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tips.slice(0, 3); // Return top 3 tips
}

export default function NextGameFocus({ radarStats, coachFeedback, recentWinRate }: Props) {
    const { t } = useTranslation();

    const tips = useMemo(() =>
        generateFocusTips(radarStats, coachFeedback, recentWinRate, t),
        [radarStats, coachFeedback, recentWinRate, t]
    );

    const priorityColors = {
        high: 'border-red-500/30 bg-red-500/5',
        medium: 'border-amber-500/30 bg-amber-500/5',
        low: 'border-slate-500/30 bg-slate-500/5'
    };

    const priorityBadgeColors = {
        high: 'bg-red-500/20 text-red-400',
        medium: 'bg-amber-500/20 text-amber-400',
        low: 'bg-slate-500/20 text-slate-400'
    };

    return (
        <DashboardCard className="relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 h-full w-full">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-lg">
                    <span className="text-xl">💡</span>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-200">
                        {t('widgets.nextFocus.title')}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {t('widgets.nextFocus.subtitle')}
                    </p>
                </div>
            </div>

            {/* Tips */}
            {tips.length > 0 ? (
                <div className="space-y-2">
                    {tips.map((tip, index) => (
                        <div
                            key={index}
                            className={`p-3 rounded-lg border transition-all duration-300 hover:scale-[1.02] ${priorityColors[tip.priority]}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-lg mt-0.5 shrink-0">
                                    {tip.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-200 truncate">
                                            {tip.title}
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${priorityBadgeColors[tip.priority]}`}>
                                            {tip.priority === 'high' ? t('widgets.nextFocus.priority.high') :
                                             tip.priority === 'medium' ? t('widgets.nextFocus.priority.medium') :
                                             t('widgets.nextFocus.priority.low')}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {tip.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6">
                    <div className="text-3xl mb-2">✨</div>
                    <p className="text-sm text-slate-400">
                        {t('widgets.nextFocus.noTips')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {t('widgets.nextFocus.keepPlaying')}
                    </p>
                </div>
            )}
        </DashboardCard>
    );
}
