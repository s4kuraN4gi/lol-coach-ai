"use client";

export default function DashboardSkeleton() {
    return (
        <>
            {/* Row 1: Profile + RankGraph */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                {/* ProfileCard Skeleton */}
                <div className="lg:col-span-3 bg-slate-800/50 rounded-xl p-6 animate-pulse">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-full bg-slate-700" />
                        <div className="flex-1">
                            <div className="h-6 w-40 bg-slate-700 rounded mb-2" />
                            <div className="h-4 w-24 bg-slate-700 rounded" />
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="h-16 bg-slate-700 rounded" />
                        <div className="h-16 bg-slate-700 rounded" />
                        <div className="h-16 bg-slate-700 rounded" />
                    </div>
                </div>

                {/* RankGraph + RankGoal Skeleton */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 h-48 animate-pulse">
                        <div className="h-4 w-32 bg-slate-700 rounded mb-4" />
                        <div className="h-32 bg-slate-700 rounded" />
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 h-24 animate-pulse">
                        <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
                        <div className="h-8 bg-slate-700 rounded" />
                    </div>
                </div>
            </div>

            {/* Row 2: QuickStats + NextGameFocus + SkillRadar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-800/50 rounded-xl p-4 h-40 animate-pulse">
                        <div className="h-4 w-28 bg-slate-700 rounded mb-4" />
                        <div className="h-24 bg-slate-700 rounded" />
                    </div>
                ))}
            </div>

            {/* Row 3: ChampionPerformance + WinCondition + Nemesis */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 bg-slate-800/50 rounded-xl p-4 h-48 animate-pulse">
                    <div className="h-4 w-36 bg-slate-700 rounded mb-4" />
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-10 bg-slate-700 rounded" />
                        ))}
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 h-48 animate-pulse">
                    <div className="h-4 w-24 bg-slate-700 rounded mb-4" />
                    <div className="h-32 bg-slate-700 rounded" />
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 h-48 animate-pulse">
                    <div className="h-4 w-20 bg-slate-700 rounded mb-4" />
                    <div className="h-32 bg-slate-700 rounded" />
                </div>
            </div>
        </>
    );
}
