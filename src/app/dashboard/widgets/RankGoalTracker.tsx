"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardCard from "../components/DashboardCard";
import { type RankGoal, getRankGoal, setRankGoal, clearRankGoal } from "@/app/actions/stats";
import { calculateGoalProgress } from "@/lib/rankUtils";
import RankAchievementModal from "../components/RankAchievementModal";

type RankInfo = {
    tier: string;
    rank: string;
    leaguePoints: number;
} | null;

type Props = {
    puuid: string;
    currentRank: RankInfo;
};

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const RANKS = ['IV', 'III', 'II', 'I'];

// Tier colors for styling
const TIER_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    'IRON': { bg: 'bg-stone-700', text: 'text-stone-300', border: 'border-stone-500', glow: 'shadow-stone-500/30' },
    'BRONZE': { bg: 'bg-orange-800', text: 'text-orange-300', border: 'border-orange-500', glow: 'shadow-orange-500/30' },
    'SILVER': { bg: 'bg-slate-500', text: 'text-slate-200', border: 'border-slate-400', glow: 'shadow-slate-400/30' },
    'GOLD': { bg: 'bg-yellow-600', text: 'text-yellow-200', border: 'border-yellow-400', glow: 'shadow-yellow-400/30' },
    'PLATINUM': { bg: 'bg-cyan-600', text: 'text-cyan-200', border: 'border-cyan-400', glow: 'shadow-cyan-400/30' },
    'EMERALD': { bg: 'bg-emerald-600', text: 'text-emerald-200', border: 'border-emerald-400', glow: 'shadow-emerald-400/30' },
    'DIAMOND': { bg: 'bg-blue-500', text: 'text-blue-200', border: 'border-blue-300', glow: 'shadow-blue-300/30' },
    'MASTER': { bg: 'bg-purple-600', text: 'text-purple-200', border: 'border-purple-400', glow: 'shadow-purple-400/30' },
    'GRANDMASTER': { bg: 'bg-red-600', text: 'text-red-200', border: 'border-red-400', glow: 'shadow-red-400/30' },
    'CHALLENGER': { bg: 'bg-amber-500', text: 'text-amber-100', border: 'border-amber-300', glow: 'shadow-amber-300/30' },
};

