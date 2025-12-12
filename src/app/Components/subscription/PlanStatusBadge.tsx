"use client";

import React, { useState, useTransition } from "react";
import { upgradeToPremium, type AnalysisStatus, getAnalysisStatus } from "@/app/actions/analysis";

type Props = {
    initialStatus: AnalysisStatus | null;
    onStatusUpdate?: (newStatus: AnalysisStatus) => void;
};

export default function PlanStatusBadge({ initialStatus, onStatusUpdate }: Props) {
    const [status, setStatus] = useState<AnalysisStatus | null>(initialStatus);
    const [isPending, startTransition] = useTransition();

    const isPremium = status?.is_premium;
    const credits = status?.analysis_credits ?? 0;

    const handleUpgrade = () => {
        if (!confirm("【モック】プレミアムプラン(月額980円)に登録しますか？")) return;
    
        startTransition(async () => {
          const res = await upgradeToPremium();
          if (res.success) {
            alert("プレミアムプランに登録しました！");
            const newStatus = await getAnalysisStatus();
            if (newStatus) {
                setStatus(newStatus);
                onStatusUpdate?.(newStatus);
            }
          }
        });
    };

    if (!status) return null;

    return (
        <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4 border border-slate-700/50 bg-slate-900/50">
            <div>
              <span className="text-xs text-slate-400 block font-bold">PLAN</span>
              <span
                className={`font-black tracking-wide ${
                  isPremium ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" : "text-slate-200"
                }`}
              >
                {isPremium ? "💎 PREMIUM" : "FREE AGENT"}
              </span>
            </div>
            {!isPremium && (
              <div className="border-l border-slate-700 pl-4">
                <span className="text-xs text-slate-400 block font-bold">CREDITS</span>
                <span
                  className={`font-black ${
                    credits === 0 ? "text-red-500" : "text-blue-400"
                  }`}
                >
                  {credits} <span className="text-xs text-slate-500">REMAINING</span>
                </span>
              </div>
            )}
            {!isPremium && (
              <button
                onClick={handleUpgrade}
                disabled={isPending}
                className="ml-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-1 text-sm rounded hover:opacity-90 transition shadow-[0_0_10px_rgba(245,158,11,0.3)] disabled:opacity-50"
              >
                {isPending ? "UPGRADING..." : "UPGRADE"}
              </button>
            )}
        </div>
    );
}
