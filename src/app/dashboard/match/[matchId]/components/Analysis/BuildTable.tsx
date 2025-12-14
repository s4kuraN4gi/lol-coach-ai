import React from 'react';
import { BuildComparison, BuildItem } from '@/app/actions/coach';

type Props = {
    comparison: BuildComparison;
};

function ItemIcon({ item, isRecommended }: { item: BuildItem, isRecommended?: boolean }) {
    return (
        <div className="group relative">
            <div className={`
                w-10 h-10 md:w-12 md:h-12 rounded border-2 overflow-hidden bg-slate-900
                ${isRecommended ? 'border-yellow-500/50' : 'border-slate-700'}
            `}>
                {item.id > 0 ? (
                    <img 
                        src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${item.id}.png`}
                        alt={item.itemName}
                        className="w-full h-full object-cover"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                        ?
                    </div>
                )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[150px] px-2 py-1 bg-black/90 border border-slate-700 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 text-center">
                <div className="font-bold mb-0.5">{item.itemName}</div>
                {item.reason && <div className="text-[10px] text-yellow-200">{item.reason}</div>}
            </div>
        </div>
    );
}

export default function BuildTable({ comparison }: Props) {
    return (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800/50 flex justify-between items-center border-b border-slate-800">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    <span>🛡️</span> Build Analysis
                </h4>
            </div>
            
            <div className="p-4">
                {/* Comparison Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                    {/* User Build */}
                    <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Your Final Build</h5>
                        <div className="flex flex-wrap gap-2">
                            {comparison.userItems.map((item, i) => (
                                <ItemIcon key={i} item={item} />
                            ))}
                            {comparison.userItems.length === 0 && (
                                <span className="text-sm text-slate-600">No items found</span>
                            )}
                        </div>
                    </div>

                    {/* Recommended Build */}
                    <div>
                        <h5 className="text-xs font-bold text-yellow-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                             Recommended Core
                             <span className="text-[10px] bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-300">AI Choice</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                            {comparison.recommendedItems.map((item, i) => (
                                <ItemIcon key={i} item={item} isRecommended />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Analysis Text */}
                <div className="bg-slate-950/50 p-4 rounded border border-slate-800/50">
                    <p className="text-sm text-slate-300 leading-relaxed italic">
                        "{comparison.analysis}"
                    </p>
                </div>
            </div>
        </div>
    );
}
