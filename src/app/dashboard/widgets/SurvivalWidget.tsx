import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function SurvivalWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return <DashboardCard>Calculating death rate...</DashboardCard>;

    const rate = stats.survival.soloDeathRate;

    return (
        <DashboardCard className="relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
            <div className="flex items-center mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg mr-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <span className="text-xl">🛡️</span>
                </div>
                <div>
                     <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        Survival Instinct
                        <InfoTooltip content={{
                            what: "孤立死（味方が近くにいない状態でのデス）の発生率",
                            why: "孤立死はマップの視界不足や、無謀なプッシュが原因で、逆転のきっかけを与えやすいです。",
                            how: "30%以下を目指しましょう。ワードを置いていない場所には入らないのが鉄則です。"
                        }} />
                     </h3>
                     <p className="text-xs text-slate-500">Isolation Rate</p>
                </div>
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
                </div>
                <div className="flex-1">
                     <div className={`text-xs font-bold ${rate > 30 ? "text-rose-400" : "text-emerald-400"}`}>
                        {rate > 50 ? "High Risk" : rate > 30 ? "Caution" : "Safe"}
                     </div>
                     <div className="text-[10px] text-slate-500 leading-tight mt-1 border-l-2 border-slate-700 pl-2">
                         {rate > 50 ? "サイドレーンでの孤立死が目立ちます。視界がない場所への深入りを避けましょう。" : rate > 30 ? "時折、無防備なデスがあります。ミニマップを見る頻度を上げましょう。" : "素晴らしい生存意識です。この調子で不用意なデスを避け続けましょう。"}
                     </div>
                </div>
            </div>
        </DashboardCard>
    );
}
