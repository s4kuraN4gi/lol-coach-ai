"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaCheck, FaTimes, FaCrown, FaUser, FaUserPlus, FaArrowLeft, FaStar } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { canPerformGuestAnalysis } from "@/app/actions/guestAnalysis";
import { triggerStripeCheckout, triggerStripePortal } from "@/lib/checkout";

type PlanFeature = {
    name: string;
    guest: string | boolean;
    free: string | boolean;
    premium: string | boolean;
    extra: string | boolean;
};

type UserPlan = "guest" | "free" | "premium" | "extra";

export default function PricingPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [userPlan, setUserPlan] = useState<UserPlan | null>(null); // null = loading
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        // First try getAnalysisStatus for logged-in users (gives subscription_tier)
        import("@/app/actions/analysis").then(({ getAnalysisStatus }) => {
            getAnalysisStatus().then((status) => {
                if (status) {
                    if (status.subscription_tier === 'extra') {
                        setUserPlan("extra");
                    } else if (status.is_premium) {
                        setUserPlan("premium");
                    } else {
                        setUserPlan("free");
                    }
                } else {
                    // Not logged in, check guest
                    canPerformGuestAnalysis().then((info) => {
                        setUserPlan(info.isGuest ? "guest" : "free");
                    }).catch(() => setUserPlan("guest"));
                }
            });
        });
    }, []);

    const features: PlanFeature[] = [
        {
            name: t('pricingPage.features.analysisCount'),
            guest: t('pricingPage.guest.analysisFreqShort'),
            free: t('pricingPage.free.weeklyAnalysis'),
            premium: t('pricingPage.premium.weeklyAnalysis'),
            extra: t('pricingPage.extra.weeklyAnalysis'),
        },
        {
            name: t('pricingPage.features.segmentCount'),
            guest: t('pricingPage.guest.fixedSegments'),
            free: t('pricingPage.free.twoSegments'),
            premium: t('pricingPage.premium.fourSegments'),
            extra: t('pricingPage.extra.fiveSegments'),
        },
        {
            name: t('pricingPage.features.segmentMethod'),
            guest: t('pricingPage.guest.fixedMethod'),
            free: t('pricingPage.guest.autoMethod'),
            premium: t('pricingPage.guest.autoMethod'),
            extra: t('pricingPage.extra.autoSegments'),
        },
        {
            name: t('pricingPage.features.riotApi'),
            guest: false,
            free: true,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.matchHistory'),
            guest: false,
            free: true,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.analysisSave'),
            guest: false,
            free: true,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.buildAdvice'),
            guest: false,
            free: false,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.championStats'),
            guest: false,
            free: true,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.detailedStats'),
            guest: false,
            free: true,
            premium: true,
            extra: true,
        },
        {
            name: t('pricingPage.features.ads'),
            guest: t('pricingPage.features.adsYes'),
            free: t('pricingPage.features.adsYes'),
            premium: t('pricingPage.features.adsNo'),
            extra: t('pricingPage.features.adsNo'),
        },
        {
            name: t('pricingPage.features.aiDamageAnalysis'),
            guest: false,
            free: false,
            premium: false,
            extra: true,
        },
    ];

    const renderFeatureValue = (value: string | boolean) => {
        if (typeof value === "boolean") {
            return value ? (
                <FaCheck className="text-emerald-400 mx-auto" />
            ) : (
                <FaTimes className="text-slate-600 mx-auto" />
            );
        }
        return <span className="text-sm">{value}</span>;
    };

    // Determine grid columns: guests see 4 cards, logged-in users see 3 (Free, Premium, Extra)
    const isLoggedIn = userPlan === "free" || userPlan === "premium" || userPlan === "extra";
    const gridCols = isLoggedIn ? "md:grid-cols-3 max-w-5xl mx-auto" : "md:grid-cols-4";

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                            <FaArrowLeft />
                            <span className="hidden sm:inline">{t('pricingPage.header.back')}</span>
                        </button>
                        <Link href="/" className="text-2xl font-black italic tracking-tighter text-white">
                            LoL<span className="text-blue-500">Coach</span>AI
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        {userPlan === "guest" || userPlan === null ? (
                            <>
                                <Link
                                    href="/analyze"
                                    className="text-sm text-slate-400 hover:text-white transition"
                                >
                                    {t('pricingPage.header.tryFree')}
                                </Link>
                                <Link
                                    href="/login"
                                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                                >
                                    {t('pricingPage.header.login')}
                                </Link>
                            </>
                        ) : (
                            <Link
                                href="/dashboard"
                                className="text-sm text-blue-400 hover:text-blue-300 transition"
                            >
                                {t('pricingPage.header.dashboard')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12">
                {/* Page Title */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white mb-4">
                        <span className="text-cyan-400">{t('pricingPage.title')}</span>
                    </h1>
                    <p className="text-slate-400 text-lg">
                        {t('pricingPage.subtitle')}
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className={`grid gap-6 mb-16 ${gridCols}`}>
                    {/* Guest Plan - hidden for logged-in users */}
                    {(userPlan === "guest" || userPlan === null) && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUser className="text-slate-400 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t('pricingPage.guest.name')}</h2>
                            <div className="text-3xl font-black text-white">
                                ¥0
                                <span className="text-sm font-normal text-slate-500">{t('pricingPage.guest.price')}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2">
                                {t('pricingPage.guest.desc')}
                            </p>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1">
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.analysisFreq')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.fixedSegmentsDesc')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.aiMacro')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-500">
                                <FaTimes className="mt-0.5 flex-shrink-0" />
                                <span>{t('pricingPage.guest.noMatchData')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-500">
                                <FaTimes className="mt-0.5 flex-shrink-0" />
                                <span>{t('pricingPage.guest.noSaveHistory')}</span>
                            </li>
                        </ul>

                        <Link
                            href="/analyze"
                            className="block w-full py-3 text-center bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition"
                        >
                            {t('pricingPage.guest.tryNow')}
                        </Link>
                    </div>
                    )}

                    {/* Free Plan */}
                    <div className="bg-slate-900/50 border border-blue-500/50 rounded-2xl p-6 flex flex-col relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                {t('pricingPage.free.badge')}
                            </span>
                        </div>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUserPlus className="text-blue-400 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t('pricingPage.free.name')}</h2>
                            <div className="text-3xl font-black text-white">
                                ¥0
                                <span className="text-sm font-normal text-slate-500">{t('pricingPage.free.price')}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2">
                                {t('pricingPage.free.desc')}
                            </p>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1">
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.weeklyAnalysisDesc')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-blue-400">{t('pricingPage.free.autoSelect')}</strong>{t('pricingPage.free.autoSegments')}
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.aiMacro')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-blue-400">{t('pricingPage.free.riotApi')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.matchHistoryView')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.saveHistory')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-500">
                                <FaTimes className="mt-0.5 flex-shrink-0" />
                                <span>{t('pricingPage.free.noBuildAdvice')}</span>
                            </li>
                        </ul>

                        {userPlan === "free" ? (
                            <button
                                disabled
                                className="block w-full py-3 text-center bg-blue-600 text-blue-300 font-bold rounded-lg opacity-50 cursor-not-allowed"
                            >
                                {t('pricingPage.free.currentPlan')}
                            </button>
                        ) : (
                            <Link
                                href="/signup"
                                className="block w-full py-3 text-center bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition shadow-lg shadow-blue-500/20"
                            >
                                {t('pricingPage.free.register')}
                            </Link>
                        )}
                    </div>

                    {/* Premium Plan */}
                    <div className="bg-gradient-to-b from-amber-900/20 to-orange-900/10 border border-amber-500/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />

                        <div className="text-center mb-6 relative">
                            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaCrown className="text-amber-400 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t('pricingPage.premium.name')}</h2>
                            <div className="text-3xl font-black text-white">
                                ¥980
                                <span className="text-sm font-normal text-slate-500">{t('pricingPage.premium.priceUnit')}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2">
                                {t('pricingPage.premium.desc')}
                            </p>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1 relative">
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-amber-400">{t('pricingPage.premium.weeklyAnalysis')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    {t('pricingPage.premium.autoSegments')}
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.aiMacro')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.riotApi')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.matchHistoryView')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.saveHistory')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-amber-400">{t('pricingPage.premium.buildAdvice')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-amber-400">{t('pricingPage.premium.noAds')}</strong>
                                </span>
                            </li>
                        </ul>

                        {userPlan === "premium" ? (
                            <button
                                onClick={async () => {
                                    setIsActionLoading(true);
                                    try {
                                        await triggerStripePortal();
                                    } finally {
                                        setIsActionLoading(false);
                                    }
                                }}
                                disabled={isActionLoading}
                                className="block w-full py-3 text-center bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 text-red-300 font-bold rounded-lg transition disabled:opacity-50"
                            >
                                {isActionLoading ? t('pricingPage.premium.processing') : t('pricingPage.premium.unsubscribe')}
                            </button>
                        ) : userPlan === "free" ? (
                            <button
                                onClick={async () => {
                                    setIsActionLoading(true);
                                    try {
                                        await triggerStripeCheckout('premium');
                                    } finally {
                                        setIsActionLoading(false);
                                    }
                                }}
                                disabled={isActionLoading}
                                className="block w-full py-3 text-center bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                            >
                                {isActionLoading ? t('pricingPage.premium.processing') : t('pricingPage.premium.subscribe')}
                            </button>
                        ) : (
                            <Link
                                href="/signup"
                                className="block w-full py-3 text-center bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg transition shadow-lg shadow-amber-500/20"
                            >
                                {t('pricingPage.premium.subscribe')}
                            </Link>
                        )}
                    </div>

                    {/* Extra Plan */}
                    <div className="bg-gradient-to-b from-violet-900/20 to-purple-900/10 border border-violet-500/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl" />

                        <div className="text-center mb-6 relative">
                            <div className="w-12 h-12 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaStar className="text-violet-400 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{t('pricingPage.extra.name')}</h2>
                            <div className="text-3xl font-black text-white">
                                ¥2,980
                                <span className="text-sm font-normal text-slate-500">{t('pricingPage.extra.priceUnit')}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2">
                                {t('pricingPage.extra.desc')}
                            </p>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1 relative">
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-violet-400">{t('pricingPage.extra.weeklyAnalysis')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    {t('pricingPage.extra.autoSegments')}
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.guest.aiMacro')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.riotApi')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.matchHistoryView')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{t('pricingPage.free.saveHistory')}</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-violet-400">{t('pricingPage.premium.buildAdvice')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-violet-400">{t('pricingPage.premium.noAds')}</strong>
                                </span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <FaCheck className="text-violet-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">
                                    <strong className="text-violet-400">{t('pricingPage.extra.aiDamageAnalysis')}</strong>
                                </span>
                            </li>
                        </ul>

                        {userPlan === "extra" ? (
                            <button
                                onClick={async () => {
                                    setIsActionLoading(true);
                                    try {
                                        await triggerStripePortal();
                                    } finally {
                                        setIsActionLoading(false);
                                    }
                                }}
                                disabled={isActionLoading}
                                className="block w-full py-3 text-center bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 text-red-300 font-bold rounded-lg transition disabled:opacity-50"
                            >
                                {isActionLoading ? t('pricingPage.extra.processing') : t('pricingPage.extra.unsubscribe')}
                            </button>
                        ) : userPlan === "free" || userPlan === "premium" ? (
                            <button
                                onClick={async () => {
                                    setIsActionLoading(true);
                                    try {
                                        await triggerStripeCheckout('extra');
                                    } finally {
                                        setIsActionLoading(false);
                                    }
                                }}
                                disabled={isActionLoading}
                                className="block w-full py-3 text-center bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-lg transition shadow-lg shadow-violet-500/20 disabled:opacity-50"
                            >
                                {isActionLoading ? t('pricingPage.extra.processing') : t('pricingPage.extra.subscribe')}
                            </button>
                        ) : (
                            <Link
                                href="/signup"
                                className="block w-full py-3 text-center bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-lg transition shadow-lg shadow-violet-500/20"
                            >
                                {t('pricingPage.extra.subscribe')}
                            </Link>
                        )}
                    </div>
                </div>

                {/* Feature Comparison Table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-bold text-white">{t('pricingPage.comparison.title')}</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left p-4 text-slate-400 font-medium">{t('pricingPage.comparison.feature')}</th>
                                    <th className="p-4 text-center text-slate-400 font-medium w-28">
                                        <div className="flex flex-col items-center gap-1">
                                            <FaUser className="text-slate-500" />
                                            <span>{t('pricingPage.guest.name')}</span>
                                        </div>
                                    </th>
                                    <th className="p-4 text-center text-blue-400 font-medium w-28">
                                        <div className="flex flex-col items-center gap-1">
                                            <FaUserPlus className="text-blue-400" />
                                            <span>{t('pricingPage.free.name')}</span>
                                        </div>
                                    </th>
                                    <th className="p-4 text-center text-amber-400 font-medium w-28">
                                        <div className="flex flex-col items-center gap-1">
                                            <FaCrown className="text-amber-400" />
                                            <span>{t('pricingPage.premium.name')}</span>
                                        </div>
                                    </th>
                                    <th className="p-4 text-center text-violet-400 font-medium w-28">
                                        <div className="flex flex-col items-center gap-1">
                                            <FaStar className="text-violet-400" />
                                            <span>{t('pricingPage.extra.name')}</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {features.map((feature, index) => (
                                    <tr
                                        key={feature.name}
                                        className={index % 2 === 0 ? "bg-slate-800/20" : ""}
                                    >
                                        <td className="p-4 text-slate-300">{feature.name}</td>
                                        <td className="p-4 text-center text-slate-400">
                                            {renderFeatureValue(feature.guest)}
                                        </td>
                                        <td className="p-4 text-center text-slate-300">
                                            {renderFeatureValue(feature.free)}
                                        </td>
                                        <td className="p-4 text-center text-slate-300">
                                            {renderFeatureValue(feature.premium)}
                                        </td>
                                        <td className="p-4 text-center text-slate-300">
                                            {renderFeatureValue(feature.extra)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-16">
                    <h2 className="text-2xl font-bold text-white text-center mb-8">
                        {t('pricingPage.faq.title')}
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="font-bold text-white mb-2">
                                {t('pricingPage.faq.q1')}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {t('pricingPage.faq.a1')}
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="font-bold text-white mb-2">
                                {t('pricingPage.faq.q2')}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {t('pricingPage.faq.a2')}
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="font-bold text-white mb-2">
                                {t('pricingPage.faq.q3')}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {t('pricingPage.faq.a3')}
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="font-bold text-white mb-2">
                                {t('pricingPage.faq.q4')}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {t('pricingPage.faq.a4')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* CTA Section */}
                {userPlan === "extra" ? (
                    <div className="mt-16 text-center">
                        <div className="bg-gradient-to-r from-violet-900/20 to-purple-900/20 border border-violet-500/30 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">
                                {t('pricingPage.ctaPremium.title')}
                            </h2>
                            <p className="text-slate-400 mb-6">
                                {t('pricingPage.ctaPremium.desc')}
                            </p>
                            <Link
                                href="/dashboard"
                                className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg transition inline-block"
                            >
                                {t('pricingPage.ctaPremium.button')}
                            </Link>
                        </div>
                    </div>
                ) : userPlan === "premium" ? (
                    <div className="mt-16 text-center">
                        <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">
                                {t('pricingPage.ctaPremium.title')}
                            </h2>
                            <p className="text-slate-400 mb-6">
                                {t('pricingPage.ctaPremium.desc')}
                            </p>
                            <Link
                                href="/dashboard"
                                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition inline-block"
                            >
                                {t('pricingPage.ctaPremium.button')}
                            </Link>
                        </div>
                    </div>
                ) : userPlan === "free" ? (
                    <div className="mt-16 text-center">
                        <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">
                                {t('pricingPage.ctaUpgrade.title')}
                            </h2>
                            <p className="text-slate-400 mb-6">
                                {t('pricingPage.ctaUpgrade.desc')}
                            </p>
                            <button
                                onClick={async () => {
                                    setIsActionLoading(true);
                                    try {
                                        await triggerStripeCheckout('premium');
                                    } finally {
                                        setIsActionLoading(false);
                                    }
                                }}
                                disabled={isActionLoading}
                                className="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg transition disabled:opacity-50"
                            >
                                {isActionLoading ? t('pricingPage.premium.processing') : t('pricingPage.premium.subscribe')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-16 text-center">
                        <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">
                                {t('pricingPage.ctaGuest.title')}
                            </h2>
                            <p className="text-slate-400 mb-6">
                                {t('pricingPage.ctaGuest.desc')}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/analyze"
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition"
                                >
                                    {t('pricingPage.ctaGuest.tryGuest')}
                                </Link>
                                <Link
                                    href="/signup"
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                >
                                    {t('pricingPage.ctaGuest.registerFree')}
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 mt-16 py-8">
                <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
                    <p>{t('footer.copyright').replace('{year}', '2024')}</p>
                    <div className="mt-2 flex justify-center gap-4">
                        <Link href="/terms" className="hover:text-slate-300">{t('footer.terms')}</Link>
                        <Link href="/privacy" className="hover:text-slate-300">{t('footer.privacy')}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
