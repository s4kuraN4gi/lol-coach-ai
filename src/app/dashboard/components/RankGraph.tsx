'use client'

import { useState, useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

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

export default function RankGraph({ histories }: { histories: HistoryItem[] }) {
    const [activeTab, setActiveTab] = useState<"STYLE" | "RANK">("STYLE");
    const [showTooltip, setShowTooltip] = useState(false);

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

        // Normalization (Benchmarks roughly based on Plat+ average)
        // KDA: 3.0 = 60, 5.0 = 100
        // CSM: 6.0 = 60, 10.0 = 100
        // Vision: 0.5 = ?, 1.0 = 60, 2.0 = 100 (Support biases this, but ok)
        // DPM: 400 = 60, 700 = 100
        // GPM: 300 = 60, 500 = 100

        const normalize = (val: number, max: number) => Math.min(Math.round((val / max) * 100), 100);

        return [
            { subject: 'KDA', A: normalize(avgKDA, 5), fullMark: 100 },
            { subject: 'Farming', A: normalize(avgCSM, 10), fullMark: 100 },
            { subject: 'Vision', A: normalize(avgVisionM, 1.5), fullMark: 100 },
            { subject: 'Damage', A: normalize(avgDPM, 800), fullMark: 100 },
            { subject: 'Gold', A: normalize(avgGPM, 500), fullMark: 100 },
        ];
    }, [histories]);

    // Mock Rank Data (Placeholder)
    const rankData = [
        {date: "Start", rank: 0},
        {date: "Now", rank: 0},
    ];

  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col h-full min-h-[350px]">
        
        {/* Header & Tabs */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex bg-slate-900/50 rounded-lg p-1 border border-slate-700">
                <button 
                    onClick={() => setActiveTab("STYLE")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${activeTab === "STYLE" ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                >
                    <span>📊</span> PLAYSTYLE
                </button>
                <button 
                    onClick={() => setActiveTab("RANK")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${activeTab === "RANK" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                >
                    <span>📈</span> RANK HISTORY
                </button>
            </div>
            {activeTab === "RANK" && (
                <div className="relative group">
                    <button 
                         onClick={() => setShowTooltip(!showTooltip)}
                         onMouseEnter={() => setShowTooltip(true)}
                         onMouseLeave={() => setShowTooltip(false)}
                         className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-600 cursor-help"
                    >
                        ?
                    </button>
                    {/* Tooltip */}
                    <div className={`absolute top-full right-0 mt-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-300 transition-all z-20 ${showTooltip ? "opacity-100 visible" : "opacity-0 invisible"}`}>
                        <p className="font-bold text-yellow-400 mb-1">Coming Soon!</p>
                        ランク推移グラフを表示するには、日々のランクデータの蓄積が必要です。現在、システムのバックグラウンドで今後のデータを収集中です。
                    </div>
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
                         <div className="text-center text-slate-500 text-sm mt-10">
                             対戦履歴を取得すると分析が表示されます
                         </div>
                     )}
                </div>
            ) : (
                <div className="w-full h-[250px] flex items-center justify-center relative">
                    {/* Placeholder Graph */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[{d:1, v:50}, {d:2, v:52}, {d:3, v:51},{d:4, v:55}]}>
                                <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            </LineChart>
                         </ResponsiveContainer>
                    </div>
                    <div className="text-center p-4 bg-slate-900/80 rounded-lg border border-dashed border-slate-700 z-10 backdrop-blur-sm">
                        <p className="text-slate-400 font-bold mb-1">DATA COLLECTING...</p>
                        <p className="text-xs text-slate-500">明日以降、データが蓄積されると<br/>グラフが表示されます。</p>
                    </div>
                </div>
            )}
        </div>
    </div>
  )
}


