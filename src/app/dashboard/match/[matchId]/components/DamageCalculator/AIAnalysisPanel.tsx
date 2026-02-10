"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";
import { analyzeDamageMatchup } from "@/app/actions/damageAnalysis";
import type { DamageAnalysisInput, DamageAnalysisResult } from "@/app/actions/damageAnalysis";
import type { ComputedStats, ParsedAbility } from "./types";

type Props = {
  isExtra: boolean;
  attackerChampion: string;
  attackerLevel: number;
  attackerStats: ComputedStats;
  attackerBaseAD: number;
  attackerAbilities: ParsedAbility[];
  attackerSpellRanks: number[];
  attackerItems: (string | null)[];
  attackerKeystone: string | null;
  defenderChampion: string;
  defenderLevel: number;
  defenderStats: ComputedStats;
  defenderItems: (string | null)[];
  defenderKeystone: string | null;
  itemDataMap: Record<string, any> | null;
};

export default function AIAnalysisPanel({
  isExtra,
  attackerChampion,
  attackerLevel,
  attackerStats,
  attackerBaseAD,
  attackerAbilities,
  attackerSpellRanks,
  attackerItems,
  attackerKeystone,
  defenderChampion,
  defenderLevel,
  defenderStats,
  defenderItems,
  defenderKeystone,
  itemDataMap,
}: Props) {
  const { t, language } = useTranslation();
  const [result, setResult] = useState<DamageAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getItemNames(items: (string | null)[]): string[] {
    if (!itemDataMap) return items.filter(Boolean) as string[];
    return items
      .filter(Boolean)
      .map(id => itemDataMap[id!]?.name || id!)
      .filter(Boolean);
  }

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);

    const input: DamageAnalysisInput = {
      attacker: {
        champion: attackerChampion,
        level: attackerLevel,
        stats: {
          hp: attackerStats.hp,
          attackDamage: attackerStats.attackDamage,
          abilityPower: attackerStats.abilityPower,
          armor: attackerStats.armor,
          magicResist: attackerStats.magicResist,
          attackSpeed: attackerStats.attackSpeed,
          critChance: attackerStats.critChance,
          lethality: attackerStats.lethality,
          armorPenPercent: attackerStats.armorPenPercent,
          magicPenFlat: attackerStats.magicPenFlat,
          magicPenPercent: attackerStats.magicPenPercent,
          abilityHaste: attackerStats.abilityHaste,
        },
        baseAD: attackerBaseAD,
        abilities: attackerAbilities.map((a, idx) => ({
          key: a.key,
          name: a.name,
          baseDamage: a.baseDamage,
          scalings: a.scalings.map(s => ({ stat: s.stat, ratio: s.ratio })),
          damageType: a.damageType,
          cooldown: a.cooldown,
          rank: attackerSpellRanks[idx] || 0,
        })),
        items: getItemNames(attackerItems),
        keystone: attackerKeystone,
      },
      defender: {
        champion: defenderChampion,
        level: defenderLevel,
        stats: {
          hp: defenderStats.hp,
          attackDamage: defenderStats.attackDamage,
          abilityPower: defenderStats.abilityPower,
          armor: defenderStats.armor,
          magicResist: defenderStats.magicResist,
          attackSpeed: defenderStats.attackSpeed,
          lethality: defenderStats.lethality,
          armorPenPercent: defenderStats.armorPenPercent,
          magicPenFlat: defenderStats.magicPenFlat,
          magicPenPercent: defenderStats.magicPenPercent,
        },
        items: getItemNames(defenderItems),
        keystone: defenderKeystone,
      },
      locale: language,
    };

    try {
      const res = await analyzeDamageMatchup(input);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || t('damageCalculator.aiAnalysis.error'));
      }
    } catch (e: any) {
      setError(e.message || t('damageCalculator.aiAnalysis.error'));
    } finally {
      setIsLoading(false);
    }
  }

  // Non-Extra users: show upgrade prompt (same pattern as PremiumFeatureGate)
  if (!isExtra) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        <div className="filter blur-[2px] pointer-events-none select-none opacity-40 grayscale">
          <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
            <div className="h-8 bg-slate-700/50 rounded w-48" />
            <div className="h-32 bg-slate-700/30 rounded" />
            <div className="h-24 bg-slate-700/30 rounded" />
          </div>
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-slate-400 font-medium">
              {t('premium.featureGate.extraOnly', 'Extraプラン限定機能')}
            </p>
            <Link
              href="/pricing"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              {t('premium.featureGate.viewPlans', '料金プランを見る')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analyze Button */}
      <div className="flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('damageCalculator.aiAnalysis.analyzing', 'AI分析中...')}
            </>
          ) : (
            <>
              <span>&#x2728;</span>
              {t('damageCalculator.aiAnalysis.analyzeButton', 'AIでコンボ分析')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Optimal Combo */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-violet-500/20">
            <h4 className="text-sm font-bold text-violet-400 mb-2">
              {t('damageCalculator.aiAnalysis.optimalCombo', '最適コンボ')}
            </h4>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.optimalCombo.sequence.map((action, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-slate-700 rounded text-xs font-mono text-slate-200 border border-slate-600"
                >
                  {action}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400">{result.optimalCombo.reasoning}</p>
          </div>

          {/* Combo Breakdown */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-bold text-slate-300 mb-3">
              {t('damageCalculator.aiAnalysis.comboBreakdown', 'コンボ詳細')}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500">
                    <th className="text-left py-1.5 px-2">#</th>
                    <th className="text-left py-1.5 px-2">{t('damageCalculator.aiAnalysis.action', 'アクション')}</th>
                    <th className="text-right py-1.5 px-2">{t('damageCalculator.aiAnalysis.damage', 'ダメージ')}</th>
                    <th className="text-center py-1.5 px-2">{t('damageCalculator.aiAnalysis.type', 'タイプ')}</th>
                    <th className="text-right py-1.5 px-2">{t('damageCalculator.aiAnalysis.cumulative', '累計')}</th>
                    <th className="text-left py-1.5 px-2">{t('damageCalculator.aiAnalysis.notes', '備考')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comboBreakdown.map((step) => (
                    <tr key={step.step} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                      <td className="py-1.5 px-2 text-slate-500">{step.step}</td>
                      <td className="py-1.5 px-2 text-slate-200 font-mono">{step.action}</td>
                      <td className={`py-1.5 px-2 text-right font-bold ${
                        step.type === 'physical' ? 'text-orange-400' :
                        step.type === 'magic' ? 'text-blue-400' : 'text-slate-200'
                      }`}>
                        {step.damage}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          step.type === 'physical' ? 'bg-orange-500/20 text-orange-400' :
                          step.type === 'magic' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-300'
                        }`}>
                          {step.type === 'physical' ? 'AD' : step.type === 'magic' ? 'AP' : 'TRUE'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-300 font-bold">{step.cumulative}</td>
                      <td className="py-1.5 px-2 text-slate-500 max-w-[200px] truncate">{step.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Damage */}
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {t('damageCalculator.aiAnalysis.totalDamage', '総合ダメージ')}
              </div>
              <div className="text-xl font-black text-white">{result.totalComboDamage}</div>
            </div>

            {/* Kill Potential */}
            <div className={`rounded-lg p-3 text-center border ${
              result.killPotential.canKill
                ? 'bg-emerald-900/20 border-emerald-500/30'
                : 'bg-red-900/20 border-red-500/30'
            }`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {t('damageCalculator.aiAnalysis.killPotential', 'キルポテンシャル')}
              </div>
              <div className={`text-sm font-bold ${result.killPotential.canKill ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.killPotential.canKill
                  ? t('damageCalculator.aiAnalysis.canKill', 'キル可能')
                  : t('damageCalculator.aiAnalysis.cannotKill', 'キル不可')}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {result.killPotential.canKill
                  ? `+${result.killPotential.overkill} overkill`
                  : `${t('damageCalculator.aiAnalysis.hpRemaining', '残りHP')}: ${Math.abs(result.killPotential.hpRemaining)}`}
              </div>
            </div>

            {/* DPS */}
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {t('damageCalculator.aiAnalysis.dps', 'DPS')}
              </div>
              <div className="text-xl font-black text-white">{result.extendedTrade.dps}</div>
              <div className="text-xs text-slate-500">
                {result.extendedTrade.timeToKill > 0 ? `${result.extendedTrade.timeToKill}s` : '-'}
              </div>
            </div>

            {/* HP % */}
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                HP %
              </div>
              <div className="text-xl font-black text-white">
                {defenderStats.hp > 0 ? Math.min(100, Math.round((result.totalComboDamage / defenderStats.hp) * 100)) : 0}%
              </div>
            </div>
          </div>

          {/* Strategic Advice */}
          {result.strategicAdvice && (
            <div className="bg-violet-900/10 border border-violet-500/20 rounded-lg p-4">
              <h4 className="text-sm font-bold text-violet-400 mb-2">
                {t('damageCalculator.aiAnalysis.strategicAdvice', '戦略アドバイス')}
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">{result.strategicAdvice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
