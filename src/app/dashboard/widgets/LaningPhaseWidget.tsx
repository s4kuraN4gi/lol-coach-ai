import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function LaningPhaseWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return <DashboardCard><div className="animate-pulse h-32 bg-slate-800 rounded"></div></DashboardCard>;

    // Solo Death Rate (Lower is Better)
    const rate = stats.survival.soloDeathRate;

    return (
        <DashboardCard>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
                        ⚔️
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 tracking-wider">LANING PHASE</h3>
                        <p className="text-[10px] text-slate-500 font-mono">Early Game Stability</p>
                    </div>
                </div>
                <InfoTooltip 
                    title="レーニングフェーズ (攻守)"
                    what="序盤10分間の「生存安定性」と「稼ぐ力」を総合評価します。"
                    why="不用意なデスを避けつつ(守り)、CSを確実に稼ぐ(攻め)ことが、試合を作る土台となります。"
                    how="ソロデス率を0%に抑え、かつ10分時点でCS 80以上を目指しましょう。"
                />
            </div>

            <div className="flex items-center gap-4 justify-center py-2">
                <div className="relative w-16 h-16 transform transition-transform group-hover:scale-110 duration-500">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {/* Background Circle */}
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth="3"
                        />
                        {/* Value Circle */}
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={rate > 50 ? "#ef4444" : rate > 30 ? "#facc15" : "#4ade80"}
                            strokeWidth="3"
                            strokeDasharray={`${rate}, 100`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-slate-200 text-sm">
                        {rate}%
                    </div>
                     <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-bold uppercase whitespace-nowrap">
                       Solo Death
                   </div>
                </div>
                <div className="flex-1">
                     <div className={`text-xs font-bold ${rate > 30 ? "text-rose-400" : "text-emerald-400"}`}>
                        {rate > 50 ? "High Risk" : rate > 30 ? "Caution" : "Safe"}
                     </div>
                     <div className="text-[10px] text-slate-500 leading-tight mt-1 border-l-2 border-slate-700 pl-2">
                         {rate > 50 ? "孤立死が多すぎます。視界確保を優先してください。" : rate > 30 ? "時折、不用意なデスがあります。" : "非常に安定した立ち上がりです。"}
                     </div>
                </div>
            </div>

            {/* CS @ 10 Min */}
            <div className="mt-2 pt-2 border-t border-slate-700/50">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">CS @ 10min</span>
                    <span className="text-xs font-mono text-slate-300">
                        Avg: <span className="font-bold text-white">{stats.survival.csAt10}</span> <span className="text-[10px] text-slate-500">/ Ideal 80</span>
                    </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                        className="bg-blue-500 h-full rounded-full" 
                        style={{ width: `${Math.min(100, (stats.survival.csAt10 / 80) * 100)}%` }}
                    ></div>
                </div>
            </div>
        </DashboardCard>
    );
}
