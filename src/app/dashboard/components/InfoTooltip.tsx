import { useState } from "react";

type InfoTooltipProps = {
    content: {
        what: string;
        why: string;
        how: string;
    };
};

export default function InfoTooltip({ content }: InfoTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-block ml-2 group">
            <button 
                type="button"
                className="w-4 h-4 rounded-full bg-slate-700 text-[10px] flex items-center justify-center text-slate-300 hover:bg-slate-600 cursor-help transition-colors"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)} // Mobile tap support
            >
                ?
            </button>

            {/* Tooltip Popup */}
            {isVisible && (
                <div className="absolute z-[100] w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-left bottom-full mb-2 left-1/2 -translate-x-1/2">
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">What (定義)</p>
                            <p className="text-xs text-slate-200 leading-tight">{content.what}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">Why (重要性)</p>
                            <p className="text-xs text-slate-200 leading-tight">{content.why}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-green-400 uppercase mb-0.5">How (目安)</p>
                            <p className="text-xs text-slate-200 leading-tight">{content.how}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
