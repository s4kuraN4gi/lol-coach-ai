"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";


type Props = {
    isPremium: boolean;
    children: React.ReactNode;
    fallbackDescription?: string; // Legacy support
    description?: string; // Preferred
    title?: string;
    blurAmount?: "sm" | "md" | "lg";
    onUpgrade?: () => Promise<void> | void;
    requiredTier?: 'premium' | 'extra';
    subscriptionTier?: string;
};

export default function PremiumFeatureGate({
    isPremium,
    children,
    blurAmount = "sm",
    requiredTier = 'premium',
    subscriptionTier,
}: Props) {
    const { t } = useTranslation();

    // For 'premium' requirement: isPremium flag is sufficient (covers both premium and extra)
    // For 'extra' requirement: must specifically be on the extra tier
    const hasAccess = requiredTier === 'extra'
        ? subscriptionTier === 'extra'
        : isPremium;

    if (hasAccess) {
        return <>{children}</>;
    }

    const messageKey = requiredTier === 'extra'
        ? 'premium.featureGate.extraOnly'
        : 'premium.featureGate.premiumOnly';
    const defaultMessage = requiredTier === 'extra'
        ? 'Extraプラン限定機能'
        : 'プレミアムプランのみ有効';

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* Grayed out Content */}
            <div className={`filter ${
                blurAmount === 'sm' ? 'blur-[2px]' :
                blurAmount === 'md' ? 'blur-sm' : 'blur-md'
            } pointer-events-none select-none opacity-40 grayscale`}>
                {children}
            </div>

            {/* CTA Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/30">
                <div className="text-center space-y-3 max-w-xs px-4">
                    {/* Lock icon */}
                    <div className="mx-auto w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-600/50">
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    {/* Title */}
                    <p className="text-sm font-semibold text-slate-200">
                        {t(messageKey, defaultMessage)}
                    </p>
                    {/* Benefit */}
                    <p className="text-xs text-slate-400">
                        {t(
                            requiredTier === 'extra' ? 'premium.featureGate.extraBenefit' : 'premium.featureGate.premiumBenefit',
                            requiredTier === 'extra' ? 'AIダメージ分析や高度な機能が利用可能に' : 'AIコーチング・ミクロ分析などが利用可能に'
                        )}
                    </p>
                    {/* CTA Button */}
                    <Link
                        href="/pricing"
                        className="inline-block px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-900 text-sm font-bold hover:from-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
                    >
                        {t('premium.featureGate.upgradeNow', 'アップグレード')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
