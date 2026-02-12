"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchRunesReforged } from "@/app/actions/riot";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";
import { useBackUrl } from "@/hooks/useBackUrl";

type RuneData = {
    id: number;
    key: string;
    icon: string;
    name: string;
    slots: {
        runes: {
            id: number;
            key: string;
            icon: string;
            name: string;
            shortDesc: string;
            longDesc: string;
        }[];
    }[];
};

const TREE_COLORS: Record<string, string> = {
    Precision: "#C8AA6E",
    Domination: "#D44242",
    Sorcery: "#9B6CDC",
    Resolve: "#49AA19",
    Inspiration: "#49AAB8",
};

const TREE_BG: Record<string, string> = {
    Precision: "from-amber-950/30 to-slate-900",
    Domination: "from-red-950/30 to-slate-900",
    Sorcery: "from-purple-950/30 to-slate-900",
    Resolve: "from-green-950/30 to-slate-900",
    Inspiration: "from-cyan-950/30 to-slate-900",
};

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "");
}

export default function RuneGuideClient({ runeData: initialData }: { runeData: RuneData[] }) {
    const { t, language } = useLanguage();
    const backUrl = useBackUrl();
    const [runeData, setRuneData] = useState<RuneData[]>(initialData);
    const [selectedTree, setSelectedTree] = useState(0);
    const [expandedRune, setExpandedRune] = useState<number | null>(null);

    // Re-fetch when language changes
    useEffect(() => {
        let cancelled = false;
        fetchRunesReforged(language as 'ja' | 'en' | 'ko').then(result => {
            if (!cancelled && result?.runes) {
                setRuneData(result.runes);
            }
        });
        return () => { cancelled = true; };
    }, [language]);

    if (!runeData || runeData.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-20 text-center text-slate-500">
                Failed to load rune data.
            </div>
        );
    }

    const tree = runeData[selectedTree];
    const treeKey = tree?.key || "Precision";
    const treeColor = TREE_COLORS[treeKey] || "#C8AA6E";
    const keystones = tree?.slots?.[0]?.runes || [];
    const secondarySlots = tree?.slots?.slice(1) || [];

    return (
        <div className="max-w-6xl mx-auto px-4 pb-20">
            {/* Back Link */}
            <Link href={backUrl} className="inline-block text-sm text-slate-400 hover:text-white transition mb-6">
                {backUrl === "/dashboard" ? t('common.backToDashboard') : t('common.backToHome')}
            </Link>

            <AdSenseBanner className="mb-6 min-h-[90px]" />

            {/* Header */}
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black italic tracking-tighter text-foreground mb-3">
                    {t('runeGuide.title')}
                </h1>
                <p className="text-lg text-slate-400">
                    {t('runeGuide.subtitle')}
                </p>
            </header>

            {/* Tree Selection Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
                {runeData.map((tree, idx) => {
                    const key = tree.key || "";
                    const color = TREE_COLORS[key] || "#888";
                    const isActive = idx === selectedTree;
                    return (
                        <button
                            key={tree.id}
                            onClick={() => { setSelectedTree(idx); setExpandedRune(null); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all border"
                            style={{
                                borderColor: isActive ? color : "transparent",
                                backgroundColor: isActive ? `${color}15` : "rgba(30,30,40,0.5)",
                                color: isActive ? color : "#94a3b8",
                            }}
                        >
                            <img
                                src={`https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`}
                                alt={tree.name}
                                className="w-6 h-6"
                            />
                            <span className="hidden sm:inline">{t(`runeGuide.trees.${key}`) || tree.name}</span>
                        </button>
                    );
                })}
            </div>

            {/* Selected Tree Content */}
            <div className={`bg-gradient-to-br ${TREE_BG[treeKey] || "from-slate-900 to-slate-900"} rounded-2xl border border-white/10 overflow-hidden`}>

                {/* Tree Header */}
                <div className="p-6 border-b border-white/5 flex items-center gap-4">
                    <img
                        src={`https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`}
                        alt={tree.name}
                        className="w-12 h-12"
                    />
                    <div>
                        <h2 className="text-2xl font-black" style={{ color: treeColor }}>
                            {t(`runeGuide.trees.${treeKey}`) || tree.name}
                        </h2>
                        <p className="text-sm text-slate-400">{tree.name}</p>
                    </div>
                </div>

                {/* Keystones */}
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: treeColor }}>
                        {t('runeGuide.keystones')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {keystones.map((rune) => {
                            const isExpanded = expandedRune === rune.id;
                            return (
                                <div
                                    key={rune.id}
                                    className="bg-slate-900/60 border border-white/5 rounded-xl p-4 hover:border-white/15 transition cursor-pointer"
                                    onClick={() => setExpandedRune(isExpanded ? null : rune.id)}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <img
                                            src={`https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`}
                                            alt={rune.name}
                                            className="w-12 h-12 rounded-full border-2 p-0.5"
                                            style={{ borderColor: treeColor }}
                                        />
                                        <div>
                                            <div className="font-bold text-foreground text-sm">{rune.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{rune.key}</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {stripHtml(rune.shortDesc)}
                                    </p>
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-300 leading-relaxed">
                                            {stripHtml(rune.longDesc)}
                                            <button
                                                className="block mt-2 text-slate-500 hover:text-white text-[10px] transition"
                                                onClick={(e) => { e.stopPropagation(); setExpandedRune(null); }}
                                            >
                                                {t('runeGuide.hideDetails')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Secondary Runes (Slots 1-3) */}
                {secondarySlots.map((slot, slotIdx) => (
                    <div key={slotIdx} className="p-6 border-b border-white/5 last:border-b-0">
                        <h3 className="text-sm font-bold uppercase tracking-widest mb-4 text-slate-500">
                            {t('runeGuide.secondaryRunes')} - {t('runeGuide.slot').replace('{n}', String(slotIdx + 1))}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {slot.runes.map((rune) => {
                                const isExpanded = expandedRune === rune.id;
                                return (
                                    <div
                                        key={rune.id}
                                        className="bg-slate-900/40 border border-white/5 rounded-lg p-3 hover:border-white/10 transition cursor-pointer"
                                        onClick={() => setExpandedRune(isExpanded ? null : rune.id)}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <img
                                                src={`https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`}
                                                alt={rune.name}
                                                className="w-8 h-8"
                                            />
                                            <div className="font-bold text-foreground text-sm">{rune.name}</div>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {stripHtml(rune.shortDesc)}
                                        </p>
                                        {isExpanded && (
                                            <div className="mt-2 pt-2 border-t border-white/5 text-xs text-slate-300 leading-relaxed">
                                                {stripHtml(rune.longDesc)}
                                                <button
                                                    className="block mt-2 text-slate-500 hover:text-white text-[10px] transition"
                                                    onClick={(e) => { e.stopPropagation(); setExpandedRune(null); }}
                                                >
                                                    {t('runeGuide.hideDetails')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <AdSenseBanner className="mt-8 min-h-[90px]" />
        </div>
    );
}
