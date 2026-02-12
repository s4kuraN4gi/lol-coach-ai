"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/contexts/LanguageContext";
import { fetchDDItemData } from "@/app/actions/riot";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";
import { useBackUrl } from "@/hooks/useBackUrl";

const CATEGORIES = [
    { key: "all" },
    { key: "damage" },
    { key: "ap" },
    { key: "defense" },
    { key: "boots" },
] as const;

function categorizeItem(item: any): string[] {
    const cats: string[] = [];
    const stats = item.stats || {};
    const tags = item.tags || [];
    if (stats.FlatPhysicalDamageMod || tags.includes("Damage")) cats.push("damage");
    if (stats.FlatMagicDamageMod || tags.includes("SpellDamage")) cats.push("ap");
    if (
        stats.FlatArmorMod ||
        stats.FlatSpellBlockMod ||
        stats.FlatHPPoolMod ||
        tags.includes("Defense") ||
        tags.includes("Health") ||
        tags.includes("Armor") ||
        tags.includes("SpellBlock")
    )
        cats.push("defense");
    if (tags.includes("Boots")) cats.push("boots");
    return cats;
}

type Props = {
    itemDataMap: Record<string, any>;
    version: string;
};

export default function ItemDatabaseClient({ itemDataMap: initialItemDataMap, version }: Props) {
    const { t, language } = useTranslation();
    const backUrl = useBackUrl();
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [itemDataMap, setItemDataMap] = useState(initialItemDataMap);

    // Re-fetch item data when language changes
    useEffect(() => {
        let cancelled = false;
        fetchDDItemData(language).then((result) => {
            if (cancelled || !result) return;
            setItemDataMap(result.idMap);
        });
        return () => { cancelled = true; };
    }, [language]);

    // Filter to completed items, deduplicate by name (keep highest ID)
    const completedItems = useMemo(() => {
        const entries = Object.entries(itemDataMap);
        const nameMap = new Map<string, { id: string; item: any }>();

        for (const [id, item] of entries) {
            const gold = item.gold?.total || 0;
            const isBoots = (item.tags || []).includes("Boots");
            const isCompleted = isBoots ? gold >= 900 : gold >= 2300;
            if (!isCompleted) continue;
            if (!item.gold?.purchasable) continue;

            const existing = nameMap.get(item.name);
            if (!existing || Number(id) > Number(existing.id)) {
                nameMap.set(item.name, { id, item });
            }
        }

        return Array.from(nameMap.values())
            .sort((a, b) => (a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0));
    }, [itemDataMap]);

    const filtered = useMemo(() => {
        return completedItems.filter(({ item }) => {
            const nameMatch = item.name.toLowerCase().includes(search.toLowerCase());
            const catMatch =
                activeCategory === "all" ||
                categorizeItem(item).includes(activeCategory);
            return nameMatch && catMatch;
        });
    }, [completedItems, search, activeCategory]);

    const selectedDetail = selectedItem
        ? { id: selectedItem, item: itemDataMap[selectedItem] }
        : null;

    return (
        <div className="container mx-auto px-6 py-10">
            {/* Back Link */}
            <Link href={backUrl} className="inline-block text-sm text-slate-400 hover:text-white transition mb-6">
                {backUrl === "/dashboard" ? t('common.backToDashboard') : t('common.backToHome')}
            </Link>

            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-black mb-3">
                    <span className="text-cyan-400">{t('itemDb.title')}</span>
                </h1>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    {t('itemDb.subtitle')}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    {t('itemDb.itemCount').replace('{count}', String(completedItems.length))}
                </p>
            </div>

            {/* Search + Filters */}
            <div className="mb-8 space-y-4">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('itemDb.searchPlaceholder')}
                    className="w-full max-w-md mx-auto block px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                />
                <div className="flex flex-wrap justify-center gap-2">
                    {CATEGORIES.map(({ key }) => (
                        <button
                            key={key}
                            onClick={() => setActiveCategory(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                activeCategory === key
                                    ? "bg-cyan-500 text-black"
                                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            {t(`itemDb.categories.${key}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* AdSense Top */}
            <AdSenseBanner className="mb-8 h-[90px]" format="auto" />

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Grid */}
                <div className="flex-1">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            {t('itemDb.noResults')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {filtered.map(({ id, item }) => (
                                <button
                                    key={id}
                                    onClick={() => setSelectedItem(id)}
                                    className={`group bg-white/[0.03] border rounded-xl p-3 hover:bg-white/[0.06] transition-all text-left ${
                                        selectedItem === id
                                            ? "border-cyan-500/50"
                                            : "border-white/5 hover:border-white/10"
                                    }`}
                                >
                                    <div className="relative w-1/2 aspect-square mx-auto mb-2 overflow-hidden rounded-lg bg-black/30">
                                        <Image
                                            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`}
                                            alt={item.name}
                                            fill
                                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                                            className="object-contain p-1"
                                        />
                                    </div>
                                    <h3 className="font-medium text-white text-xs truncate">
                                        {item.name}
                                    </h3>
                                    <p className="text-[10px] text-amber-400">
                                        {item.gold?.total || 0}g
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedDetail && selectedDetail.item && (
                    <div className="lg:w-80 lg:sticky lg:top-24 lg:self-start bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <Image
                                src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${selectedDetail.id}.png`}
                                alt={selectedDetail.item.name}
                                width={56}
                                height={56}
                                className="rounded-lg"
                            />
                            <div>
                                <h3 className="font-bold text-white">
                                    {selectedDetail.item.name}
                                </h3>
                                <p className="text-sm text-amber-400">
                                    {t('itemDb.gold')}: {selectedDetail.item.gold?.total || 0}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        {selectedDetail.item.stats &&
                            Object.keys(selectedDetail.item.stats).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                        {t('itemDb.stats')}
                                    </h4>
                                    <div className="space-y-1">
                                        {Object.entries(selectedDetail.item.stats as Record<string, number>)
                                            .filter(([, v]) => v !== 0)
                                            .map(([key, value]) => (
                                                <div
                                                    key={key}
                                                    className="flex justify-between text-sm"
                                                >
                                                    <span className="text-gray-400">
                                                        {key.replace(/^Flat|Mod$|Pool/g, "").replace(/([A-Z])/g, " $1").trim()}
                                                    </span>
                                                    <span className="text-white font-medium">
                                                        +{key.includes("Percent") ? `${(value * 100).toFixed(0)}%` : value}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                        {/* Description */}
                        {selectedDetail.item.description && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                    {t('itemDb.details')}
                                </h4>
                                <div
                                    className="text-sm text-gray-400 leading-relaxed [&_br]:hidden [&_stats]:text-cyan-400 [&_attention]:text-amber-400 [&_active]:text-green-400 [&_passive]:text-purple-400 [&_unique]:text-yellow-400"
                                    dangerouslySetInnerHTML={{
                                        __html: selectedDetail.item.description,
                                    }}
                                />
                            </div>
                        )}

                        {/* Build Path */}
                        {selectedDetail.item.from &&
                            selectedDetail.item.from.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                        {t('itemDb.buildsFrom')}
                                    </h4>
                                    <div className="flex gap-2 flex-wrap">
                                        {(selectedDetail.item.from as string[]).map(
                                            (fromId: string) => {
                                                const fromItem = itemDataMap[fromId];
                                                if (!fromItem) return null;
                                                return (
                                                    <button
                                                        key={fromId}
                                                        onClick={() => setSelectedItem(fromId)}
                                                        className="flex items-center gap-2 bg-white/5 rounded-lg p-2 hover:bg-white/10 transition"
                                                    >
                                                        <Image
                                                            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${fromId}.png`}
                                                            alt={fromItem.name}
                                                            width={28}
                                                            height={28}
                                                            className="rounded"
                                                        />
                                                        <span className="text-xs text-gray-300">
                                                            {fromItem.name}
                                                        </span>
                                                    </button>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            )}

                        <button
                            onClick={() => setSelectedItem(null)}
                            className="w-full text-sm text-gray-500 hover:text-white transition py-2"
                        >
                            {t('itemDb.close')}
                        </button>
                    </div>
                )}
            </div>

            {/* AdSense Bottom */}
            <AdSenseBanner className="mt-8 h-[90px]" format="auto" />
        </div>
    );
}
