"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (itemId: string) => void;
  itemDataMap: Record<string, any> | null;
  version: string;
};

// Common item categories for filtering
const CATEGORIES = [
  { key: "all", ja: "全て", en: "All", ko: "전체" },
  { key: "damage", ja: "攻撃", en: "Damage", ko: "공격" },
  { key: "ap", ja: "魔力", en: "AP", ko: "주문력" },
  { key: "defense", ja: "防御", en: "Defense", ko: "방어" },
  { key: "boots", ja: "靴", en: "Boots", ko: "신발" },
];

function categorizeItem(item: any): string[] {
  const cats: string[] = [];
  const stats = item.stats || {};
  const tags = item.tags || [];

  if (stats.FlatPhysicalDamageMod || tags.includes("Damage")) cats.push("damage");
  if (stats.FlatMagicDamageMod || tags.includes("SpellDamage")) cats.push("ap");
  if (stats.FlatArmorMod || stats.FlatSpellBlockMod || stats.FlatHPPoolMod || tags.includes("Defense") || tags.includes("Health") || tags.includes("Armor") || tags.includes("SpellBlock")) cats.push("defense");
  if (tags.includes("Boots")) cats.push("boots");

  return cats;
}

export default function ItemSelectorModal({ isOpen, onClose, onSelect, itemDataMap, version }: Props) {
  const { language } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setCategory("all");
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Filter to completed items only (gold >= 2000 or is boots)
  const completedItems = useMemo(() => {
    if (!itemDataMap) return [];

    const items = Object.entries(itemDataMap)
      .filter(([, item]: [string, any]) => {
        // Must be purchasable
        if (!item.gold?.purchasable) return false;
        // Filter out consumables and components
        const isBoot = item.tags?.includes("Boots");
        if (isBoot && item.gold.total >= 900) return true;
        return item.gold.total >= 2300 && !item.into?.length;
      })
      .map(([id, item]: [string, any]) => ({
        id,
        name: item.name as string,
        categories: categorizeItem(item),
        gold: item.gold?.total || 0,
      }));
    // Deduplicate: same name → keep highest ID (latest version)
    const deduped = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const existing = deduped.get(item.name);
      if (!existing || Number(item.id) > Number(existing.id)) {
        deduped.set(item.name, item);
      }
    }
    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [itemDataMap]);

  const filteredItems = useMemo(() => {
    return completedItems.filter((item) => {
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || item.categories.includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [completedItems, search, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-[480px] max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">
            {language === "ja" ? "アイテム選択" : language === "ko" ? "아이템 선택" : "Select Item"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Search + Filter */}
        <div className="p-3 space-y-2 border-b border-slate-800">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "ja" ? "アイテム名で検索..." : language === "ko" ? "아이템 이름 검색..." : "Search items..."}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  category === cat.key
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {cat[language] || cat.en}
              </button>
            ))}
          </div>
        </div>

        {/* Item Grid */}
        <div className="p-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-8 gap-1.5">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className="relative group"
                title={`${item.name} (${item.gold}g)`}
              >
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.id}.png`}
                  alt={item.name}
                  className="w-11 h-11 rounded border border-slate-700 bg-slate-800 hover:border-blue-400 transition-colors cursor-pointer"
                  onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-xl">
                  {item.name}
                  <span className="text-yellow-400 ml-1">{item.gold}g</span>
                </div>
              </button>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              {language === "ja" ? "アイテムが見つかりません" : language === "ko" ? "아이템을 찾을 수 없습니다" : "No items found"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
