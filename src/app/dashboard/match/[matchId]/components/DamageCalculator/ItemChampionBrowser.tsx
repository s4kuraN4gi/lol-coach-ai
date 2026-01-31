"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  itemDataMap: Record<string, any> | null;
  championList: { id: string; name: string; tags: string[] }[];
  version: string;
  activeSide: "left" | "right";
  onActiveSideChange: (side: "left" | "right") => void;
  onChampionSelect: (championName: string) => void;
};

const CHAMPION_ROLES = [
  { key: "all", ja: "全て", en: "All", ko: "전체" },
  { key: "Fighter", ja: "ファイター", en: "Fighter", ko: "전사" },
  { key: "Tank", ja: "タンク", en: "Tank", ko: "탱커" },
  { key: "Mage", ja: "メイジ", en: "Mage", ko: "마법사" },
  { key: "Assassin", ja: "アサシン", en: "Assassin", ko: "암살자" },
  { key: "Marksman", ja: "マークスマン", en: "ADC", ko: "원딜" },
  { key: "Support", ja: "サポート", en: "Support", ko: "서포터" },
];

const CATEGORIES = [
  { key: "all", ja: "全て", en: "All", ko: "전체" },
  { key: "damage", ja: "AD", en: "AD", ko: "AD" },
  { key: "ap", ja: "AP", en: "AP", ko: "AP" },
  { key: "defense", ja: "防御", en: "DEF", ko: "방어" },
  { key: "boots", ja: "靴", en: "Boots", ko: "신발" },
];

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

export default function ItemChampionBrowser({
  itemDataMap,
  championList,
  version,
  activeSide,
  onActiveSideChange,
  onChampionSelect,
}: Props) {
  const { language } = useTranslation();
  const [tab, setTab] = useState<"items" | "champions">("items");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [championRole, setChampionRole] = useState("all");

  const completedItems = useMemo(() => {
    if (!itemDataMap) return [];
    const items = Object.entries(itemDataMap)
      .filter(([, item]: [string, any]) => {
        if (!item.gold?.purchasable) return false;
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
      const matchesSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        category === "all" || item.categories.includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [completedItems, search, category]);

  const filteredChampions = useMemo(() => {
    return championList.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        championRole === "all" || (c.tags || []).includes(championRole);
      return matchesSearch && matchesRole;
    });
  }, [championList, search, championRole]);

  const handleTabChange = (newTab: "items" | "champions") => {
    setTab(newTab);
    setSearch("");
    if (newTab === "items") setCategory("all");
    if (newTab === "champions") setChampionRole("all");
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col max-h-[700px]">
      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => handleTabChange("items")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            tab === "items"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {language === "ja"
            ? "アイテム"
            : language === "ko"
              ? "아이템"
              : "Items"}
        </button>
        <button
          onClick={() => handleTabChange("champions")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            tab === "champions"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {language === "ja"
            ? "チャンピオン"
            : language === "ko"
              ? "챔피언"
              : "Champions"}
        </button>
      </div>

      {/* Search */}
      <div className="p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "items"
              ? language === "ja"
                ? "アイテム検索..."
                : language === "ko"
                  ? "아이템 검색..."
                  : "Search items..."
              : language === "ja"
                ? "チャンピオン検索..."
                : language === "ko"
                  ? "챔피언 검색..."
                  : "Search champions..."
          }
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Category filter (items only) */}
      {tab === "items" && (
        <div className="px-2 pb-1.5 flex gap-0.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                category === cat.key
                  ? "bg-blue-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {cat[language as "ja" | "en" | "ko"] || cat.en}
            </button>
          ))}
        </div>
      )}

      {/* Side selector + Role filter (champions only) */}
      {tab === "champions" && (
        <>
          <div className="px-2 pb-1.5 flex gap-1">
            <button
              onClick={() => onActiveSideChange("left")}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                activeSide === "left"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
              }`}
            >
              {language === "ja"
                ? "自チャンプ"
                : language === "ko"
                  ? "내 챔피언"
                  : "Your Champ"}
            </button>
            <button
              onClick={() => onActiveSideChange("right")}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                activeSide === "right"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
              }`}
            >
              {language === "ja"
                ? "敵チャンプ"
                : language === "ko"
                  ? "적 챔피언"
                  : "Enemy Champ"}
            </button>
          </div>
          <div className="px-2 pb-1.5 flex gap-0.5 flex-wrap">
            {CHAMPION_ROLES.map((role) => (
              <button
                key={role.key}
                onClick={() => setChampionRole(role.key)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  championRole === role.key
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {role[language as "ja" | "en" | "ko"] || role.en}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {tab === "items" ? (
          <div className="grid grid-cols-6 gap-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("item-id", item.id);
                }}
                className="relative group cursor-grab active:cursor-grabbing"
                title={`${item.name} (${item.gold}g)`}
              >
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.id}.png`}
                  alt={item.name}
                  className="w-full aspect-square rounded border border-slate-700 bg-slate-800 hover:border-blue-400 transition-colors object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.3";
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {filteredChampions.map((champ) => (
              <button
                key={champ.id}
                onClick={() => onChampionSelect(champ.id)}
                className="relative group"
                title={champ.name}
              >
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${
                    champ.id === "FiddleSticks" ? "Fiddlesticks" : champ.id
                  }.png`}
                  alt={champ.name}
                  className="w-full aspect-square rounded border border-slate-700 bg-slate-800 hover:border-blue-400 transition-colors object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.3";
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {tab === "items" && filteredItems.length === 0 && (
          <div className="text-center text-slate-500 text-[10px] py-4">
            {language === "ja"
              ? "アイテムが見つかりません"
              : language === "ko"
                ? "아이템을 찾을 수 없습니다"
                : "No items found"}
          </div>
        )}
        {tab === "champions" && filteredChampions.length === 0 && (
          <div className="text-center text-slate-500 text-[10px] py-4">
            {language === "ja"
              ? "チャンピオンが見つかりません"
              : language === "ko"
                ? "챔피언을 찾을 수 없습니다"
                : "No champions found"}
          </div>
        )}
      </div>

      {/* Drag hint */}
      {tab === "items" && (
        <div className="px-2 py-1.5 border-t border-slate-800 text-center">
          <span className="text-[9px] text-slate-600">
            {language === "ja"
              ? "D&Dでアイテムスロットに挿入"
              : language === "ko"
                ? "드래그 & 드롭으로 슬롯에 삽입"
                : "Drag & drop to item slots"}
          </span>
        </div>
      )}
    </div>
  );
}
