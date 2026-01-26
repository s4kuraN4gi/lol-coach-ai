export function VisionResultSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            {/* Summary Skeleton */}
            <div className="bg-slate-800 p-4 rounded-xl border border-purple-500/30">
                <div className="h-4 w-32 bg-slate-700/50 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-full bg-slate-700/30 rounded animate-pulse"></div>
            </div>

            {/* Mistakes Skeleton (3 items) */}
            {[1, 2, 3].map((_, idx) => (
                <div key={idx} className="p-4 rounded-xl border bg-slate-900 border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <div className="h-4 w-24 bg-slate-700/50 rounded animate-pulse"></div>
                        <div className="h-4 w-12 bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 w-3/4 bg-slate-700/30 rounded mb-1 animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-slate-700/30 rounded animate-pulse"></div>
                </div>
            ))}

            {/* Final Advice Skeleton */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="h-3 w-24 bg-slate-700/50 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-full bg-slate-700/30 rounded animate-pulse"></div>
            </div>
        </div>
    );
}
