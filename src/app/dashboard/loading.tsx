
import DashboardLayout from "../Components/layout/DashboardLayout";

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
             <div className="flex items-center justify-between mb-6">
                 <div>
                     <div className="h-8 w-48 bg-slate-800 rounded mb-2"></div>
                     <div className="h-4 w-32 bg-slate-800 rounded"></div>
                 </div>
                 <div className="h-10 w-32 bg-slate-800 rounded"></div>
             </div>

             {/* Row 1: Profile & LP Widget */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                 {/* Profile Card Skeleton */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-48 flex items-center gap-6">
                     <div className="w-24 h-24 rounded-full bg-slate-800"></div>
                     <div className="flex-1 space-y-3">
                         <div className="h-6 w-3/4 bg-slate-800 rounded"></div>
                         <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
                         <div className="h-10 w-full bg-slate-800 rounded mt-4"></div>
                     </div>
                 </div>

                 {/* LP Widget Skeleton */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-48">
                      <div className="h-6 w-1/3 bg-slate-800 rounded mb-4"></div>
                      <div className="h-4 w-full bg-slate-800 rounded mb-2"></div>
                      <div className="h-24 w-full bg-slate-800 rounded"></div>
                 </div>
             </div>

             {/* Row 2: Champion Performance & Skill Radar */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                 {/* Champion Performance Skeleton */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-80">
                      <div className="h-6 w-1/3 bg-slate-800 rounded mb-6"></div>
                      <div className="space-y-4">
                          {[1, 2, 3].map(i => (
                              <div key={i} className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-slate-800 rounded"></div>
                                  <div className="flex-1 space-y-2">
                                      <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
                                      <div className="h-3 w-3/4 bg-slate-800 rounded"></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                 </div>

                 {/* Skill Radar Skeleton */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-80 flex flex-col items-center justify-center">
                      <div className="w-48 h-48 bg-slate-800 rounded-full"></div>
                 </div>
             </div>

             {/* Row 3: Unique Analysis (A, B, C, D) */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-48">
                          <div className="h-6 w-1/2 bg-slate-800 rounded mb-4"></div>
                          <div className="h-24 w-full bg-slate-800 rounded"></div>
                      </div>
                  ))}
             </div>
        </div>
    );
}
