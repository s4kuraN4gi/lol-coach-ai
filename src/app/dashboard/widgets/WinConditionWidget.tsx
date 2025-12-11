import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function WinConditionWidget({ stats }: { stats: any }) {
    if (!stats) return <DashboardCard>Collecting match data...</DashboardCard>;

    // Helper for coloring
    const getWinRateColor = (wins: number, total: number) => {
        if (total === 0) return "text-slate-500";
        const wr = (wins / total) * 100;
        if (wr >= 60) return "text-yellow-400 font-bold"; 
        if (wr >= 50) return "text-emerald-400"; 
        return "text-rose-400"; 
    };

    return (
        <DashboardCard className="relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-500">
             <div className="flex items-center mb-6">
                <div className="p-2 bg-yellow-500/10 rounded-lg mr-3 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                    <span className="text-xl">🏆</span>
                </div>
                <div>
                     <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        Win Conditions
                        <InfoTooltip content={{
                            what: "勝利に直結する3大アクション（First Blood, First Tower, Solo Kill）の達成率。",
                            why: "これらを取得した試合の勝率が高い＝あなたの「勝ちパターン」です。",
                            how: "勝率60%以上の項目を意識して狙うことで、勝率を安定させられます。"
                        }} />
                     </h3>
                     <p className="text-xs text-slate-500">Victory Factors</p>
                </div>
             </div>

             <div className="space-y-4">
                {/* First Blood */}
                <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm">🩸</span>
                        <span className="text-xs text-slate-300">First Blood</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{stats.firstBlood.wins} / {stats.firstBlood.total}</div>
                        <div className={`text-sm font-bold ${getWinRateColor(stats.firstBlood.wins, stats.firstBlood.total)}`}>
                            {stats.firstBlood.total > 0 ? Math.round((stats.firstBlood.wins / stats.firstBlood.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* First Tower */}
                <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm">🏯</span>
                        <span className="text-xs text-slate-300">First Tower</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{stats.firstTower.wins} / {stats.firstTower.total}</div>
                        <div className={`text-sm font-bold ${getWinRateColor(stats.firstTower.wins, stats.firstTower.total)}`}>
                            {stats.firstTower.total > 0 ? Math.round((stats.firstTower.wins / stats.firstTower.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Solo Kills */}
                <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                         <span className="text-sm">⚔️</span>
                         <span className="text-xs text-slate-300">Solo Kills</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{stats.soloKill.wins} / {stats.soloKill.total}</div>
                        <div className={`text-sm font-bold ${getWinRateColor(stats.soloKill.wins, stats.soloKill.total)}`}>
                            {stats.soloKill.total > 0 ? Math.round((stats.soloKill.wins / stats.soloKill.total) * 100) : 0}%
                        </div>
                    </div>
                </div>
             </div>
        </DashboardCard>
    );
}
