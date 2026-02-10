'use client'

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "@/contexts/LanguageContext";
import { type RankHistoryEntry } from "@/app/actions/stats";
import { rankToNumericValue, getTierColor, formatTierLabel } from "@/utils/rankUtils";

type Props = {
    rankHistory: RankHistoryEntry[];
}

export default function RankGraph({ rankHistory }: Props) {
    const { t } = useTranslation();

    // Transform rank history for charting
    const rankChartData = useMemo(() => {
        if (rankHistory.length === 0) return [];

        return rankHistory.map(entry => ({
            date: entry.recorded_at.slice(5), // MM-DD format
            fullDate: entry.recorded_at,
            value: rankToNumericValue(entry.tier, entry.rank, entry.league_points),
            tier: entry.tier,
            rank: entry.rank,
            lp: entry.league_points,
            displayRank: entry.tier ? `${entry.tier} ${entry.rank || ''} ${entry.league_points}LP` : 'Unranked'
        }));
    }, [rankHistory]);

    // Get current tier for styling
    const currentTier = rankHistory.length > 0 ? rankHistory[rankHistory.length - 1].tier : null;
    const tierColor = getTierColor(currentTier);

    // Calculate LP change
    const lpChange = useMemo(() => {
        if (rankChartData.length < 2) return 0;
        return rankChartData[rankChartData.length - 1].value - rankChartData[0].value;
    }, [rankChartData]);

    // Render collection progress UI
    const renderCollectionProgress = () => {
        const daysCollected = rankChartData.length;
        const currentRankData = rankChartData.length > 0 ? rankChartData[rankChartData.length - 1] : null;

        return (
            <div className="w-full max-w-sm mx-auto">
                {/* Progress Card */}
                <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                    {/* Current Rank Display */}
                    {currentRankData ? (
                        <div className="text-center mb-4">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                                {t('widgets.rankGraph.currentRank')}
                            </div>
                            <div
                                className="text-2xl font-bold"
                                style={{ color: tierColor }}
                            >
                                {currentRankData.displayRank}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center mb-4">
                            <div className="text-slate-400 font-medium">
                                {t('widgets.rankGraph.collectingData')}
                            </div>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-400">{t('widgets.rankGraph.dataProgress')}</span>
                            <span className="text-xs font-medium text-slate-300">
                                {t('widgets.rankGraph.daysCollected').replace('{current}', String(daysCollected))}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(daysCollected / 2, 1) * 100}%` }}
                            />
                        </div>

                        {/* Progress Dots */}
                        <div className="flex justify-between mt-2">
                            {[1, 2].map((day) => (
                                <div key={day} className="flex items-center gap-1">
                                    <div className={`w-3 h-3 rounded-full border-2 ${
                                        daysCollected >= day
                                            ? 'bg-blue-500 border-blue-400'
                                            : 'bg-slate-700 border-slate-600'
                                    }`}>
                                        {daysCollected >= day && (
                                            <svg className="w-full h-full text-white p-0.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-[10px] ${daysCollected >= day ? 'text-slate-300' : 'text-slate-500'}`}>
                                        Day {day}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="text-center">
                        <p className="text-xs text-slate-500">
                            {daysCollected === 0
                                ? t('widgets.rankGraph.noRankData')
                                : t('widgets.rankGraph.howItWorks')
                            }
                        </p>
                    </div>
                </div>
            </div>
        );
    };

  return (
    <div className="glass-panel p-4 rounded-xl relative overflow-hidden flex flex-col h-full">

        {/* Header */}
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
                <span>📈</span>
                <span className="text-sm font-bold text-slate-300">{t('widgets.rankGraph.rankHistory')}</span>
            </div>

            {/* LP Change Badge */}
            {rankChartData.length >= 2 && (
                <div className={`text-xs font-bold px-2 py-1 rounded ${lpChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {lpChange >= 0 ? '+' : ''}{lpChange} LP ({t('widgets.rankGraph.lpChange').replace('{days}', String(rankHistory.length))})
                </div>
            )}
        </div>

        {/* Chart Content */}
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
            <div className="w-full h-full min-h-[180px] flex items-center justify-center relative">
                {rankChartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={rankChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={formatTierLabel}
                                tickLine={false}
                                domain={['dataMin - 100', 'dataMax + 100']}
                            />
                            <RechartsTooltip
                                contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc', borderRadius: '8px'}}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload[0]) {
                                        return payload[0].payload.fullDate;
                                    }
                                    return label;
                                }}
                                formatter={(value, name, props) => {
                                    return [props.payload.displayRank, t('widgets.rankGraph.rank')];
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={tierColor}
                                strokeWidth={3}
                                dot={{ fill: tierColor, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    renderCollectionProgress()
                )}
            </div>
        </div>
    </div>
  )
}
