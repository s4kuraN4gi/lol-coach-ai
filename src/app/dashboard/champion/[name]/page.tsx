import { createClient } from "@/utils/supabase/server";
import { getChampionStats } from "@/app/actions/champion";
import { getActiveSummoner } from "@/app/actions/profile";
import { redirect } from "next/navigation";

export default async function ChampionPage({ params }: { params: Promise<{ name: string }> }) {
    const { name } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Use centralized logic to get the active summoner
    const activeSummoner = await getActiveSummoner();
    const puuid = activeSummoner?.puuid;

    if (!puuid) {
         return (
             <div className="p-8 text-center">
                 <h2 className="text-xl font-bold text-red-400 mb-2">サモナー情報が見つかりません</h2>
                 <p className="text-slate-400 mb-4">アカウント設定からサモナーを連携してください。</p>
                 <a href="/dashboard/account" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
                     アカウント連携へ
                 </a>
             </div>
         );
    }

    const stats = await getChampionStats(puuid, decodeURIComponent(name));

    if (!stats) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-slate-100 mb-4">{decodeURIComponent(name)}</h1>
                <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400">
                    No recent data found for this champion in the last 50 matches.
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            {/* Header / Summary */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
                            {stats.championName}
                        </h1>
                        <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {stats.summary.games} Games
                            </span>
                            <span>•</span>
                            <span className={stats.summary.winRate >= 50 ? "text-green-400" : "text-red-400"}>
                                {stats.summary.winRate}% WR
                            </span>
                             <span>•</span>
                             <span className="text-slate-300">
                                {stats.summary.kda} KDA
                             </span>
                        </div>
                    </div>
                    
                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">CS / Min</div>
                            <div className="text-xl font-bold text-slate-200">{stats.summary.csPerMin}</div>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Gold</div>
                            <div className="text-xl font-bold text-slate-200">~</div> 
                        </div>
                        {/* Add more summary stats here */}
                    </div>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Laning */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <span className="text-xl">⚔️</span>
                         <h3 className="font-bold text-slate-100">Laning Phase</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400">CS Diff @ 15</span>
                             <span className={`text-lg font-bold ${stats.laning.csDiff15 > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.laning.csDiff15 > 0 ? '+' : ''}{stats.laning.csDiff15}
                             </span>
                        </div>
                         {/* More laning stats */}
                    </div>
                </div>

                {/* Combat */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <span className="text-xl">💥</span>
                         <h3 className="font-bold text-slate-100">Combat Identity</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400">Damage Share</span>
                             <span className="text-lg font-bold text-blue-400">{stats.combat.damageShare}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                             <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(stats.combat.damageShare * 2, 100)}%` }} />
                        </div>
                        
                         <div className="flex justify-between items-center">
                             <span className="text-sm text-slate-400">Kill Participation</span>
                             <span className="text-lg font-bold text-purple-400">{stats.combat.killParticipation}%</span>
                        </div>
                    </div>
                </div>

                {/* Power Spikes */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <span className="text-xl">📈</span>
                         <h3 className="font-bold text-slate-100">Power Spikes</h3>
                    </div>
                    <div className="flex items-end justify-between h-32 gap-2 mt-2">
                        {/* Early */}
                         <div className="flex flex-col items-center gap-1 w-1/3 group">
                            <div className="relative w-full bg-slate-800 rounded-t-lg transition-all group-hover:bg-slate-700" style={{ height: `${stats.spikes.earlyGame}%` }}>
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100">{stats.spikes.earlyGame}%</div>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">0-25m</span>
                         </div>
                         {/* Mid */}
                         <div className="flex flex-col items-center gap-1 w-1/3 group">
                             <div className="relative w-full bg-slate-800 rounded-t-lg transition-all group-hover:bg-slate-700" style={{ height: `${stats.spikes.midGame}%` }}>
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100">{stats.spikes.midGame}%</div>
                             </div>
                            <span className="text-xs text-slate-500 font-medium">25-35m</span>
                         </div>
                         {/* Late */}
                         <div className="flex flex-col items-center gap-1 w-1/3 group">
                             <div className="relative w-full bg-slate-800 rounded-t-lg transition-all group-hover:bg-slate-700" style={{ height: `${stats.spikes.lateGame}%` }}>
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100">{stats.spikes.lateGame}%</div>
                             </div>
                            <span className="text-xs text-slate-500 font-medium">35m+</span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Debug Data */}
            <details className="mt-8 p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-500">
                <summary>Debug Data</summary>
                <pre className="mt-2 text-wrap">{JSON.stringify(stats, null, 2)}</pre>
            </details>
        </div>
    );
}
