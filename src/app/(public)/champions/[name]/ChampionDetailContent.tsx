"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";
import { fetchChampionDetail } from "@/app/actions/riot";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";

type Props = {
    champion: any;
    version: string;
    champId: string;
};

const STAT_KEYS: { key: string; growth: string | null; isPercent?: boolean }[] = [
    { key: "hp", growth: "hpperlevel" },
    { key: "mp", growth: "mpperlevel" },
    { key: "attackdamage", growth: "attackdamageperlevel" },
    { key: "armor", growth: "armorperlevel" },
    { key: "spellblock", growth: "spellblockperlevel" },
    { key: "attackspeed", growth: "attackspeedperlevel", isPercent: true },
    { key: "movespeed", growth: null },
    { key: "attackrange", growth: null },
    { key: "hpregen", growth: "hpregenperlevel" },
    { key: "mpregen", growth: "mpregenperlevel" },
];

const SPELL_KEYS = ["Q", "W", "E", "R"];

export default function ChampionDetailContent({ champion: initialChampion, version, champId }: Props) {
    const { t, language } = useTranslation();
    const [champion, setChampion] = useState(initialChampion);

    // Re-fetch champion detail when language changes
    useEffect(() => {
        let cancelled = false;
        fetchChampionDetail(champId, language).then((result) => {
            if (cancelled || !result) return;
            setChampion(result);
        });
        return () => { cancelled = true; };
    }, [language, champId]);

    const stats = champion.stats || {};
    const spells = champion.spells || [];
    const passive = champion.passive;

    return (
        <div className="min-h-screen">
            {/* Hero Section with Splash Art */}
            <div className="relative h-[300px] md:h-[400px] overflow-hidden">
                <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champId}_0.jpg`}
                    alt={champion.name}
                    fill
                    className="object-cover object-top"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <div className="container mx-auto flex items-end gap-4">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 border-cyan-500/50 flex-shrink-0">
                            <Image
                                src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`}
                                alt={champion.name}
                                width={96}
                                height={96}
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black text-white">
                                {champion.name}
                            </h1>
                            <p className="text-lg text-gray-400">{champion.title}</p>
                            <div className="flex gap-2 mt-2">
                                {(champion.tags as string[]).map((tag: string) => (
                                    <span
                                        key={tag}
                                        className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-md font-medium"
                                    >
                                        {t(`championDb.roles.${tag}`)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-10 space-y-12">
                {/* Base Stats */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-3">
                        {t('championDb.stats')}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {STAT_KEYS.map(({ key, growth, isPercent }) => (
                            <div
                                key={key}
                                className="bg-white/[0.03] border border-white/5 rounded-lg p-4"
                            >
                                <div className="text-xs text-gray-500 mb-1">
                                    {t(`championDb.statsTable.${key}`)}
                                </div>
                                <div className="text-xl font-bold text-white">
                                    {isPercent
                                        ? `${(stats[key] * 100).toFixed(1)}%`
                                        : Math.round(stats[key] * 10) / 10}
                                </div>
                                {growth && stats[growth] != null && (
                                    <div className="text-xs text-cyan-400 mt-1">
                                        +{isPercent
                                            ? `${stats[growth]}%`
                                            : Math.round(stats[growth] * 10) / 10}
                                        {t('championDb.perLevel')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* AdSense */}
                <AdSenseBanner className="h-[90px]" format="auto" />

                {/* Abilities */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-3">
                        {t('championDb.abilities')}
                    </h2>
                    <div className="space-y-6">
                        {/* Passive */}
                        {passive && (
                            <div className="flex gap-4 bg-white/[0.03] border border-white/5 rounded-lg p-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-amber-500/30">
                                        <Image
                                            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${passive.image.full}`}
                                            alt={passive.name}
                                            width={48}
                                            height={48}
                                        />
                                    </div>
                                    <div className="text-[10px] text-center text-amber-400 mt-1 font-bold">
                                        {t('championDb.passive')}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white">{passive.name}</h3>
                                    <p
                                        className="text-sm text-gray-400 mt-1"
                                        dangerouslySetInnerHTML={{ __html: passive.description }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Q/W/E/R */}
                        {spells.map((spell: any, idx: number) => (
                            <div
                                key={spell.id}
                                className="flex gap-4 bg-white/[0.03] border border-white/5 rounded-lg p-4"
                            >
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-cyan-500/30">
                                        <Image
                                            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.image.full}`}
                                            alt={spell.name}
                                            width={48}
                                            height={48}
                                        />
                                    </div>
                                    <div className="text-[10px] text-center text-cyan-400 mt-1 font-bold">
                                        {SPELL_KEYS[idx]}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white">{spell.name}</h3>
                                    <p
                                        className="text-sm text-gray-400 mt-1"
                                        dangerouslySetInnerHTML={{ __html: spell.description }}
                                    />
                                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                        {spell.cooldownBurn && (
                                            <span>
                                                {t('championDb.cooldown')}: {spell.cooldownBurn}s
                                            </span>
                                        )}
                                        {spell.costBurn && spell.costBurn !== "0" && (
                                            <span>
                                                {t('championDb.cost')}: {spell.costBurn} {spell.costType?.replace('&nbsp;', ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Lore */}
                {champion.lore && (
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-3">
                            {t('championDb.lore')}
                        </h2>
                        <p className="text-gray-400 leading-relaxed whitespace-pre-line">
                            {champion.lore}
                        </p>
                    </section>
                )}

                {/* Tips */}
                {((champion.allytips && champion.allytips.length > 0) ||
                    (champion.enemytips && champion.enemytips.length > 0)) && (
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-3">
                            {t('championDb.tips')}
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {champion.allytips && champion.allytips.length > 0 && (
                                <div className="bg-white/[0.03] border border-emerald-500/20 rounded-lg p-5">
                                    <h3 className="font-bold text-emerald-400 mb-3">
                                        {t('championDb.allyTips')}
                                    </h3>
                                    <ul className="space-y-2">
                                        {champion.allytips.map((tip: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-400 flex gap-2">
                                                <span className="text-emerald-400 flex-shrink-0">-</span>
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {champion.enemytips && champion.enemytips.length > 0 && (
                                <div className="bg-white/[0.03] border border-red-500/20 rounded-lg p-5">
                                    <h3 className="font-bold text-red-400 mb-3">
                                        {t('championDb.enemyTips')}
                                    </h3>
                                    <ul className="space-y-2">
                                        {champion.enemytips.map((tip: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-400 flex gap-2">
                                                <span className="text-red-400 flex-shrink-0">-</span>
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* CTA */}
                <section className="text-center py-10 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl border border-cyan-500/20">
                    <h2 className="text-2xl font-bold text-white mb-4">
                        {t('championDb.ctaTitle')}
                    </h2>
                    <Link
                        href="/analyze"
                        className="inline-block px-8 py-3 text-lg font-bold bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/25"
                    >
                        {t('championDb.ctaButton')}
                    </Link>
                </section>

                {/* AdSense Bottom */}
                <AdSenseBanner className="h-[90px]" format="auto" />
            </div>
        </div>
    );
}
