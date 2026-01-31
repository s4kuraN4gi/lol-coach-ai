"use client";

export default function CoachPageSkeleton() {
    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col animate-pulse">
            {/* Header Skeleton */}
            <header className="mb-6 flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <div>
                    <div className="h-8 w-48 bg-slate-800 rounded mb-2" />
                    <div className="h-4 w-64 bg-slate-800 rounded" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-10 w-32 bg-slate-800 rounded" />
                    <div className="h-8 w-24 bg-slate-800 rounded-full" />
                </div>
            </header>

            {/* Main Content Skeleton */}
            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                {/* Left Column - Match List */}
                <div className="col-span-8 flex flex-col gap-4 h-full pr-2">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="h-6 w-40 bg-slate-800 rounded mb-4" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-700" />
                                    <div className="flex-1">
                                        <div className="h-4 w-16 bg-slate-700 rounded mb-2" />
                                        <div className="h-3 w-24 bg-slate-700 rounded mb-1" />
                                        <div className="h-2 w-20 bg-slate-700 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="col-span-4 flex flex-col gap-6 h-full pb-10">
                    {/* Premium Card Skeleton */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-48">
                        <div className="h-6 w-32 bg-slate-800 rounded mb-4" />
                        <div className="h-4 w-full bg-slate-800 rounded mb-2" />
                        <div className="h-4 w-3/4 bg-slate-800 rounded mb-4" />
                        <div className="h-10 w-full bg-slate-800 rounded" />
                    </div>

                    {/* Ad Skeleton */}
                    <div className="bg-slate-800/30 rounded h-[250px]" />
                </div>
            </div>
        </div>
    );
}
