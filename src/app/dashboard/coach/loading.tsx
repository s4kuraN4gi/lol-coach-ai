// loading.tsx - Suspense fallback for coach page
// This is automatically used by Next.js as a loading state

export default function CoachLoading() {
    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col animate-fadeIn">
            {/* Header Skeleton */}
            <header className="mb-6 flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                <div>
                    <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-64 bg-slate-800 rounded mt-2 animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-10 w-32 bg-slate-800 rounded animate-pulse" />
                </div>
            </header>

            {/* Main Content Skeleton */}
            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                {/* Left Column */}
                <div className="col-span-8 flex flex-col gap-4">
                    {/* Match Selection Skeleton */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="h-6 w-40 bg-slate-800 rounded mb-4 animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-700 animate-pulse" />
                                    <div className="flex-1">
                                        <div className="h-4 w-16 bg-slate-700 rounded animate-pulse" />
                                        <div className="h-3 w-24 bg-slate-700 rounded mt-2 animate-pulse" />
                                        <div className="h-3 w-20 bg-slate-700 rounded mt-1 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="col-span-4 flex flex-col gap-6">
                    {/* Premium Card Skeleton */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="h-6 w-32 bg-slate-800 rounded mb-4 animate-pulse" />
                        <div className="h-20 w-full bg-slate-800 rounded animate-pulse" />
                        <div className="h-10 w-full bg-slate-800 rounded mt-4 animate-pulse" />
                    </div>

                    {/* Ad Skeleton */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="h-[250px] w-full bg-slate-800 rounded animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}
