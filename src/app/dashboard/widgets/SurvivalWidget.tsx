import { UniqueStats } from "@/app/actions/stats";

export default function SurvivalWidget({ stats }: { stats: UniqueStats | null }) {
    if (!stats) return null;

    const rate = stats.survival.soloDeathRate;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-bold tracking-wider mb-2">SURVIVAL INSTINCT</div>
            
            <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {/* Background Circle */}
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth="4"
                        />
                        {/* Value Circle */}
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={rate > 50 ? "#ef4444" : rate > 30 ? "#facc15" : "#4ade80"}
                            strokeWidth="4"
                            strokeDasharray={`${rate}, 100`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-white text-sm">
                        {rate}%
                    </div>
                </div>
                <div>
                     <div className="text-xs font-bold text-slate-200">Solo Death Rate</div>
                     <div className="text-[10px] text-slate-500 leading-tight mt-1">
                         Games where you died solo/isolated significantly.
                         {rate > 50 ? " Avoid splitting blindly!" : " Good awareness."}
                     </div>
                </div>
            </div>
        </div>
    );
}
