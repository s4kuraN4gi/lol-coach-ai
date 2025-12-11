import { UniqueStats } from "@/app/actions/stats";
import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function ClutchWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return <DashboardCard>Collecting match data...</DashboardCard>;

    const { clutch } = stats;

    const getColor = (wr: number) => {
        if (wr >= 60) return "text-yellow-400 font-bold";
        if (wr >= 50) return "text-emerald-400";
        return "text-rose-400";
    };

    const getBarColor = (wr: number) => {
         if (wr >= 60) return "bg-yellow-500";
         if (wr >= 50) return "bg-emerald-500";
         return "bg-rose-500";
    };

    return (
        <DashboardCard className="relative  group hover:border-blue-500/30 transition-all duration-500">
             <div className="flex items-center mb-3">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <span className="text-xl">⚖️</span>
                </div>
                <div>
                     <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        Clutch Factor
                        <InfoTooltip content={{
                            what: "接戦（5kゴールド差以内）および圧勝（10k差以上）時の勝率",
                            why: "接戦での勝率は、プレッシャーのかかる場面での判断力を示します。",
                            how: "接戦勝率50%以上を目指し、勝てる試合を確実に拾う力をつけましょう。"
                        }} />
                     </h3>
                     <p className="text-xs text-slate-500">Game Impact</p>
                </div>
             </div>

            <div className="space-y-3">
                 {/* Close Games */}
                 <div>
                     <div className="flex justify-between text-xs text-slate-300 mb-1">
                         <span className="flex items-center gap-2"><span className="text-sm">🤝</span> Close Games (&lt;5k Gold)</span>
                         <span className={getColor(clutch.closeWr)}>{clutch.closeWr}% WR ({clutch.closeGames})</span>
                     </div>
                     <div className="h-2 bg-slate-800 rounded-full ">
                         <div className={`h-full rounded-full ${getBarColor(clutch.closeWr)}`} style={{ width: `${clutch.closeWr}%` }}></div>
                     </div>
                 </div>

                 {/* Stomp Games */}
                 <div>
                     <div className="flex justify-between text-xs text-slate-300 mb-1">
                         <span className="flex items-center gap-2"><span className="text-sm">💥</span> Stomp Games (&gt;10k Gold)</span>
                         <span className={getColor(clutch.stompWr)}>{clutch.stompWr}% WR ({clutch.stompGames})</span>
                     </div>
                     <div className="h-2 bg-slate-800 rounded-full ">
                         <div className={`h-full rounded-full ${getBarColor(clutch.stompWr)}`} style={{ width: `${clutch.stompWr}%` }}></div>
                     </div>
                 </div>
                 
                 <div className="p-2 bg-slate-800/50 rounded text-[10px] text-slate-400 text-center italic mt-2">
                     {clutch.closeWr > clutch.stompWr + 10 ? "❄️ You are icy under pressure." : "🔥 You rely on snowballing."}
                 </div>
            </div>
        </DashboardCard>
    );
}
