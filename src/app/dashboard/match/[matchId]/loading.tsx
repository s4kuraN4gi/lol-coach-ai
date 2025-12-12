
export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-pulse">
             {/* Nav Skeleton */}
             <div className="flex items-center gap-4 mb-8">
                 <div className="h-4 w-24 bg-slate-800 rounded"></div>
                 <div className="h-4 w-4 bg-slate-800 rounded"></div>
                 <div className="h-4 w-32 bg-slate-800 rounded"></div>
             </div>

             <div className="space-y-6">
                 {/* Match Header Skeleton */}
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded bg-slate-800"></div>
                          <div>
                              <div className="h-8 w-64 bg-slate-800 rounded mb-2"></div>
                              <div className="flex gap-3">
                                  <div className="h-4 w-16 bg-slate-800 rounded"></div>
                                  <div className="h-4 w-16 bg-slate-800 rounded"></div>
                              </div>
                          </div>
                     </div>
                     <div className="h-6 w-20 bg-slate-800 rounded-full"></div>
                 </div>

                 {/* Timeline Skeleton */}
                 <div className="h-64 bg-slate-900 rounded-xl relative overflow-hidden">
                     <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-8 w-32 bg-slate-800 rounded"></div>
                     </div>
                 </div>

                 {/* Team Overview Skeleton */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-4">
                      <div className="h-6 w-48 bg-slate-800 rounded mb-4"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              {[1, 2, 3, 4, 5].map(i => (
                                  <div key={i} className="h-12 w-full bg-slate-800 rounded"></div>
                              ))}
                          </div>
                          <div className="space-y-2">
                              {[1, 2, 3, 4, 5].map(i => (
                                  <div key={i} className="h-12 w-full bg-slate-800 rounded"></div>
                              ))}
                          </div>
                      </div>
                 </div>

                 {/* Analysis Panel Skeleton */}
                 <div className="h-32 bg-slate-900 rounded-xl"></div>
             </div>
        </div>
    );
}
