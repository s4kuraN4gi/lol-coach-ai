"use client";

import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/app/Providers/AuthProvider";
import { useState } from "react";
import { LuMenu, LuX, LuLayoutDashboard } from "react-icons/lu";

export default function PublicHeader() {
    const { t } = useTranslation();
    const { user, loading } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const isLoggedIn = !loading && !!user;

    return (
        <nav className="sticky top-0 w-full z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-cyan-500/10">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight">
                        <span className="text-cyan-400">LoL</span> Coach AI
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex gap-4 items-center">
                    <Link
                        href="/champions"
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        {t('publicNav.champions')}
                    </Link>
                    <Link
                        href="/items"
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        {t('publicNav.items')}
                    </Link>
                    <Link
                        href="/guide/gold"
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        {t('publicNav.guideGold')}
                    </Link>
                    <Link
                        href="/guide/runes"
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        {t('publicNav.guideRunes')}
                    </Link>
                    <Link
                        href="/pricing"
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        {t('publicNav.pricing')}
                    </Link>
                    <LanguageSwitcher />
                    {isLoggedIn ? (
                        <Link
                            href="/dashboard"
                            className="px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 flex items-center gap-2"
                        >
                            <LuLayoutDashboard />
                            {t('publicNav.dashboard')}
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
                            >
                                {t('publicNav.login')}
                            </Link>
                            <Link
                                href="/signup"
                                className="px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                            >
                                {t('publicNav.getStarted')}
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-gray-400 hover:text-white"
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    {menuOpen ? <LuX size={24} /> : <LuMenu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-white/5 bg-[#0a0a0f]/95 backdrop-blur-xl px-6 py-4 space-y-3">
                    <Link href="/champions" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                        {t('publicNav.champions')}
                    </Link>
                    <Link href="/items" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                        {t('publicNav.items')}
                    </Link>
                    <Link href="/guide/gold" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                        {t('publicNav.guideGold')}
                    </Link>
                    <Link href="/guide/runes" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                        {t('publicNav.guideRunes')}
                    </Link>
                    <Link href="/pricing" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                        {t('publicNav.pricing')}
                    </Link>
                    {isLoggedIn ? (
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg w-fit"
                            onClick={() => setMenuOpen(false)}
                        >
                            <LuLayoutDashboard />
                            {t('publicNav.dashboard')}
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className="block text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>
                                {t('publicNav.login')}
                            </Link>
                            <div className="flex items-center gap-4 pt-2">
                                <LanguageSwitcher />
                                <Link
                                    href="/signup"
                                    className="px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    {t('publicNav.getStarted')}
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}
        </nav>
    );
}
