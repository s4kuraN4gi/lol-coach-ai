'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslation } from '@/contexts/LanguageContext';
import { FaChartLine, FaLightbulb, FaMap, FaCrosshairs } from 'react-icons/fa';

type RankInfo = {
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
} | null;

type RecentMatch = {
    win: boolean;
    timestamp: number;
};

type MonthlyStats = {
    month: string;
    rankedGames: number;
    wins: number;
    losses: number;
    winRate: number;
} | null;

type CoachFeedback = {
    macroAnalyses: number;
    microAnalyses: number;
    macroIssues: { concept: string; count: number }[];
    microIssues: { category: string; count: number }[];
} | null;

type RoleStats = {
    TOP: number;
    JUNGLE: number;
    MIDDLE: number;
    BOTTOM: number;
    UTILITY: number;
} | null;

type ChampionStat = {
    name: string;
    games: number;
    wins: number;
    winRate: number;
};

type ProfileCardProps = {
    summoner: {
        name: string;
        tagLine: string | null;
        profileIconId: number;
        summonerLevel: number;
    };
    rankInfo?: RankInfo;
    recentMatches?: RecentMatch[];
    monthlyStats?: MonthlyStats;
    coachFeedback?: CoachFeedback;
    roleStats?: RoleStats;
    topChampions?: ChampionStat[];
};

// Tier color mapping
const getTierColor = (tier: string | null): string => {
    if (!tier) return '#64748b';
    const colors: Record<string, string> = {
        'IRON': '#5c4033',
        'BRONZE': '#cd7f32',
        'SILVER': '#c0c0c0',
        'GOLD': '#ffd700',
        'PLATINUM': '#00cec9',
        'EMERALD': '#2ecc71',
        'DIAMOND': '#b9f2ff',
        'MASTER': '#9b59b6',
        'GRANDMASTER': '#e74c3c',
        'CHALLENGER': '#f1c40f',
    };
    return colors[tier.toUpperCase()] || '#64748b';
};

// Role icons and colors
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    TOP: { label: 'TOP', color: 'bg-amber-500' },
    JUNGLE: { label: 'JG', color: 'bg-green-500' },
    MIDDLE: { label: 'MID', color: 'bg-blue-500' },
    BOTTOM: { label: 'ADC', color: 'bg-red-500' },
    UTILITY: { label: 'SUP', color: 'bg-pink-500' },
};

