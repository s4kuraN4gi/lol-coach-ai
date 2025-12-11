import DashboardCard from "../components/DashboardCard";
import InfoTooltip from "../components/InfoTooltip";

export default function WinConditionWidget({ stats }: { stats: any }) {
    if (!stats) return <DashboardCard>Collecting match data...</DashboardCard>;

    const conditions = stats.winConditions || [];

    const getData = (labelContains: string) => {
        const item = conditions.find((c: any) => c.label.includes(labelContains));
        if (!item) return { wins: 0, total: 0, winRate: 0 };
        
        // stats.ts returns { count, winRate }. We calculate wins.
        const wins = Math.round((item.count * item.winRate) / 100);
        return { wins, total: item.count, winRate: item.winRate };
    };

    const firstBlood = getData("First Blood");
    const firstTower = getData("First Tower");
    const soloKill = getData("Solo Kill");

    // Helper for coloring
    const getWinRateColor = (wr: number) => {
        if (wr >= 60) return "text-yellow-400 font-bold"; 
        if (wr >= 50) return "text-emerald-400"; 
        return "text-rose-400"; 
    };

    return (
        <DashboardCard className="relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-500">
             <div className="flex items-center mb-3">
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

             <div className="space-y-2">
                {/* First Blood */}
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm">🩸</span>
                        <span className="text-xs text-slate-300">First Blood</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{firstBlood.wins} / {firstBlood.total} Games</div>
                        <div className={`text-sm font-bold ${getWinRateColor(firstBlood.winRate)}`}>
                            {firstBlood.winRate}% WR
                        </div>
                    </div>
                </div>

                {/* First Tower */}
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm">🏯</span>
                        <span className="text-xs text-slate-300">First Tower</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{firstTower.wins} / {firstTower.total} Games</div>
                        <div className={`text-sm font-bold ${getWinRateColor(firstTower.winRate)}`}>
                            {firstTower.winRate}% WR
                        </div>
                    </div>
                </div>

                {/* Solo Kills */}
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                         <span className="text-sm">⚔️</span>
                         <span className="text-xs text-slate-300">Solo Kills</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">{soloKill.wins} / {soloKill.total} Games</div>
                        <div className={`text-sm font-bold ${getWinRateColor(soloKill.winRate)}`}>
                            {soloKill.winRate}% WR
                        </div>
                    </div>
                </div>
             </div>
        </DashboardCard>
    );
}