export default function RankGoalTracker({ puuid, currentRank }: Props) {
    const { t } = useTranslation();
    const [goal, setGoal] = useState<RankGoal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSettingGoal, setIsSettingGoal] = useState(false);
    const [selectedTier, setSelectedTier] = useState('GOLD');
    const [selectedRank, setSelectedRank] = useState('IV');
    const [showAchievement, setShowAchievement] = useState(false);
    const [hasShownAchievement, setHasShownAchievement] = useState(false);

    // Load goal on mount
    useEffect(() => {
        const loadGoal = async () => {
            const savedGoal = await getRankGoal(puuid);
            setGoal(savedGoal);
            setIsLoading(false);
        };
        loadGoal();
    }, [puuid]);

    // Check for achievement
    useEffect(() => {
        if (goal && currentRank && !hasShownAchievement) {
            const { achieved } = calculateGoalProgress(
                currentRank.tier,
                currentRank.rank,
                currentRank.leaguePoints,
                goal.tier,
                goal.rank
            );
            if (achieved) {
                setShowAchievement(true);
                setHasShownAchievement(true);
            }
        }
    }, [goal, currentRank, hasShownAchievement]);

    const handleSetGoal = async () => {
        setIsLoading(true);
        const result = await setRankGoal(puuid, selectedTier, selectedRank);
        if (result.success) {
            setGoal({
                tier: selectedTier,
                rank: selectedRank,
                setAt: new Date().toISOString()
            });
            setIsSettingGoal(false);
        }
        setIsLoading(false);
    };

    const handleClearGoal = async () => {
        setIsLoading(true);
        await clearRankGoal(puuid);
        setGoal(null);
        setHasShownAchievement(false);
        setIsLoading(false);
    };

    // Calculate progress
    const progress = goal && currentRank
        ? calculateGoalProgress(currentRank.tier, currentRank.rank, currentRank.leaguePoints, goal.tier, goal.rank)
        : null;

    const tierColors = goal ? TIER_COLORS[goal.tier] || TIER_COLORS['IRON'] : TIER_COLORS['GOLD'];

    if (isLoading) {
        return (
            <DashboardCard className="animate-pulse">
                <div className="h-32 bg-slate-800/50 rounded-lg"></div>
            </DashboardCard>
        );
    }

    // Master+ don't have divisions
    const isMasterPlus = TIERS.indexOf(selectedTier) >= 7;

    return (
        <>
            <DashboardCard className={`relative overflow-hidden transition-all duration-500 hover:${tierColors.glow}`}>
                {/* Background Glow */}
                {goal && (
                    <div
                        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none"
                        style={{ backgroundColor: tierColors.bg.replace('bg-', '') }}
                    />
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg">
                            <span className="text-xl">🎯</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-200">
                                {t('widgets.rankGoal.title')}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {t('widgets.rankGoal.subtitle')}
                            </p>
                        </div>
                    </div>
                    {goal && !isSettingGoal && (
                        <button
                            onClick={() => setIsSettingGoal(true)}
                            className="text-[10px] text-slate-400 px-2 py-1 rounded border border-slate-700 hover:bg-slate-800/50 hover:text-slate-200 hover:border-slate-600 transition-all"
                        >
                            {t('widgets.rankGoal.edit')}
                        </button>
                    )}
                </div>

                {/* Goal Setting Mode */}
                {(isSettingGoal || !goal) && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            {/* Tier Select */}
                            <select
                                value={selectedTier}
                                onChange={(e) => {
                                    setSelectedTier(e.target.value);
                                    // Reset rank for Master+
                                    if (TIERS.indexOf(e.target.value) >= 7) {
                                        setSelectedRank('I');
                                    }
                                }}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary-500"
                            >
                                {TIERS.map(tier => (
                                    <option key={tier} value={tier}>{tier}</option>
                                ))}
                            </select>

                            {/* Rank Select (hidden for Master+) */}
                            {!isMasterPlus && (
                                <select
                                    value={selectedRank}
                                    onChange={(e) => setSelectedRank(e.target.value)}
                                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary-500"
                                >
                                    {RANKS.map(rank => (
                                        <option key={rank} value={rank}>{rank}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleSetGoal}
                                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                            >
                                {t('widgets.rankGoal.setGoal')}
                            </button>
                            {goal && (
                                <button
                                    onClick={() => setIsSettingGoal(false)}
                                    className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2 rounded-lg transition-colors"
                                >
                                    {t('widgets.rankGoal.cancel')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Goal Display Mode */}
                {goal && !isSettingGoal && (
                    <div className="space-y-4">
                        {/* Goal & Current Rank Display */}
                        <div className="flex items-center justify-between">
                            {/* Current Rank */}
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 mb-1">{t('widgets.rankGoal.current')}</div>
                                {currentRank ? (
                                    <div>
                                        <div className="text-sm font-bold text-slate-200">
                                            {currentRank.tier} {currentRank.rank}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {currentRank.leaguePoints} LP
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500">{t('widgets.rankGoal.unranked')}</div>
                                )}
                            </div>

                            {/* Arrow */}
                            <div className="text-slate-600 text-xl px-4">→</div>

                            {/* Target Rank */}
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 mb-1">{t('widgets.rankGoal.target')}</div>
                                <div className={`text-sm font-bold ${tierColors.text}`}>
                                    {goal.tier} {TIERS.indexOf(goal.tier) < 7 ? goal.rank : ''}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {progress && (
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{t('widgets.rankGoal.progress')}</span>
                                    <span className={progress.achieved ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                        {progress.achieved ? t('widgets.rankGoal.achieved') : `${progress.progress}%`}
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-1000 ${
                                            progress.achieved
                                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                : `bg-gradient-to-r from-primary-600 to-primary-400`
                                        }`}
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                                {!progress.achieved && progress.remaining > 0 && (
                                    <div className="text-[10px] text-slate-500 mt-1 text-right">
                                        {t('widgets.rankGoal.remaining').replace('{lp}', String(progress.remaining))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Clear Goal Button */}
                        {progress?.achieved && (
                            <button
                                onClick={handleClearGoal}
                                className="w-full text-xs text-slate-500 hover:text-slate-300 py-2 transition-colors"
                            >
                                {t('widgets.rankGoal.setNewGoal')}
                            </button>
                        )}
                    </div>
                )}
            </DashboardCard>

            {/* Achievement Modal */}
            {showAchievement && goal && (
                <RankAchievementModal
                    tier={goal.tier}
                    rank={goal.rank}
                    onClose={() => setShowAchievement(false)}
                />
            )}
        </>
    );
}
