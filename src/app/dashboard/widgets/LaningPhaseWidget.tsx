import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function LaningPhaseWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return <DashboardCard><div className="animate-pulse h-32 bg-slate-800 rounded"></div></DashboardCard>;

    // Solo Death Rate (Lower is Better)
    const rate = stats.survival.soloDeathRate;

    return (
        <DashboardCard>
            <div className="flex justify-between items-start mb-2">
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
                    content={{
                        what: "序盤10分間の「生存安定性」と「稼ぐ力」を総合評価します。",
                        why: "不用意なデスを避けつつ(守り)、CSを確実に稼ぐ(攻め)ことが、試合を作る土台となります。",
                        how: "ソロデス率を0%に抑え、かつ10分時点でCS 80以上を目指しましょう。"
                    }}
                />
            </div>

            <div className="grid grid-cols-2 gap-2 divide-x divide-slate-700/50 mt-2">
                {/* Left: Defense (Solo Death) */}
                <div className="flex flex-col items-center justify-center pb-2">
                    <div className="relative w-16 h-16 mb-2 group">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="3"
                            />
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
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solo Death</div>
                        <div className={`text-[10px] ${rate > 30 ? "text-rose-400" : "text-emerald-400"}`}>
                            {rate > 50 ? "High Risk" : rate > 30 ? "Caution" : "Solid"}
                        </div>
                    </div>
                </div>

                {/* Right: Offense (CS @ 10) */}
                <div className="flex flex-col items-center justify-center pb-2 pl-2">
                     <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-slate-100 tracking-tighter leading-none">
                            {stats.survival.csAt10}
                        </span>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1">
                            CS @ 10m
                        </span>
                     </div>
                     
                     <div className="w-full max-w-[80px] mt-2">
                        <div className="flex justify-between text-[9px] text-slate-500 mb-0.5 font-mono">
                            <span>Avg</span>
                            <span>Target: 80</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(100, (stats.survival.csAt10 / 80) * 100)}%` }}
                            ></div>
                        </div>
                     </div>
                </div>
            </div>
        </DashboardCard>
    );
}
