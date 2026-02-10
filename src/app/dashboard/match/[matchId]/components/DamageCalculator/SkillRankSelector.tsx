"use client";

import { useState } from "react";
import type { ParsedAbility } from "./types";

type Props = {
  abilities: ParsedAbility[];
  spellRanks: number[];
  onChange: (ranks: number[]) => void;
  passive?: ParsedAbility | null;
};

const SKILL_COLORS: Record<string, string> = {
  Q: "bg-blue-500",
  W: "bg-green-500",
  E: "bg-yellow-500",
  R: "bg-red-500",
};

const SKILL_BORDER_COLORS: Record<string, string> = {
  Q: "border-blue-500/50",
  W: "border-green-500/50",
  E: "border-yellow-500/50",
  R: "border-red-500/50",
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  physical: "Physical",
  magic: "Magic",
  true: "True",
  unknown: "—",
};

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: "text-orange-400",
  magic: "text-purple-400",
  true: "text-white",
  unknown: "text-slate-500",
};

const SCALING_STAT_LABELS: Record<string, string> = {
  ap: "AP",
  ad: "AD",
  bonusAd: "Bonus AD",
  baseAd: "Base AD",
  bonusHp: "Bonus HP",
  maxHp: "Max HP",
  armor: "Armor",
  mr: "MR",
};

function SpellTooltip({ ability, currentRank }: { ability: ParsedAbility; currentRank: number }) {
  const dmgTypeColor = DAMAGE_TYPE_COLORS[ability.damageType] || "text-slate-400";
  const dmgTypeLabel = DAMAGE_TYPE_LABELS[ability.damageType] || "—";

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-64">
      <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-2.5 text-left max-h-72 overflow-y-auto">
        {/* Header: icon + name + key */}
        <div className="flex items-center gap-2 mb-1.5">
          {ability.iconUrl && (
            <img
              src={ability.iconUrl}
              alt={ability.name}
              className="w-7 h-7 rounded border border-slate-700 bg-slate-800"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{ability.name}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">{ability.key}</span>
              <span className={`text-[10px] ${dmgTypeColor}`}>{dmgTypeLabel}</span>
            </div>
          </div>
        </div>

        {/* Base damage per rank */}
        {ability.baseDamage.length > 0 && ability.isDataComplete && (
          <div className="mb-1.5">
            <div className="text-[10px] text-slate-500 mb-0.5">Base Damage</div>
            <div className="flex gap-1">
              {ability.baseDamage.map((dmg, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                    i + 1 === currentRank
                      ? "bg-blue-500/20 text-blue-300 font-bold"
                      : i + 1 < currentRank
                        ? "text-slate-400"
                        : "text-slate-600"
                  }`}
                >
                  {dmg}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scaling ratios */}
        {ability.scalings.length > 0 && (
          <div className="mb-1.5">
            <div className="text-[10px] text-slate-500 mb-0.5">Scaling</div>
            <div className="flex flex-wrap gap-1.5">
              {ability.scalings.map((s, i) => (
                <span key={i} className="text-[10px] text-green-400">
                  +{Math.round(s.ratio * 100)}% {SCALING_STAT_LABELS[s.stat] || s.stat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cooldown */}
        {ability.cooldown.length > 0 && ability.cooldown.some(cd => cd > 0) && (
          <div className="border-t border-slate-700 pt-1.5 mt-1">
            <div className="text-[10px] text-slate-500 mb-0.5">Cooldown</div>
            <div className="flex gap-1">
              {ability.cooldown.map((cd, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-mono ${
                    i + 1 === currentRank ? "text-sky-300 font-bold" : "text-slate-500"
                  }`}
                >
                  {cd}s
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Spell description */}
        {ability.description && (
          <div className="border-t border-slate-700 pt-1.5 mt-1">
            <div className="text-[10px] text-slate-400 leading-tight">
              {ability.description}
            </div>
          </div>
        )}

        {/* Data incomplete warning */}
        {!ability.isDataComplete && (
          <div className="text-[10px] text-amber-500/80 mt-1 italic">
            Data may be incomplete for this ability
          </div>
        )}
      </div>
    </div>
  );
}

export default function SkillRankSelector({ abilities, spellRanks, onChange, passive }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPassive, setHoverPassive] = useState(false);

  const handleRankChange = (index: number, newRank: number) => {
    const newRanks = [...spellRanks];
    newRanks[index] = newRank;
    onChange(newRanks);
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {/* Passive row */}
      {passive && (
        <div
          className="relative flex items-center gap-1 col-span-2"
          onMouseEnter={() => setHoverPassive(true)}
          onMouseLeave={() => setHoverPassive(false)}
        >
          <div className="flex items-center gap-0.5 w-8 flex-shrink-0">
            {passive.iconUrl && (
              <img
                src={passive.iconUrl}
                alt="P"
                className="w-4 h-4 rounded border border-slate-700 bg-slate-800"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
            <span className="text-[10px] font-bold text-violet-300">P</span>
          </div>
          <span className="text-[10px] text-slate-400 truncate">{passive.name}</span>

          {/* Tooltip */}
          {hoverPassive && (
            <SpellTooltip ability={passive} currentRank={1} />
          )}
        </div>
      )}

      {/* Q/W/E/R rows */}
      {abilities.map((ability, idx) => {
        const maxRank = ability.maxRank || 5;
        const currentRank = spellRanks[idx] || 0;

        return (
          <div
            key={ability.key}
            className="relative flex items-center gap-1"
            onMouseEnter={() => setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Skill icon + key label */}
            <div className="flex items-center gap-0.5 w-8 flex-shrink-0">
              {ability.iconUrl && (
                <img
                  src={ability.iconUrl}
                  alt={ability.key}
                  className="w-4 h-4 rounded border border-slate-700 bg-slate-800"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}
              <span className="text-[10px] font-bold text-slate-300">
                {ability.key}
              </span>
            </div>

            {/* Rank dots */}
            <div className="flex gap-0.5">
              {Array.from({ length: maxRank }, (_, rankIdx) => {
                const rank = rankIdx + 1;
                const isActive = rank <= currentRank;
                return (
                  <button
                    key={rankIdx}
                    onClick={() => handleRankChange(idx, rank === currentRank ? rank - 1 : rank)}
                    className={`w-3 h-3 rounded-full border transition-all ${
                      isActive
                        ? `${SKILL_COLORS[ability.key] || "bg-blue-500"} border-transparent`
                        : "bg-slate-800 border-slate-600 hover:border-slate-400"
                    }`}
                  />
                );
              })}
            </div>

            {/* Tooltip */}
            {hoverIndex === idx && (
              <SpellTooltip ability={ability} currentRank={currentRank} />
            )}
          </div>
        );
      })}
    </div>
  );
}
