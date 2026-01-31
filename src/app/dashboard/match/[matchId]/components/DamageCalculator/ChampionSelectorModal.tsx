"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (championName: string) => void;
  championList: { id: string; name: string }[];
  version: string;
};

export default function ChampionSelectorModal({ isOpen, onClose, onSelect, championList, version }: Props) {
  const { language } = useTranslation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search) return championList;
    const q = search.toLowerCase();
    return championList.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [championList, search]);

  if (!isOpen) return null;

  // Fix known DDragon naming inconsistencies
  const getChampIconUrl = (id: string) => {
    const nameMap: Record<string, string> = { "FiddleSticks": "Fiddlesticks" };
    const name = nameMap[id] || id;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${name}.png`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-[520px] max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">
            {language === "ja" ? "チャンピオン選択" : language === "ko" ? "챔피언 선택" : "Select Champion"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "ja" ? "チャンピオン名で検索..." : language === "ko" ? "챔피언 이름 검색..." : "Search champions..."}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Champion Grid */}
        <div className="p-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-8 gap-1.5">
            {filtered.map((champ) => (
              <button
                key={champ.id}
                onClick={() => {
                  onSelect(champ.id);
                  onClose();
                }}
                className="relative group"
                title={champ.name}
              >
                <img
                  src={getChampIconUrl(champ.id)}
                  alt={champ.name}
                  className="w-12 h-12 rounded-lg border border-slate-700 bg-slate-800 hover:border-blue-400 hover:scale-105 transition-all cursor-pointer object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";
                  }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-xl">
                  {champ.name}
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              {language === "ja" ? "チャンピオンが見つかりません" : language === "ko" ? "챔피언을 찾을 수 없습니다" : "No champions found"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
