"use client";

import { RadarStats } from "@/app/actions/stats";
import { useTranslation } from "@/contexts/LanguageContext";

export default function SkillRadar({ stats }: { stats: RadarStats | null }) {
    const { t } = useTranslation();
    
    if (!stats) {
        return (
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5"></div>
                 <div className="text-center relative z-10">
                     <div className="text-slate-500 font-bold mb-2">{t('widgets.skillRadar.noData')}</div>
                     <div className="text-xs text-slate-600">{t('widgets.skillRadar.noDataDesc')}</div>
                 </div>
            </div>
        )
    }

    // Radar Logic
    // 5 Axis: Top(Combat), RightTop(Objective), RightBottom(Farming), LeftBottom(Vision), LeftTop(Survival)
    // Coords at r=100
    const axes = [
        { name: t('widgets.skillRadar.axes.combat'), key: "combat", angle: -90, color: "#f87171" }, // Top
        { name: t('widgets.skillRadar.axes.objective'), key: "objective", angle: -18, color: "#fbbf24" }, // Right Top
        { name: t('widgets.skillRadar.axes.farming'), key: "farming", angle: 54, color: "#34d399" }, // Right Bottom
        { name: t('widgets.skillRadar.axes.vision'), key: "vision", angle: 126, color: "#60a5fa" }, // Left Bottom
        { name: t('widgets.skillRadar.axes.survival'), key: "survival", angle: 198, color: "#a78bfa" }, // Left Top
    ];

    const getCoord = (value: number, angle: number) => {
        const rad = (angle * Math.PI) / 180;
        const r = (value / 100) * 80; // Scale 100 to 80px radius
        return {
            x: 100 + r * Math.cos(rad),
            y: 100 + r * Math.sin(rad)
        };
    };

    const points = axes.map(axis => {
        const val = stats[axis.key as keyof RadarStats];
        const { x, y } = getCoord(val, axis.angle);
        return `${x},${y}`;
    }).join(" ");

    const avgPoints = axes.map(axis => {
        const { x, y } = getCoord(50, axis.angle); // Tier Average = 50 (Hypothetical)
        return `${x},${y}`;
    }).join(" ");

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex flex-col items-center">
            {/* Header */}
            <div className="w-full flex justify-between items-start mb-2 z-10">
                <div className="text-slate-400 text-xs font-bold tracking-wider">{t('widgets.skillRadar.title')}</div>
                <div className="text-[10px] flex gap-3">
                    <span className="flex items-center gap-1 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-blue-500/50"></span> {t('widgets.skillRadar.you')}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-slate-700"></span> {t('widgets.skillRadar.avg')}
                    </span>
                </div>
            </div>

            {/* SVG Radar */}
            <div className="w-64 h-64 relative">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-xl">
                    {/* Background Grid */}
                    {[20, 40, 60, 80].map(r => (
                        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
                    ))}
                    
                    {/* Axes Lines */}
                    {axes.map(axis => {
                         const { x, y } = getCoord(100, axis.angle);
                         return <line key={axis.name} x1="100" y1="100" x2={x} y2={y} stroke="#1e293b" strokeWidth="1" />;
                    })}

                    {/* Tier Avg Polygon */}
                    <polygon points={avgPoints} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4" opacity="0.5" />

                    {/* User Polygon */}
                    <polygon 
                        points={points} 
                        fill="url(#radarGradient)" 
                        stroke="#3b82f6" 
                        strokeWidth="2" 
                        fillOpacity="0.6"
                        className="transition-all duration-1000 ease-out"
                    />
                    
                    <defs>
                         <radialGradient id="radarGradient" cx="0.5" cy="0.5" r="0.5">
                             <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                             <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.1" />
                         </radialGradient>
                    </defs>

                    {/* Points & Values only (Labels moved to HTML) */}
                    {axes.map(axis => {
                        const val = stats[axis.key as keyof RadarStats];
                        const point = getCoord(val, axis.angle);

                        return (
                            <g key={axis.name}>
                                {/* Value Point Dot */}
                                <circle cx={point.x} cy={point.y} r="3" fill={axis.color} stroke="#0f172a" strokeWidth="1" />
                                {/* Value Label */}
                                <text
                                    x={point.x}
                                    y={point.y - 6}
                                    textAnchor="middle"
                                    className="text-[9px] font-bold fill-white drop-shadow-md"
                                >
                                    {val}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* HTML Overlay Labels with Tooltips */}
                {axes.map(axis => {
                    const { x, y } = getCoord(118, axis.angle);
                    const description = t(`widgets.skillRadar.descriptions.${axis.key}`);

                    return (
                        <div 
                            key={axis.name}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-help z-20"
                            style={{ left: `${(x/200)*100}%`, top: `${(y/200)*100}%` }}
                        >
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-400 transition-colors bg-slate-900/80 px-1 rounded backdrop-blur-sm">
                                {axis.name}
                            </span>
                            
                            {/* Tooltip */}
                            <div className="absolute w-max max-w-[120px] bg-slate-800 text-[10px] text-slate-200 p-2 rounded border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bottom-full mb-1 text-center hidden group-hover:block">
                                <div className="font-bold text-white mb-0.5">{axis.name}</div>
                                {description}
                            </div>
                        </div>
                    )
                })}
            </div>
            
            {/* Insight Text */}
            <div className="mt-4 text-center">
                 {/* Logic to find highest stat */}
                 {(() => {
                     const best = axes.reduce((prev, current) => 
                         (stats[current.key as keyof RadarStats] > stats[prev.key as keyof RadarStats]) ? current : prev
                     );
                     const insightText = t('widgets.skillRadar.outstanding').replace('{stat}', best.name);
                     return (
                         <div className="text-xs text-slate-400">
                             <span style={{ color: best.color }} className="font-bold">{best.name}</span> {insightText.includes(best.name) ? '' : insightText}
                         </div>
                     )
                 })()}
            </div>
        </div>
    )
}

