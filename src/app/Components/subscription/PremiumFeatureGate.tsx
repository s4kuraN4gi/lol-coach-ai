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

            {/* Simple Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-sm text-slate-400 font-medium">
                        {t(messageKey, defaultMessage)}
                    </p>
                    <Link
                        href="/pricing"
                        className="text-xs text-slate-500 hover:text-slate-300 transition"
                    >
                        {t('premium.featureGate.viewPlans', '料金プランを見る')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