export default function ProfileCard({
    summoner,
    rankInfo,
    recentMatches = [],
    monthlyStats,
    coachFeedback,
    roleStats,
    topChampions = []
}: ProfileCardProps) {
    const { t } = useTranslation();
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${summoner.profileIconId}.png`;

    // Calculate recent form (last 10 games)
    const last10 = recentMatches.slice(0, 10);
    const recentWins = last10.filter(m => m.win).length;
    const recentWinRate = last10.length > 0 ? Math.round((recentWins / last10.length) * 100) : 0;

    // Calculate win/lose streak
    let streak = 0;
    let streakType: 'win' | 'loss' | null = null;
    for (const match of recentMatches) {
        if (streakType === null) {
            streakType = match.win ? 'win' : 'loss';
            streak = 1;
        } else if ((match.win && streakType === 'win') || (!match.win && streakType === 'loss')) {
            streak++;
        } else {
            break;
        }
    }

    // Format month for display
    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        return `${year}/${month}`;
    };

    // Calculate role distribution
    const totalRoleGames = roleStats
        ? Object.values(roleStats).reduce((a, b) => a + b, 0)
        : 0;

    // Get most played role
    const getMostPlayedRole = () => {
        if (!roleStats || totalRoleGames === 0) return null;
        const entries = Object.entries(roleStats) as [keyof typeof ROLE_CONFIG, number][];
        const sorted = entries.sort((a, b) => b[1] - a[1]);
        return sorted[0];
    };

    const mostPlayedRole = getMostPlayedRole();

    return (
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group h-full">
            {/* Background Glow Effect */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none" />
            {rankInfo && (
                <div
                    className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-20"
                    style={{ backgroundColor: getTierColor(rankInfo.tier) }}
                />
            )}

            {/* Main Content */}
            <div className="relative z-10">
                {/* Top Row: Icon + Name + Rank Info */}
                <div className="flex items-center justify-between mb-4">
                    {/* Left: Icon + Name */}
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Profile Icon */}
                        <div className="relative shrink-0">
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition duration-500"></div>
                            <Image
                                src={iconUrl}
                                alt="Profile Icon"
                                width={64}
                                height={64}
                                className="relative w-16 h-16 rounded-full border-2 border-slate-900 bg-slate-900 z-10"
                            />
                            <span className="absolute -bottom-1 -right-1 bg-slate-800 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-600 z-20 shadow-lg">
                                {summoner.summonerLevel}
                            </span>
                        </div>

                        {/* Name + Tag */}
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight truncate">
                                {summoner.name}
                            </h2>
                            {summoner.tagLine && (
                                <p className="text-sm text-slate-500 font-medium font-mono">#{summoner.tagLine}</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Rank Info */}
                    {rankInfo && (
                        <div className="shrink-0 text-right ml-4">
                            <div className="font-black text-xl tracking-wide" style={{ color: getTierColor(rankInfo.tier) }}>
                                {rankInfo.tier} {rankInfo.rank}
                            </div>
                            <div className="text-slate-300 text-lg font-bold">
                                {rankInfo.leaguePoints} LP
                            </div>
                            <div className="text-xs text-slate-400">
                                {rankInfo.wins}W {rankInfo.losses}L
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-700/50 mb-4" />

                {/* Middle Row: Recent Form */}
                {last10.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-medium">{t('widgets.profileCard.recentForm')}</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${recentWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                    {recentWinRate}%
                                </span>
                                {streak >= 2 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        streakType === 'win'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {streak}{streakType === 'win' ? 'W' : 'L'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {last10.map((match, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 h-2 rounded-full ${
                                        match.win ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                />
                            ))}
                            {/* Fill empty slots if less than 10 games */}
                            {Array.from({ length: 10 - last10.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="flex-1 h-2 rounded-full bg-slate-700" />
                            ))}
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-slate-500">
                                {recentWins}W {last10.length - recentWins}L
                            </span>
                        </div>
                    </div>
                )}

                {/* New Row: Role Distribution + Top Champions */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Role Distribution */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs">🎯</span>
                            <span className="text-xs text-slate-400 font-medium">{t('widgets.profileCard.roleDistribution')}</span>
                        </div>
                        {roleStats && totalRoleGames > 0 ? (
                            <div className="space-y-1.5">
                                {/* Role Bars */}
                                <div className="flex gap-0.5 h-3 rounded overflow-hidden">
                                    {(Object.entries(roleStats) as [keyof typeof ROLE_CONFIG, number][])
                                        .filter(([_, count]) => count > 0)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([role, count]) => (
                                            <div
                                                key={role}
                                                className={`${ROLE_CONFIG[role].color} transition-all`}
                                                style={{ width: `${(count / totalRoleGames) * 100}%` }}
                                                title={`${ROLE_CONFIG[role].label}: ${count} games (${Math.round((count / totalRoleGames) * 100)}%)`}
                                            />
                                        ))
                                    }
                                </div>
                                {/* Most Played */}
                                {mostPlayedRole && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500">{t('widgets.profileCard.mostPlayed')}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ROLE_CONFIG[mostPlayedRole[0]].color} text-white`}>
                                            {ROLE_CONFIG[mostPlayedRole[0]].label} ({Math.round((mostPlayedRole[1] / totalRoleGames) * 100)}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 text-[10px] py-2">
                                {t('widgets.profileCard.noData')}
                            </div>
                        )}
                    </div>

                    {/* Top Champions */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs">⭐</span>
                            <span className="text-xs text-slate-400 font-medium">{t('widgets.profileCard.topChampions')}</span>
                        </div>
                        {topChampions.length > 0 ? (
                            <div className="flex items-center gap-2">
                                {topChampions.slice(0, 3).map((champ, i) => (
                                    <div key={champ.name} className="relative group/champ">
                                        <Image
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${champ.name}.png`}
                                            alt={champ.name}
                                            width={40}
                                            height={40}
                                            className={`w-10 h-10 rounded-lg border-2 ${
                                                i === 0 ? 'border-yellow-500' : i === 1 ? 'border-slate-400' : 'border-orange-700'
                                            }`}
                                        />
                                        <span className={`absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded ${
                                            champ.winRate >= 60 ? 'bg-yellow-500 text-black' :
                                            champ.winRate >= 50 ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-300'
                                        }`}>
                                            {champ.winRate}%
                                        </span>
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover/champ:opacity-100 transition-opacity pointer-events-none z-50">
                                            <div className="font-bold text-slate-200">{champ.name}</div>
                                            <div className="text-slate-400">{champ.games} {t('widgets.profileCard.games')}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 text-[10px] py-2">
                                {t('widgets.profileCard.noData')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Monthly Stats & Coach Feedback */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Monthly Ranked Stats */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <FaChartLine className="text-blue-400 text-xs" />
                            <span className="text-xs text-slate-400 font-medium">{t('widgets.profileCard.monthlyStats')}</span>
                        </div>
                        {monthlyStats && monthlyStats.rankedGames > 0 ? (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-500">{formatMonth(monthlyStats.month)}</span>
                                    <span className={`text-sm font-bold ${monthlyStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                        {monthlyStats.winRate}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-green-400">{monthlyStats.wins}W</span>
                                    <span className="text-slate-500">/</span>
                                    <span className="text-red-400">{monthlyStats.losses}L</span>
                                    <span className="text-slate-500 ml-auto">{monthlyStats.rankedGames} {t('widgets.profileCard.games')}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 text-[10px] py-2">
                                {t('widgets.profileCard.noMonthlyData')}
                            </div>
                        )}
                    </div>

                    {/* AI Coach Feedback - 2 Rows (Macro & Micro) */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <FaLightbulb className="text-yellow-400 text-xs" />
                            <span className="text-xs text-slate-400 font-medium">{t('widgets.profileCard.coachInsight')}</span>
                        </div>
                        {coachFeedback && (coachFeedback.macroAnalyses > 0 || coachFeedback.microAnalyses > 0) ? (
                            <div className="space-y-2">
                                {/* Macro Row */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 shrink-0">
                                        <FaMap className="text-emerald-400 text-[10px]" />
                                        <span className="text-[10px] text-emerald-400 font-medium">{t('widgets.profileCard.macro')}</span>
                                    </div>
                                    {coachFeedback.macroIssues.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 flex-1">
                                            {coachFeedback.macroIssues.slice(0, 2).map((issue, i) => (
                                                <span
                                                    key={issue.concept}
                                                    className={`text-[10px] px-1.5 py-0.5 rounded truncate max-w-[80px] ${
                                                        i === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                                                    }`}
                                                    title={issue.concept}
                                                >
                                                    {issue.concept}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-500">{t('widgets.profileCard.noData')}</span>
                                    )}
                                </div>

                                {/* Micro Row */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 shrink-0">
                                        <FaCrosshairs className="text-purple-400 text-[10px]" />
                                        <span className="text-[10px] text-purple-400 font-medium">{t('widgets.profileCard.micro')}</span>
                                    </div>
                                    {coachFeedback.microIssues.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 flex-1">
                                            {coachFeedback.microIssues.slice(0, 2).map((issue, i) => (
                                                <span
                                                    key={issue.category}
                                                    className={`text-[10px] px-1.5 py-0.5 rounded truncate max-w-[80px] ${
                                                        i === 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'
                                                    }`}
                                                    title={issue.category}
                                                >
                                                    {issue.category}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-500">{t('widgets.profileCard.noData')}</span>
                                    )}
                                </div>

                                {/* Analysis Count */}
                                <div className="text-[10px] text-slate-500 text-right pt-1 border-t border-slate-700/50">
                                    {coachFeedback.macroAnalyses + coachFeedback.microAnalyses} {t('widgets.profileCard.analysesCompleted')}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 text-[10px] py-2">
                                {t('widgets.profileCard.noCoachData')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Empty state if no data */}
                {last10.length === 0 && !rankInfo && !monthlyStats && !coachFeedback && (
                    <div className="text-center text-slate-500 text-sm py-4">
                        {t('widgets.profileCard.noData')}
                    </div>
                )}
            </div>
        </div>
    );
}
