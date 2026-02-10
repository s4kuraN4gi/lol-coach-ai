"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useChampionDetail } from "@/hooks/useChampionDetail";
import useSWR from "swr";

import type {
  CalculatorState,
  CalculatorSide,
  ComputedStats,
  ParsedAbility,
  DamageCalculationResult,
} from "./types";

import { computeStats, getBaseAD, getBonusAD } from "@/utils/damageCalc/statCalculator";
import { calculateAutoAttack, calculateAbilityDamage, calculateMitigatedDamage } from "@/utils/damageCalc/damageFormulas";
import { parseAllSpells, parsePassive } from "@/utils/damageCalc/spellParser";
import { itemSupplementaryData, evaluatePassiveDamage } from "@/data/damageCalc/itemSupplementary";
import { keystoneData, getKeystoneDamageAtLevel, findKeystoneByRiotId } from "@/data/damageCalc/keystones";

import ChampionPanel from "./ChampionPanel";
import StatsComparison from "./StatsComparison";
import DamageResultsPanel from "./DamageResultsPanel";
import AIAnalysisPanel from "./AIAnalysisPanel";
import ChampionSelectorModal from "./ChampionSelectorModal";
import ItemSelectorModal from "./ItemSelectorModal";
import ItemChampionBrowser from "./ItemChampionBrowser";

type Props = {
  matchData: any;
  puuid: string;
  ddVersion: string;
  isExtra: boolean;
};

