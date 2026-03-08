"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { type AnalysisStatus } from "@/app/actions/constants";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
    initialStatus: AnalysisStatus | null;
    onStatusUpdate?: (newStatus: AnalysisStatus) => void;
};

export default function PlanStatusBadge({ initialStatus, onStatusUpdate }: Props) {
    const [status, setStatus] = useState<AnalysisStatus | null>(initialStatus);
    const { t } = useTranslation();

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const isPremium = status?.is_premium;
    const isExtra = status?.subscription_tier === 'extra';

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

    const badgeText = isExtra
        ? t('premium.statusBadge.extra', 'EXTRA')
        : isPremium
            ? t('premium.statusBadge.premium')
            : t('premium.statusBadge.freeAgent');

    const badgeClass = isExtra
        ? "text-violet-400 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]"
        : isPremium
            ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]"
            : "text-slate-200";

    return (
        <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4 border border-slate-700/50 bg-slate-900/50">
            <div>
              <span className="text-xs text-slate-400 block font-bold">{t('premium.statusBadge.plan')}</span>
              <span className={`font-black tracking-wide ${badgeClass}`}>
                {badgeText}
              </span>
            </div>
            <Link
              href="/pricing"
              className="ml-4 text-sm text-slate-400 hover:text-white transition"
            >
              {t('premium.statusBadge.viewPlans', '料金プラン')}
            </Link>
        </div>
    );
}
