import { UniqueStats } from "@/app/actions/stats";

export default function ClutchWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) {
         return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col justify-center items-center text-center">
                <div className="text-sm font-bold text-slate-400 mb-1">CLUTCH FACTOR</div>
                <div className="text-xs text-slate-600">Assessing game impact...</div>
            </div>
        );
    }

    const { clutch } = stats;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-bold tracking-wider mb-4">CLUTCH FACTOR</div>
            
            <div className="space-y-3">
                 {/* Close Games */}
                 <div>
                     <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                         <span>CLOSE GAMES (&lt;5k Gold Diff)</span>
                         <span className={clutch.closeWr >= 50 ? "text-blue-400" : "text-slate-400"}>{clutch.closeWr}% WR ({clutch.closeGames})</span>
                     </div>
                     <div className="h-1.5 bg-slate-800 rounded-full">
                         <div className="h-full bg-blue-500 rounded-full" style={{ width: `${clutch.closeWr}%` }}></div>
                     </div>
                 </div>

                 {/* Stomp Games */}
                 <div>
                     <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                         <span>STOMP GAMES (&gt;10k Gold Diff)</span>
                         <span className={clutch.stompWr >= 80 ? "text-yellow-400" : "text-slate-400"}>{clutch.stompWr}% WR ({clutch.stompGames})</span>
                     </div>
                     <div className="h-1.5 bg-slate-800 rounded-full">
                         <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${clutch.stompWr}%` }}></div>
                     </div>
                 </div>
                 
                 <div className="text-[10px] text-slate-500 mt-2">
                     {clutch.closeWr > clutch.stompWr + 10 ? "❄️ You are icy under pressure." : "🔥 You rely on snowballing."}
                 </div>
            </div>
        </div>
    );
}
