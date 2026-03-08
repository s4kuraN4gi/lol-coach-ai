"use client";

import Link from "next/link";
import { FaCrown } from "react-icons/fa6";
import { useTranslation } from "@/contexts/LanguageContext";
import type { AnalysisStatus } from "@/app/actions/constants";
import { getWeeklyLimit } from "@/app/actions/constants";

type Props = {
    status: AnalysisStatus | null;
};

export default function PremiumPromoCard({ status }: Props) {
    const { t } = useTranslation();

    if (!status) return null;

    const isPremium = status.is_premium;
    const weeklyLimit = getWeeklyLimit(status);
    const weeklyUsed = status.weekly_analysis_count || 0;
    const remaining = Math.max(0, weeklyLimit - weeklyUsed);
    const usagePercent = weeklyLimit > 0 ? Math.min(100, (weeklyUsed / weeklyLimit) * 100) : 0;

    // Premium/Extra users: show usage bar + optional Extra upsell
    if (isPremium) {
        const isNearLimit = usagePercent >= 90;
        const showExtraUpsell = isNearLimit && status.subscription_tier !== 'extra';

        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">
                        {t('dashboard.promo.weeklyUsage', 'AI Analysis (This Week)')}
                    </span>
                    <span className="text-xs text-slate-400">
                        {weeklyUsed}/{weeklyLimit}
                    </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all ${
                            usagePercent >= 90 ? 'bg-red-500' :
                            usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                    {t('dashboard.promo.remaining', '{{count}} remaining').replace('{{count}}', String(remaining))}
                </p>

                {showExtraUpsell && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                <FaCrown className="text-violet-400 text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white">
                                    {t('dashboard.promo.extraTitle', 'Expand to 50/week with Extra')}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {t('dashboard.promo.extraDesc', 'AI damage analysis also available')}
                                </p>
                            </div>
                            <Link
                                href="/pricing"
                                className="flex-shrink-0 px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold transition"
                            >
                                {t('dashboard.promo.extraCta', 'Details')}
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Free users: usage bar + upgrade CTA
    return (
        <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/10 border border-amber-500/30 rounded-xl p-4">
            {/* Usage bar */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">
                    {t('dashboard.promo.weeklyUsage', 'AI Analysis (This Week)')}
                </span>
                <span className="text-xs text-slate-400">
                    {weeklyUsed}/{weeklyLimit}
                </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-3">
                <div
                    className={`h-2 rounded-full transition-all ${
                        weeklyUsed >= weeklyLimit ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                />
            </div>

            {/* Upgrade CTA */}
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCrown className="text-amber-400 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-0.5">
                        {t('dashboard.promo.upgradeTitle', 'Expand to 20/week with Premium')}
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                        {t('dashboard.promo.upgradeDesc', '7-day free trial — Micro analysis & AI coaching available')}
                    </p>
                    <Link
                        href="/pricing"
                        className="inline-block px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                        {t('dashboard.promo.upgradeCta', 'Try free for 7 days')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
