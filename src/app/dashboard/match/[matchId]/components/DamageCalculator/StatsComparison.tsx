"use client";

import type { ComputedStats } from "./types";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  leftStats: ComputedStats;
  rightStats: ComputedStats;
};

type StatRow = {
  key: keyof ComputedStats;
  label: { ja: string; en: string; ko: string };
  color: string;
  format?: (v: number) => string;
};

const STAT_ROWS: StatRow[] = [
  { key: "hp", label: { ja: "HP", en: "HP", ko: "체력" }, color: "text-green-400" },
  { key: "attackDamage", label: { ja: "AD", en: "AD", ko: "AD" }, color: "text-orange-400" },
  { key: "abilityPower", label: { ja: "AP", en: "AP", ko: "AP" }, color: "text-purple-400" },
  { key: "armor", label: { ja: "物防", en: "AR", ko: "방어력" }, color: "text-yellow-400" },
  { key: "magicResist", label: { ja: "魔防", en: "MR", ko: "마저" }, color: "text-cyan-400" },
  { key: "attackSpeed", label: { ja: "AS", en: "AS", ko: "AS" }, color: "text-amber-300", format: (v) => v.toFixed(2) },
  { key: "lethality", label: { ja: "脅威", en: "Leth", ko: "치명" }, color: "text-red-300" },
  { key: "abilityHaste", label: { ja: "AH", en: "AH", ko: "AH" }, color: "text-blue-300" },
];

export default function StatsComparison({ leftStats, rightStats }: Props) {
  const { language } = useTranslation();

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-0.5 text-xs font-mono">
      {STAT_ROWS.map((row) => {
        const leftVal = leftStats[row.key];
        const rightVal = rightStats[row.key];
        const formatter = row.format || ((v: number) => Math.round(v).toString());
        const leftHigher = leftVal > rightVal;
        const rightHigher = rightVal > leftVal;

        return (
          <div key={row.key} className="contents">
            {/* Left value */}
            <div className={`text-right ${leftHigher ? "text-white font-bold" : "text-slate-400"}`}>
              {formatter(leftVal)}
            </div>

            {/* Label */}
            <div className={`text-center ${row.color} text-[10px] w-8`}>
              {row.label[language] || row.label.en}
            </div>

            {/* Right value */}
            <div className={`text-left ${rightHigher ? "text-white font-bold" : "text-slate-400"}`}>
              {formatter(rightVal)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
