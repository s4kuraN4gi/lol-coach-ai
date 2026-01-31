"use client";

import type { DamageCalculationResult } from "./types";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  result: DamageCalculationResult;
  attackerName: string;
  targetName: string;
  targetHP: number;
};

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: "text-orange-400",
  magic: "text-purple-400",
  true: "text-white",
};

const DAMAGE_TYPE_LABELS: Record<string, Record<string, string>> = {
  physical: { ja: "物理", en: "Physical", ko: "물리" },
  magic: { ja: "魔法", en: "Magic", ko: "마법" },
  true: { ja: "確定", en: "True", ko: "고정" },
};

export default function DamageResultsPanel({ result, attackerName, targetName, targetHP }: Props) {
  const { language } = useTranslation();

  const allDamage = [
    result.autoAttack,
    ...result.abilities,
    ...result.itemPassives,
    ...(result.keystoneDamage ? [result.keystoneDamage] : []),
  ];

  const hpPercent = Math.min(100, result.targetHpPercent);

  return (
    <div className="space-y-2">
      {/* Direction label */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-blue-400">{attackerName}</span>
        <span className="text-slate-500">→</span>
        <span className="font-bold text-red-400">{targetName}</span>
      </div>

      {/* Individual damage rows */}
      <div className="space-y-1">
        {allDamage.map((dmg, idx) => {
          if (dmg.mitigatedDamage === 0 && dmg.rawDamage === 0) return null;
          const typeColor = DAMAGE_TYPE_COLORS[dmg.damageType] || "text-white";
          const typeLabel = DAMAGE_TYPE_LABELS[dmg.damageType]?.[language] || dmg.damageType;

          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-300 truncate">{dmg.label}</span>
                <span className="text-slate-600 text-[10px] truncate hidden sm:inline">{dmg.breakdown}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`font-bold font-mono ${typeColor}`}>
                  {dmg.mitigatedDamage}
                </span>
                <span className={`text-[10px] ${typeColor} opacity-60`}>
                  {typeLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Combo */}
      <div className="border-t border-slate-700 pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">
            {language === "ja" ? "単純合算ダメージ" : language === "ko" ? "단순 합산 피해" : "Simple Total Damage"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-mono">{result.totalCombo}</span>
            <span className="text-xs text-slate-400">
              ({result.targetHpPercent.toFixed(1)}% HP)
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-500 leading-tight">
          {language === "ja"
            ? "※ AA1回+各スキル1回の単純合算です。AAキャンセル・コンボ順序・クールダウンは考慮していません。"
            : language === "ko"
            ? "※ AA 1회 + 각 스킬 1회의 단순 합산입니다. AA 캔슬, 콤보 순서, 쿨다운은 고려하지 않습니다."
            : "※ Simple sum of 1 AA + each ability once. Does not account for AA cancels, combo order, or cooldowns."}
        </p>

        {/* HP Bar visualization */}
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
              hpPercent >= 100 ? "bg-red-500" : hpPercent >= 50 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${hpPercent}%` }}
          />
          {hpPercent >= 100 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white drop-shadow">KILL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