// Fetch champion list from DDragon
async function fetchChampionList(key: string): Promise<{ id: string; name: string; tags: string[] }[]> {
  const [, language] = key.split(":");
  const localeMap: Record<string, string> = { ja: "ja_JP", en: "en_US", ko: "ko_KR" };
  const locale = localeMap[language] || "ja_JP";
  const { fetchLatestVersion } = await import("@/app/actions/riot");
  const version = await fetchLatestVersion();
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion.json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Object.values(data.data as Record<string, any>)
    .map((c: any) => ({ id: c.id as string, name: c.name as string, tags: (c.tags || []) as string[] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Fetch item data
async function fetchItemData(key: string): Promise<Record<string, any> | null> {
  const [, language] = key.split(":");
  const { fetchDDItemData } = await import("@/app/actions/riot");
  const result = await fetchDDItemData(language as 'ja' | 'en' | 'ko');
  return result?.idMap ?? null;
}

function extractKeystoneId(participant: any): string | null {
  const riotId = participant?.perks?.styles?.[0]?.selections?.[0]?.perk;
  if (typeof riotId !== 'number') return null;
  return findKeystoneByRiotId(riotId);
}

function estimateSpellRanks(level: number): [number, number, number, number] {
  if (level < 1) return [0, 0, 0, 0];
  // R ranks at Lv6, 11, 16
  const rRank = level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;
  const remaining = Math.min(level, 18) - rRank;
  // Distribute remaining points Q→W→E (max 5 each)
  const qRank = Math.min(5, remaining);
  const wRank = Math.min(5, Math.max(0, remaining - 5));
  const eRank = Math.min(5, Math.max(0, remaining - 10));
  return [qRank, wRank, eRank, rRank];
}

function getInitialState(matchData: any, puuid: string): CalculatorState {
  const participants = matchData?.info?.participants || [];
  const user = participants.find((p: any) => p.puuid === puuid);
  const opponent = user
    ? participants.find((p: any) => p.teamId !== user.teamId && p.teamPosition === user.teamPosition)
    : null;

  const extractItems = (p: any): (string | null)[] => {
    if (!p) return [null, null, null, null, null, null];
    return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map(
      (id: number) => (id && id !== 0 ? String(id) : null)
    );
  };

  const userLevel = user?.champLevel || 1;
  const opponentLevel = opponent?.champLevel || 1;

  return {
    left: {
      champion: user?.championName || "Aatrox",
      level: userLevel,
      items: extractItems(user),
      spellRanks: estimateSpellRanks(userLevel),
      keystone: extractKeystoneId(user),
    },
    right: {
      champion: opponent?.championName || "Aatrox",
      level: opponentLevel,
      items: extractItems(opponent),
      spellRanks: estimateSpellRanks(opponentLevel),
      keystone: extractKeystoneId(opponent),
    },
  };
}

function calculateDamage(
  attackerStats: ComputedStats,
  attackerLevel: number,
  attackerAbilities: ParsedAbility[],
  attackerSpellRanks: number[],
  attackerBaseAD: number,
  attackerItems: (string | null)[],
  attackerKeystone: string | null,
  targetStats: ComputedStats,
): DamageCalculationResult {
  // Auto attack
  const hasCritBonus = attackerItems.includes("3031") && attackerStats.critChance >= 0.6;
  const autoAttack = calculateAutoAttack(
    attackerStats,
    attackerLevel,
    targetStats,
    1.75,
    hasCritBonus,
    0.40
  );

  // Abilities
  const abilities = attackerAbilities.map((ability, idx) => {
    const rank = attackerSpellRanks[idx];
    if (rank === 0 || !ability.isDataComplete) {
      return {
        label: `${ability.key} (${ability.name})`,
        rawDamage: 0,
        mitigatedDamage: 0,
        damageType: ability.damageType as 'physical' | 'magic' | 'true',
        breakdown: rank === 0 ? "-" : "Data N/A",
      };
    }

    const baseDmg = ability.baseDamage[rank - 1] || 0;
    return calculateAbilityDamage(
      `${ability.key} (${ability.name})`,
      baseDmg,
      ability.scalings,
      ability.damageType as 'physical' | 'magic' | 'true',
      attackerStats,
      attackerLevel,
      attackerBaseAD,
      targetStats,
    );
  });

  // Item passives
  const itemPassives: DamageCalculationResult["itemPassives"] = [];
  const processedSpellblades = new Set<string>();

  for (const itemId of attackerItems) {
    if (!itemId) continue;
    const supplement = itemSupplementaryData[itemId];
    if (!supplement?.passives) continue;

    for (const passive of supplement.passives) {
      // Only one Spellblade can proc
      if (passive.name === "Spellblade") {
        if (processedSpellblades.has("Spellblade")) continue;
        processedSpellblades.add("Spellblade");
      }

      if (!passive.damage) continue;

      const bonusAD = getBonusAD(attackerStats.attackDamage, attackerBaseAD);
      const rawDamage = evaluatePassiveDamage(
        passive,
        {
          baseAD: attackerBaseAD,
          totalAD: attackerStats.attackDamage,
          bonusAD,
          ap: attackerStats.abilityPower,
          maxHP: attackerStats.hp,
        },
        { currentHP: targetStats.hp, maxHP: targetStats.hp },
      );

      if (rawDamage <= 0) continue;

      const mitigated = calculateMitigatedDamage(
        rawDamage,
        passive.damage.type,
        attackerStats,
        attackerLevel,
        targetStats,
      );

      itemPassives.push({
        label: passive.name,
        rawDamage: Math.round(rawDamage),
        mitigatedDamage: mitigated,
        damageType: passive.damage.type,
        breakdown: `${passive.damage.formula}`,
      });
    }
  }

  // Keystone damage
  let keystoneDamage: DamageCalculationResult["keystoneDamage"] = null;
  if (attackerKeystone) {
    const ks = keystoneData.find(k => k.id === attackerKeystone);
    if (ks && (ks.baseDamage[0] > 0 || ks.baseDamage[1] > 0)) {
      const baseDmg = getKeystoneDamageAtLevel(ks, attackerLevel);
      const adScaling = ks.adRatio * (ks.damageType === 'adaptive' && attackerStats.abilityPower > attackerStats.attackDamage ? 0 : attackerStats.attackDamage);
      const apScaling = ks.apRatio * (ks.damageType === 'adaptive' && attackerStats.abilityPower <= attackerStats.attackDamage ? 0 : attackerStats.abilityPower);
      const rawDamage = baseDmg + adScaling + apScaling;

      const dmgType: 'physical' | 'magic' | 'true' = ks.damageType === 'adaptive'
        ? (attackerStats.abilityPower > attackerStats.attackDamage ? 'magic' : 'physical')
        : ks.damageType as 'physical' | 'magic' | 'true';

      const mitigated = calculateMitigatedDamage(rawDamage, dmgType, attackerStats, attackerLevel, targetStats);

      keystoneDamage = {
        label: ks.name.ja,
        rawDamage: Math.round(rawDamage),
        mitigatedDamage: mitigated,
        damageType: dmgType,
        breakdown: `${baseDmg} base + scaling`,
      };
    }
  }

  // Total combo
  const abilityDamage = abilities.reduce((sum, a) => sum + a.mitigatedDamage, 0);
  const passiveDamage = itemPassives.reduce((sum, p) => sum + p.mitigatedDamage, 0);
  const totalCombo = autoAttack.mitigatedDamage + abilityDamage + passiveDamage + (keystoneDamage?.mitigatedDamage || 0);
  const targetHpPercent = targetStats.hp > 0 ? (totalCombo / targetStats.hp) * 100 : 0;

  return {
    autoAttack,
    abilities,
    itemPassives,
    keystoneDamage,
    totalCombo: Math.round(totalCombo),
    targetHpPercent,
  };
}

export default function DamageCalculator({ matchData, puuid, ddVersion, isExtra }: Props) {
  const { t, language } = useTranslation();
  const [state, setState] = useState<CalculatorState>(() => getInitialState(matchData, puuid));
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [champModalSide, setChampModalSide] = useState<'left' | 'right' | null>(null);
  const [itemModalSlot, setItemModalSlot] = useState<{ side: 'left' | 'right'; index: number } | null>(null);
  const [viewMode, setViewMode] = useState<'combo' | 'aiAnalysis'>('combo');
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');

  // Fetch champion details for both sides
  const { championDetail: leftDetail, binData: leftBinData } = useChampionDetail(state.left.champion, language as 'ja' | 'en' | 'ko');
  const { championDetail: rightDetail, binData: rightBinData } = useChampionDetail(state.right.champion, language as 'ja' | 'en' | 'ko');

  // Fetch champion list (for selector modal + browser panel)
  const { data: championList } = useSWR(
    !isCollapsed ? `champion-list:${language}` : null,
    fetchChampionList,
    { dedupingInterval: 86400000, revalidateOnFocus: false }
  );

  // Fetch item data
  const { data: itemDataMap } = useSWR(
    !isCollapsed ? `item-data:${language}` : null,
    fetchItemData,
    { dedupingInterval: 86400000, revalidateOnFocus: false }
  );

  // Parse abilities
  const leftAbilities = useMemo(() => {
    if (!leftDetail?.spells) return [];
    return parseAllSpells(leftDetail.spells, ddVersion, leftBinData, state.left.champion);
  }, [leftDetail, leftBinData, ddVersion, state.left.champion]);

  const rightAbilities = useMemo(() => {
    if (!rightDetail?.spells) return [];
    return parseAllSpells(rightDetail.spells, ddVersion, rightBinData, state.right.champion);
  }, [rightDetail, rightBinData, ddVersion, state.right.champion]);

  // Parse passives
  const leftPassive = useMemo(() => {
    if (!leftDetail?.passive) return null;
    return parsePassive(leftDetail.passive, ddVersion, leftBinData, state.left.champion);
  }, [leftDetail, leftBinData, ddVersion, state.left.champion]);

  const rightPassive = useMemo(() => {
    if (!rightDetail?.passive) return null;
    return parsePassive(rightDetail.passive, ddVersion, rightBinData, state.right.champion);
  }, [rightDetail, rightBinData, ddVersion, state.right.champion]);

  // Compute stats
  const leftStats = useMemo(() => {
    if (!leftDetail?.stats) return null;
    return computeStats(leftDetail.stats, state.left.level, state.left.items, itemDataMap ?? null);
  }, [leftDetail, state.left.level, state.left.items, itemDataMap]);

  const rightStats = useMemo(() => {
    if (!rightDetail?.stats) return null;
    return computeStats(rightDetail.stats, state.right.level, state.right.items, itemDataMap ?? null);
  }, [rightDetail, state.right.level, state.right.items, itemDataMap]);

  // Calculate damage both directions
  const leftToRight = useMemo(() => {
    if (!leftStats || !rightStats || !leftDetail) return null;
    return calculateDamage(
      leftStats, state.left.level, leftAbilities, state.left.spellRanks,
      getBaseAD(leftDetail.stats, state.left.level),
      state.left.items, state.left.keystone, rightStats,
    );
  }, [leftStats, rightStats, leftDetail, state.left, leftAbilities]);

  const rightToLeft = useMemo(() => {
    if (!leftStats || !rightStats || !rightDetail) return null;
    return calculateDamage(
      rightStats, state.right.level, rightAbilities, state.right.spellRanks,
      getBaseAD(rightDetail.stats, state.right.level),
      state.right.items, state.right.keystone, leftStats,
    );
  }, [leftStats, rightStats, rightDetail, state.right, rightAbilities]);

  // Update handler factories
  const updateSide = useCallback((side: 'left' | 'right', updates: Partial<CalculatorSide>) => {
    setState(prev => ({
      ...prev,
      [side]: { ...prev[side], ...updates },
    }));
  }, []);

  const handleItemClick = useCallback((side: 'left' | 'right', slotIndex: number) => {
    setItemModalSlot({ side, index: slotIndex });
  }, []);

  const handleItemRemove = useCallback((side: 'left' | 'right', slotIndex: number) => {
    setState(prev => {
      const newItems = [...prev[side].items];
      newItems[slotIndex] = null;
      return { ...prev, [side]: { ...prev[side], items: newItems } };
    });
  }, []);

  const handleItemSwap = useCallback((side: 'left' | 'right', fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newItems = [...prev[side].items];
      [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
      return { ...prev, [side]: { ...prev[side], items: newItems } };
    });
  }, []);

  const handleItemSelect = useCallback((itemId: string) => {
    if (!itemModalSlot) return;
    setState(prev => {
      const newItems = [...prev[itemModalSlot.side].items];
      newItems[itemModalSlot.index] = itemId;
      return { ...prev, [itemModalSlot.side]: { ...prev[itemModalSlot.side], items: newItems } };
    });
    setItemModalSlot(null);
  }, [itemModalSlot]);

  const handleChampionSelect = useCallback((championName: string) => {
    if (!champModalSide) return;
    const level = state[champModalSide].level;
    updateSide(champModalSide, {
      champion: championName,
      spellRanks: estimateSpellRanks(level),
      items: [null, null, null, null, null, null],
      keystone: null,
    });
    setChampModalSide(null);
  }, [champModalSide, state, updateSide]);

  const handleBrowserChampionSelect = useCallback((championName: string) => {
    const level = state[activeSide].level;
    updateSide(activeSide, {
      champion: championName,
      spellRanks: estimateSpellRanks(level),
      items: [null, null, null, null, null, null],
      keystone: null,
    });
  }, [activeSide, state, updateSide]);

  const handleExternalItemDrop = useCallback((side: 'left' | 'right', slotIndex: number, itemId: string) => {
    setState(prev => {
      const newItems = [...prev[side].items];
      newItems[slotIndex] = itemId;
      return { ...prev, [side]: { ...prev[side], items: newItems } };
    });
  }, []);

  const title = t("damageCalculator.title", "ダメージ計算シミュレーター");

  return (
    <div className="flex gap-4">
      {/* Calculator Card */}
      <div className="flex-1 min-w-0">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Header (always visible) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full px-4 py-3 bg-slate-800/50 flex justify-between items-center hover:bg-slate-800/70 transition-colors"
          >
            <h3 className="font-bold text-white flex items-center gap-2">
              <span>&#x2694;&#xFE0F;</span> {title}
            </h3>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Collapsible content */}
          {!isCollapsed && (
            <div className="p-4 border-t border-slate-800 space-y-4">
              {/* Champion Panels + Stats Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                {/* Left Champion */}
                <ChampionPanel
                  side={state.left}
                  stats={leftStats || emptyStats}
                  abilities={leftAbilities}
                  passive={leftPassive}
                  version={ddVersion}
                  label={t("damageCalculator.yourChampion", "自チャンピオン")}
                  borderColor="border-blue-500/30"
                  itemDataMap={itemDataMap ?? null}
                  onLevelChange={(lv) => updateSide("left", { level: lv })}
                  onSpellRanksChange={(ranks) => updateSide("left", { spellRanks: ranks })}
                  onItemClick={(idx) => handleItemClick("left", idx)}
                  onItemRemove={(idx) => handleItemRemove("left", idx)}
                  onItemSwap={(from, to) => handleItemSwap("left", from, to)}
                  onExternalItemDrop={(idx, itemId) => handleExternalItemDrop("left", idx, itemId)}
                  onKeystoneChange={(id) => updateSide("left", { keystone: id })}
                  onChampionClick={() => { setChampModalSide("left"); setActiveSide("left"); }}
                />

                {/* Stats Comparison (center) */}
                {leftStats && rightStats && (
                  <div className="hidden md:flex flex-col items-center justify-center pt-16">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                      {t("damageCalculator.stats", "ステータス")}
                    </div>
                    <StatsComparison leftStats={leftStats} rightStats={rightStats} />
                  </div>
                )}

                {/* Right Champion */}
                <ChampionPanel
                  side={state.right}
                  stats={rightStats || emptyStats}
                  abilities={rightAbilities}
                  passive={rightPassive}
                  version={ddVersion}
                  label={t("damageCalculator.enemyChampion", "敵チャンピオン")}
                  borderColor="border-red-500/30"
                  itemDataMap={itemDataMap ?? null}
                  onLevelChange={(lv) => updateSide("right", { level: lv })}
                  onSpellRanksChange={(ranks) => updateSide("right", { spellRanks: ranks })}
                  onItemClick={(idx) => handleItemClick("right", idx)}
                  onItemRemove={(idx) => handleItemRemove("right", idx)}
                  onItemSwap={(from, to) => handleItemSwap("right", from, to)}
                  onExternalItemDrop={(idx, itemId) => handleExternalItemDrop("right", idx, itemId)}
                  onKeystoneChange={(id) => updateSide("right", { keystone: id })}
                  onChampionClick={() => { setChampModalSide("right"); setActiveSide("right"); }}
                />
              </div>

              {/* Mobile Stats Comparison */}
              {leftStats && rightStats && (
                <div className="md:hidden bg-slate-800/30 rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 text-center">
                    {t("damageCalculator.stats", "ステータス")}
                  </div>
                  <StatsComparison leftStats={leftStats} rightStats={rightStats} />
                </div>
              )}

              {/* Mode Toggle */}
              {leftStats && rightStats && (
                <div className="flex items-center gap-0 justify-center">
                  <button
                    onClick={() => setViewMode('combo')}
                    className={`px-3 py-1 text-xs rounded-l-lg border-y border-l transition-colors ${
                      viewMode === 'combo'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {t("damageCalculator.comboMode", "瞬間コンボ")}
                  </button>
                  <button
                    onClick={() => setViewMode('aiAnalysis')}
                    className={`px-3 py-1 text-xs rounded-r-lg border-y border-r transition-colors ${
                      viewMode === 'aiAnalysis'
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {t("damageCalculator.aiAnalysisMode", "AI分析")}
                  </button>
                </div>
              )}

              {/* Damage Results - Combo Mode */}
              {viewMode === 'combo' && leftStats && rightStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left → Right */}
                  {leftToRight && (
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/10">
                      <DamageResultsPanel
                        result={leftToRight}
                        attackerName={state.left.champion}
                        targetName={state.right.champion}
                        targetHP={rightStats.hp}
                      />
                    </div>
                  )}

                  {/* Right → Left */}
                  {rightToLeft && (
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-red-500/10">
                      <DamageResultsPanel
                        result={rightToLeft}
                        attackerName={state.right.champion}
                        targetName={state.left.champion}
                        targetHP={leftStats.hp}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Damage Results - AI Analysis Mode */}
              {viewMode === 'aiAnalysis' && leftStats && rightStats && (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-violet-500/10">
                  <AIAnalysisPanel
                    isExtra={isExtra}
                    attackerChampion={state.left.champion}
                    attackerLevel={state.left.level}
                    attackerStats={leftStats}
                    attackerBaseAD={leftDetail ? getBaseAD(leftDetail.stats, state.left.level) : 0}
                    attackerAbilities={leftAbilities}
                    attackerSpellRanks={state.left.spellRanks}
                    attackerItems={state.left.items}
                    attackerKeystone={state.left.keystone}
                    defenderChampion={state.right.champion}
                    defenderLevel={state.right.level}
                    defenderStats={rightStats}
                    defenderItems={state.right.items}
                    defenderKeystone={state.right.keystone}
                    itemDataMap={itemDataMap ?? null}
                  />
                </div>
              )}

              {/* Loading indicator */}
              {(!leftDetail || !rightDetail) && (
                <div className="text-center text-slate-500 text-sm py-4">
                  {t("damageCalculator.loading", "チャンピオンデータを読み込み中...")}
                </div>
              )}
            </div>
          )}

          {/* Modals */}
          <ChampionSelectorModal
            isOpen={champModalSide !== null}
            onClose={() => setChampModalSide(null)}
            onSelect={handleChampionSelect}
            championList={championList || []}
            version={ddVersion}
          />

          <ItemSelectorModal
            isOpen={itemModalSlot !== null}
            onClose={() => setItemModalSlot(null)}
            onSelect={handleItemSelect}
            itemDataMap={itemDataMap ?? null}
            version={ddVersion}
          />
        </div>
      </div>

      {/* Browser Panel (desktop only, visible when expanded) */}
      {!isCollapsed && (
        <div className="hidden xl:block w-72 flex-shrink-0">
          <div className="sticky top-4">
            <ItemChampionBrowser
              itemDataMap={itemDataMap ?? null}
              championList={championList || []}
              version={ddVersion}
              activeSide={activeSide}
              onActiveSideChange={setActiveSide}
              onChampionSelect={handleBrowserChampionSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Default empty stats for initial render
const emptyStats: import("./types").ComputedStats = {
  hp: 0, mp: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0,
  attackSpeed: 0, critChance: 0, lethality: 0, armorPenPercent: 0,
  magicPenFlat: 0, magicPenPercent: 0, abilityHaste: 0, moveSpeed: 0,
};
