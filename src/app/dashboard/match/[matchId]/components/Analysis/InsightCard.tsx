import React from 'react';
import { CoachingInsight } from '@/app/actions/coach';

const TYPE_CONFIG = {
    MISTAKE: {
        icon: "⚠️",
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30"
    },
    TURNING_POINT: {
        icon: "⚡",
        color: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30"
    },
    GOOD_PLAY: {
        icon: "🟢",
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/30"
    },
    INFO: {
        icon: "ℹ️",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/30"
    }
};

type Props = {
    insight: CoachingInsight;
};

export default function InsightCard({ insight }: Props) {
    const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.INFO;

    return (
        <div className={`p-4 rounded-lg border ${config.bg} ${config.border} mb-3 transition-all hover:scale-[1.01]`}>
            <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5" role="img" aria-label={insight.type}>{config.icon}</span>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`font-mono text-xs px-2 py-0.5 rounded bg-black/30 ${config.color}`}>
                            {insight.timestampStr}
                        </span>
                        <h4 className={`font-bold text-sm ${config.color}`}>
                            {insight.title}
                        </h4>
                    </div>
                    
                    <p className="text-slate-300 text-sm mb-2 leading-relaxed">
                        {insight.description}
                    </p>

                    {insight.advice && (
                        <div className="mt-2 text-sm bg-black/20 p-2 rounded border border-white/5">
                            <span className="font-bold text-slate-400 text-xs uppercase tracking-wider block mb-1">Coach Advice</span>
                            <p className="text-slate-200">
                                {insight.advice}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
