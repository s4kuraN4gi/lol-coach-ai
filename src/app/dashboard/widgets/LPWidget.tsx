import { LeagueEntryDTO } from "@/app/actions/riot";

export default function LPWidget({ rank, recentMatches }: { rank: LeagueEntryDTO | null, recentMatches: { win: boolean }[] }) {
    if (!rank) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px] text-center">
                 <div className="w-16 h-16 bg-slate-800 rounded-full mb-4 animate-pulse"></div>
                 <div className="text-slate-500 font-bold mb-2">Unranked</div>
                 <div className="text-xs text-slate-600">Play ranked games to see LP progression</div>
            </div>
        );
    }

    const { tier, rank: division, leaguePoints, wins, losses } = rank;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    // Simulate LP Trend from recent matches (Net Wins)
    // Start at 0, Win = +1, Loss = -1
    // This gives a "Form" graph.
    const trendData = recentMatches.reduce((acc, match) => {
        const last = acc.length > 0 ? acc[acc.length - 1] : 0;
        acc.push(last + (match.win ? 1 : -1));
        return acc;
    }, [] as number[]);

    // SVG Graph Logic
    const minVal = Math.min(0, ...trendData);
    const maxVal = Math.max(0, ...trendData);
    const range = Math.max(1, maxVal - minVal);
    
    // Normalize to height 50px
    const points = trendData.map((val, i) => {
        const x = (i / (trendData.length - 1 || 1)) * 100; // percent width
        const y = 100 - ((val - minVal) / range) * 100; // percent height (inverted for SVG y)
        return `${x},${y}`;
    }).join(" ");


    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex justify-between items-start mb-6 z-10 relative">
                <div>
                   <div className="text-slate-400 text-xs font-bold tracking-wider mb-1">RANK PROGRESSION</div>
                   <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white italic">{tier} {division}</span>
                       <span className="text-lg text-slate-300 font-bold">{leaguePoints} LP</span>
                   </div>
                   <div className="text-xs text-slate-500 mt-1">
                       {wins}W {losses}L ({winRate}%)
                   </div>
                </div>
                {/* Tier Icon Placeholder (Could fetch from CDN) */}
                <div className="w-12 h-12 relative flex items-center justify-center">
                    <img 
                        src={`https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`} 
                        alt={tier}
                        className="w-full h-full object-contain drop-shadow-lg"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                     {/* Fallback Text if image fails or generic */}
                     <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-700 opacity-20 -z-10">
                         {tier[0]}
                     </div>
                </div>
            </div>

            {/* LP Progress Bar (To Next Rank = 100 LP) */}
            <div className="mb-6 relative z-10">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Current LP</span>
                    <span>Next Rank (100 LP)</span>
                </div>
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, leaguePoints)}%` }}
                    ></div>
                </div>
                {leaguePoints >= 100 && (
                     <div className="text-xs text-yellow-500 font-bold mt-1 animate-pulse">
                         🔥 PROMOTION ZONE!
                     </div>
                )}
            </div>

            {/* Recent Form Trend */}
            <div className="relative z-10">
                 <div className="text-xs text-slate-500 font-bold mb-2 flex justify-between">
                     <span>RECENT FORM (NET WINS)</span>
                     <span className={trendData[trendData.length-1] > 0 ? "text-blue-400" : "text-red-400"}>
                         {trendData[trendData.length-1] > 0 ? "+" : ""}{trendData[trendData.length-1]} Net
                     </span>
                 </div>
                 <div className="h-12 w-full bg-slate-800/30 rounded border border-slate-700/30 relative overflow-hidden flex items-end px-1">
                     {recentMatches.length > 1 ? (
                         <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                            <defs>
                                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5"/>
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                                </linearGradient>
                            </defs>
                            <path 
                                d={points.length > 0 ? (points.indexOf(' ') === -1 ? `M 0 50 L ${points}` : `M 0 ${50} L ${points}`) : "M 0 50 L 100 50"}
                                fill="none"
                                stroke={trendData[trendData.length-1] >= 0 ? "#3b82f6" : "#ef4444"}
                                strokeWidth="3"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                            {/* Area under curve? Optional */}
                         </svg>
                     ) : (
                         <div className="text-slate-600 text-[10px] w-full text-center py-4">Not enough matches for trend</div>
                     )}
                 </div>
            </div>
        </div>
    );
}
