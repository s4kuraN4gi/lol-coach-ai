import Link from "next/link";

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
            {/* Header / Summary Skeleton */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        {/* Name Skeleton */}
                        <div className="h-10 w-48 bg-slate-800 rounded mb-2"></div>
                        {/* Stats Skeleton */}
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-20 bg-slate-800 rounded"></div>
                            <div className="h-6 w-20 bg-slate-800 rounded"></div>
                            <div className="h-6 w-20 bg-slate-800 rounded"></div>
                        </div>
                    </div>
                    
                    {/* Key Stats Grid Skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                        {[1, 2, 3, 4].map((i) => (
                             <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 min-w-[100px]">
                                <div className="h-3 w-16 bg-slate-800 rounded mb-1"></div>
                                <div className="h-6 w-12 bg-slate-800 rounded"></div>
                             </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analysis Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* 3 Large Cards */}
                 {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-64">
                        <div className="flex items-center gap-2 mb-4">
                             <div className="h-6 w-6 bg-slate-800 rounded-full"></div>
                             <div className="h-6 w-32 bg-slate-800 rounded"></div>
                        </div>
                        <div className="space-y-4">
                             <div className="h-4 w-full bg-slate-800 rounded"></div>
                             <div className="h-4 w-3/4 bg-slate-800 rounded"></div>
                             <div className="h-4 w-5/6 bg-slate-800 rounded"></div>
                        </div>
                    </div>
                 ))}
            </div>

            {/* Matchup Analysis Skeleton */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-96">
                <div className="h-6 w-48 bg-slate-800 rounded mb-4"></div>
                <div className="space-y-2">
                     {[1, 2, 3, 4, 5].map((i) => (
                         <div key={i} className="h-12 w-full bg-slate-800/50 rounded"></div>
                     ))}
                </div>
            </div>
        </div>
    );
}
