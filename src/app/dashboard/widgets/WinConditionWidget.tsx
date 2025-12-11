import { UniqueStats } from "@/app/actions/stats";

export default function WinConditionWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col justify-center items-center text-center">
                <div className="text-sm font-bold text-slate-400 mb-1">WIN CONDITIONS</div>
                <div className="text-xs text-slate-600">Collecting match data...</div>
            </div>
        );
    }

    const conditions = stats.winConditions;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
                <div className="text-slate-400 text-xs font-bold tracking-wider">VICTORY CONDITIONS</div>
                <div className="text-[10px] text-slate-500">When you...</div>
            </div>

            <div className="space-y-4">
                {conditions.map((item) => (
                    <div key={item.label}>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span className="font-bold flex items-center gap-2">
                                {item.label.includes("Blood") && "🩸"}
                                {item.label.includes("Tower") && "🏯"}
                                {item.label.includes("Solo") && "⚔️"}
                                {item.label}
                            </span>
                            <span className={item.winRate >= 60 ? "text-yellow-400" : "text-slate-400"}>
                                {item.winRate}% WR ({item.count} games)
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${item.winRate >= 60 ? "bg-yellow-500" : "bg-blue-500"}`}
                                style={{ width: `${item.winRate}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
            {conditions.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">Not enough data to determine conditions</div>
            )}
        </div>
    );
}
