"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/contexts/LanguageContext";
import { fetchAllChampions } from "@/app/actions/riot";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";
import { useBackUrl } from "@/hooks/useBackUrl";

const ROLES = ["all", "Fighter", "Tank", "Mage", "Assassin", "Marksman", "Support"] as const;

type Props = {
    champions: any[];
    version: string;
};

export default function ChampionListClient({ champions: initialChampions, version: initialVersion }: Props) {
    const { t, language } = useTranslation();
    const backUrl = useBackUrl();
    const [search, setSearch] = useState("");
    const [activeRole, setActiveRole] = useState<string>("all");
    const [champions, setChampions] = useState(initialChampions);
    const [version, setVersion] = useState(initialVersion);

    // Re-fetch champion data when language changes
    useEffect(() => {
        let cancelled = false;
        fetchAllChampions(language).then((result) => {
            if (cancelled || !result) return;
            setChampions(result.champions);
            setVersion(result.version);
        });
        return () => { cancelled = true; };
    }, [language]);

    const filtered = useMemo(() => {
        return champions
            .filter((c) => {
                const nameMatch =
                    c.name.toLowerCase().includes(search.toLowerCase()) ||
                    c.id.toLowerCase().includes(search.toLowerCase());
                const roleMatch =
                    activeRole === "all" || (c.tags as string[]).includes(activeRole);
                return nameMatch && roleMatch;
            })
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }, [champions, search, activeRole]);

    return (
        <div className="container mx-auto px-6 py-10">
            {/* Back Link */}
            <Link href={backUrl} className="inline-block text-sm text-slate-400 hover:text-white transition mb-6">
                {backUrl === "/dashboard" ? t('common.backToDashboard') : t('common.backToHome')}
            </Link>

            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-black mb-3">
                    <span className="text-cyan-400">{t('championDb.title')}</span>
                </h1>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    {t('championDb.subtitle')}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    {t('championDb.champCount').replace('{count}', String(champions.length))}
                </p>
            </div>

            {/* Search + Filters */}
            <div className="mb-8 space-y-4">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('championDb.searchPlaceholder')}
                    className="w-full max-w-md mx-auto block px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                />
                <div className="flex flex-wrap justify-center gap-2">
                    {ROLES.map((role) => (
                        <button
                            key={role}
                            onClick={() => setActiveRole(role)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                activeRole === role
                                    ? "bg-cyan-500 text-black"
                                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            {t(`championDb.roles.${role}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* AdSense Top */}
            <AdSenseBanner className="mb-8 h-[90px]" format="auto" />

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    {t('championDb.noResults')}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filtered.map((champ) => (
                        <Link
                            key={champ.id}
                            href={`/champions/${champ.id}`}
                            className="group bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-cyan-500/30 hover:bg-white/[0.06] transition-all"
                        >
                            <div className="relative w-1/2 aspect-square mx-auto mb-3 overflow-hidden rounded-lg bg-black/30">
                                <Image
                                    src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.image.full}`}
                                    alt={champ.name}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                            </div>
                            <h3 className="font-bold text-white text-sm truncate">
                                {champ.name}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                                {champ.title}
                            </p>
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {(champ.tags as string[]).map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded"
                                    >
                                        {t(`championDb.roles.${tag}`)}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* AdSense Bottom */}
            <AdSenseBanner className="mt-8 h-[90px]" format="auto" />
        </div>
    );
}
