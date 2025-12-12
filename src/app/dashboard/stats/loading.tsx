
export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-pulse">
             {/* Header */}
             <div className="h-10 w-64 bg-slate-800 rounded mb-8"></div>

             {/* WinRate & KDA Cards */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                 {[1, 2].map(i => (
                     <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-xl h-32">
                        <div className="h-4 w-24 bg-slate-800 rounded mb-2"></div>
                        <div className="h-10 w-32 bg-slate-800 rounded mb-2"></div>
                        <div className="h-3 w-16 bg-slate-800 rounded"></div>
                     </div>
                 ))}
             </div>

             {/* Gallery Header */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                 <div className="h-8 w-48 bg-slate-800 rounded"></div>
                 <div className="flex gap-2">
                     {[1, 2, 3, 4, 5].map(i => (
                         <div key={i} className="h-8 w-16 bg-slate-800 rounded-md"></div>
                     ))}
                 </div>
             </div>

             {/* Match Gallery Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {[1, 2, 3, 4, 5, 6].map(i => (
                     <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 h-[160px] p-6 relative">
                         <div className="flex justify-between items-start mb-auto">
                             <div>
                                 <div className="h-8 w-32 bg-slate-800 rounded mb-2"></div>
                                 <div className="h-3 w-24 bg-slate-800 rounded"></div>
                             </div>
                             <div className="h-6 w-16 bg-slate-800 rounded"></div>
                         </div>
                         <div className="mt-4 flex justify-between items-end">
                             <div className="h-5 w-24 bg-slate-800 rounded"></div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
}
