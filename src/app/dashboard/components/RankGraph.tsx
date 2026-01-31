'use client'

import { useState, useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { useTranslation } from "@/contexts/LanguageContext";
import { type RankHistoryEntry } from "@/app/actions/stats";
import { rankToNumericValue, getTierColor, formatTierLabel } from "@/utils/rankUtils";

type HistoryItem = {
    id: string;
    date: string;
    result: string;
    kda: string;
    gameDuration: number;
    cs: number;
    vision: number;
    damage: number;
    gold: number;
}

type Props = {
    histories: HistoryItem[];
    rankHistory: RankHistoryEntry[];
}

export default function RankGraph({ histories, rankHistory }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"STYLE" | "RANK">("RANK");

    // Calculate Radar Data from histories
    const radarData = useMemo(() => {
        if (histories.length === 0) return [
            { subject: 'Combats', A: 0, fullMark: 100 },
            { subject: 'Farming', A: 0, fullMark: 100 },
            { subject: 'Vision', A: 0, fullMark: 100 },
            { subject: 'Survival', A: 0, fullMark: 100 },
            { subject: 'Gold', A: 0, fullMark: 100 },
        ];

        let totalKDA = 0;
        let totalCSM = 0;
        let totalVisionM = 0;
        let totalDPM = 0;
        let totalGPM = 0;

        histories.forEach(h => {
             const durationMin = Math.max(h.gameDuration / 60, 1);
             const [k, d, a] = h.kda.split('/').map(Number);

             // KDA Ratio (K+A) / D (avoid div by 0)
             const kdaVal = (k + a) / Math.max(d, 1);
             totalKDA += kdaVal;

             totalCSM += h.cs / durationMin;
             totalVisionM += h.vision / durationMin;
             totalDPM += h.damage / durationMin;
             totalGPM += h.gold / durationMin;
        });

        const count = histories.length;
        const avgKDA = totalKDA / count;
        const avgCSM = totalCSM / count;
        const avgVisionM = totalVisionM / count;
        const avgDPM = totalDPM / count;
        const avgGPM = totalGPM / count;

        const normalize = (val: number, max: number) => Math.min(Math.round((val / max) * 100), 100);

        return [
            { subject: 'KDA', A: normalize(avgKDA, 5), fullMark: 100 },
            { subject: 'Farming', A: normalize(avgCSM, 10), fullMark: 100 },
            { subject: 'Vision', A: normalize(avgVisionM, 1.5), fullMark: 100 },
            { subject: 'Damage', A: normalize(avgDPM, 800), fullMark: 100 },
            { subject: 'Gold', A: normalize(avgGPM, 500), fullMark: 100 },
        ];
    }, [histories]);

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
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col h-full min-h-[350px]">

        {/* Header & Tabs */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex bg-slate-900/50 rounded-lg p-1 border border-slate-700">
                <button
                    onClick={() => setActiveTab("RANK")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${activeTab === "RANK" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                >
                    <span>📈</span> {t('widgets.rankGraph.rankHistory')}
                </button>
                <button
                    onClick={() => setActiveTab("STYLE")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${activeTab === "STYLE" ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                >
                    <span>📊</span> {t('widgets.rankGraph.playstyle')}
                </button>
            </div>

            {/* LP Change Badge */}
            {activeTab === "RANK" && rankChartData.length >= 2 && (
                <div className={`text-xs font-bold px-2 py-1 rounded ${lpChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {lpChange >= 0 ? '+' : ''}{lpChange} LP ({t('widgets.rankGraph.lpChange').replace('{days}', String(rankHistory.length))})
                </div>
            )}
        </div>

        {/* Chart Content */}
        <div className="flex-1 w-full h-full flex items-center justify-center">
            {activeTab === "STYLE" ? (
                <div className="w-full h-[250px]">
                     {histories.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name="My Style"
                                    dataKey="A"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    fill="#8b5cf6"
                                    fillOpacity={0.4}
                                />
                                <RechartsTooltip
                                    contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc', borderRadius: '8px'}}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                     ) : (
                         <div className="h-full flex items-center justify-center">
                             <div className="text-center text-slate-500 text-sm">
                                 {t('widgets.rankGraph.noMatchData')}
                             </div>
                         </div>
                     )}
                </div>
            ) : (
                <div className="w-full h-[250px] flex items-center justify-center relative">
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
            )}
        </div>
    </div>
  )
}
