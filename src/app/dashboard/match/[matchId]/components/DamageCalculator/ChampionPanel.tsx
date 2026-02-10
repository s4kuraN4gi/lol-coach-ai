"use client";

import type { CalculatorSide, ComputedStats, ParsedAbility } from "./types";
import LevelSelector from "./LevelSelector";
import SkillRankSelector from "./SkillRankSelector";
import ItemSlots from "./ItemSlots";
import KeystoneSelector from "./KeystoneSelector";

type Props = {
  side: CalculatorSide;
  stats: ComputedStats;
  abilities: ParsedAbility[];
  passive?: ParsedAbility | null;
  version: string;
  label: string;
  borderColor: string;
  itemDataMap: Record<string, any> | null;
  onLevelChange: (level: number) => void;
  onSpellRanksChange: (ranks: number[]) => void;
  onItemClick: (slotIndex: number) => void;
  onItemRemove: (slotIndex: number) => void;
  onItemSwap: (fromIndex: number, toIndex: number) => void;
  onExternalItemDrop?: (slotIndex: number, itemId: string) => void;
  onKeystoneChange: (id: string | null) => void;
  onChampionClick: () => void;
};

const getChampionImageUrl = (championName: string, version: string) => {
  const nameMap: Record<string, string> = { "FiddleSticks": "Fiddlesticks" };
  const cName = nameMap[championName] || championName;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${cName}.png`;
};

export default function ChampionPanel({
  side,
  stats,
  abilities,
  passive,
  version,
  label,
  borderColor,
  itemDataMap,
  onLevelChange,
  onSpellRanksChange,
  onItemClick,
  onItemRemove,
  onItemSwap,
  onExternalItemDrop,
  onKeystoneChange,
  onChampionClick,
}: Props) {
  return (
    <div className={`rounded-xl border ${borderColor} bg-slate-900/50 p-3 space-y-3`}>
      {/* Champion Icon + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onChampionClick}
          className="relative group cursor-pointer"
          title="Click to change champion"
        >
          <img
            src={getChampionImageUrl(side.champion, version)}
            alt={side.champion}
            className="w-12 h-12 rounded-lg border border-slate-600 bg-slate-800 object-cover group-hover:border-blue-400 transition-colors"
            onError={(e) => {
              e.currentTarget.src = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";
            }}
          />
          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              &#x21C4;
            </span>
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-sm font-bold text-white truncate">{side.champion}</div>
        </div>
      </div>

      {/* Level Selector */}
      <LevelSelector level={side.level} onChange={onLevelChange} />

      {/* Skill Rank Selector */}
      {abilities.length > 0 && (
        <SkillRankSelector
          abilities={abilities}
          spellRanks={side.spellRanks}
          onChange={onSpellRanksChange}
          passive={passive}
        />
      )}

      {/* Item Slots */}
      <ItemSlots
        items={side.items}
        version={version}
        itemDataMap={itemDataMap}
        onItemClick={onItemClick}
        onItemRemove={onItemRemove}
        onItemSwap={onItemSwap}
        onExternalItemDrop={onExternalItemDrop}
      />

      {/* Keystone */}
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Keystone</div>
        <KeystoneSelector
          selectedId={side.keystone}
          onChange={onKeystoneChange}
        />
      </div>
    </div>
  );
}
