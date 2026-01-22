"use client";

import React, { useState, useTransition, useEffect } from "react";
import { type AnalysisStatus, getAnalysisStatus } from "@/app/actions/analysis";
import { triggerStripeCheckout } from "@/lib/checkout";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
    initialStatus: AnalysisStatus | null;
    onStatusUpdate?: (newStatus: AnalysisStatus) => void;
};

export default function PlanStatusBadge({ initialStatus, onStatusUpdate }: Props) {
    const [status, setStatus] = useState<AnalysisStatus | null>(initialStatus);
    const [isPending, startTransition] = useTransition();
    const { t } = useTranslation();

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const isPremium = status?.is_premium;
    const credits = status?.analysis_credits ?? 0;

    const handleUpgrade = async () => {
        startTransition(async () => {
          await triggerStripeCheckout();
        });
    };

    if (!status) {
        return (
            <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4 border border-slate-700/50 bg-slate-900/50 animate-pulse">
                <div>
                   <div className="h-3 w-16 bg-slate-700 rounded mb-1"></div>
                   <div className="h-5 w-24 bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4 border border-slate-700/50 bg-slate-900/50">
            <div>
              <span className="text-xs text-slate-400 block font-bold">{t('premium.statusBadge.plan')}</span>
              <span
                className={`font-black tracking-wide ${
                  isPremium ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" : "text-slate-200"
                }`}
              >
                {isPremium ? t('premium.statusBadge.premium') : t('premium.statusBadge.freeAgent')}
              </span>
            </div>
            {!isPremium && (
              <div className="border-l border-slate-700 pl-4">
                <span className="text-xs text-slate-400 block font-bold">{t('premium.statusBadge.credits')}</span>
                <span
                  className={`font-black ${
                    credits === 0 ? "text-red-500" : "text-blue-400"
                  }`}
                >
                  {credits} <span className="text-xs text-slate-500">{t('premium.statusBadge.remaining')}</span>
                </span>
              </div>
            )}
            {!isPremium && (
              <button
                onClick={handleUpgrade}
                disabled={isPending}
                className="ml-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white font-black px-6 py-2 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300/50 flex items-center gap-2 group disabled:opacity-50 disabled:grayscale"
              >
                <span className="text-lg group-hover:rotate-12 transition-transform">👑</span>
                {isPending ? t('premium.statusBadge.upgrading') : t('premium.statusBadge.upgradeToPremium')}
              </button>
            )}
        </div>
    );
}
