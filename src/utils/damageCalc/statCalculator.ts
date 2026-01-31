import type { DDragonChampionStats, ComputedStats } from "@/app/dashboard/match/[matchId]/components/DamageCalculator/types";
import { itemSupplementaryData } from "@/data/damageCalc/itemSupplementary";

/**
 * Calculate a champion stat at a given level using LoL's official formula.
 * Formula: base + growth * (level - 1) * (0.7025 + 0.0175 * (level - 1))
 */
export function statAtLevel(base: number, growth: number, level: number): number {
  return base + growth * (level - 1) * (0.7025 + 0.0175 * (level - 1));
}

/**
 * Stat key mapping from DDragon item stats to our ComputedStats fields.
 */
const DDRAGON_STAT_MAP: Record<string, keyof ComputedStats> = {
  FlatHPPoolMod: "hp",
  FlatPhysicalDamageMod: "attackDamage",
  FlatMagicDamageMod: "abilityPower",
  FlatArmorMod: "armor",
  FlatSpellBlockMod: "magicResist",
  FlatCritChanceMod: "critChance",
  FlatMovementSpeedMod: "moveSpeed",
  // PercentAttackSpeedMod is handled separately (multiplicative)
};

/**
 * Compute full stats for a champion at a given level with items equipped.
 *
 * @param baseStats - DDragon champion base stats
 * @param level - Champion level (1-18)
 * @param itemIds - Array of item IDs (up to 6, nulls for empty slots)
 * @param itemDataMap - DDragon item data map (from fetchDDItemData)
 * @returns Computed stats including all item bonuses
 */
export function computeStats(
  baseStats: DDragonChampionStats,
  level: number,
  itemIds: (string | null)[],
  itemDataMap: Record<string, any> | null,
): ComputedStats {
  // Base stats at level
  const stats: ComputedStats = {
    hp: Math.round(statAtLevel(baseStats.hp, baseStats.hpperlevel, level)),
    mp: Math.round(statAtLevel(baseStats.mp, baseStats.mpperlevel, level)),
    armor: Math.round(statAtLevel(baseStats.armor, baseStats.armorperlevel, level) * 10) / 10,
    magicResist: Math.round(statAtLevel(baseStats.spellblock, baseStats.spellblockperlevel, level) * 10) / 10,
    attackDamage: Math.round(statAtLevel(baseStats.attackdamage, baseStats.attackdamageperlevel, level) * 10) / 10,
    abilityPower: 0,
    attackSpeed: baseStats.attackspeed * (1 + baseStats.attackspeedperlevel * (level - 1) / 100),
    critChance: 0,
    lethality: 0,
    armorPenPercent: 0,
    magicPenFlat: 0,
    magicPenPercent: 0,
    abilityHaste: 0,
    moveSpeed: baseStats.movespeed,
  };

  // Track bonus AS from items (additive, then applied to base)
  let bonusASPercent = 0;
  // Track raw AP before Rabadon amplification
  let hasRabadons = false;

  // Add item stats
  const validItems = itemIds.filter((id): id is string => id !== null);

  for (const itemId of validItems) {
    // DDragon stats
    if (itemDataMap?.[itemId]?.stats) {
      const itemStats = itemDataMap[itemId].stats;
      for (const [ddKey, ourKey] of Object.entries(DDRAGON_STAT_MAP)) {
        if (itemStats[ddKey]) {
          stats[ourKey] += itemStats[ddKey];
        }
      }
      // Attack speed is special (percentage-based)
      if (itemStats.PercentAttackSpeedMod) {
        bonusASPercent += itemStats.PercentAttackSpeedMod;
      }
    }

    // Supplementary stats (lethality, pen, AH, etc.)
    const supplement = itemSupplementaryData[itemId];
    if (supplement?.stats) {
      const s = supplement.stats;
      if (s.lethality) stats.lethality += s.lethality;
      if (s.armorPenPercent) stats.armorPenPercent += s.armorPenPercent;
      if (s.magicPenFlat) stats.magicPenFlat += s.magicPenFlat;
      if (s.magicPenPercent) stats.magicPenPercent += s.magicPenPercent;
      if (s.abilityHaste) stats.abilityHaste += s.abilityHaste;
    }

    // Check for Rabadon's
    if (itemId === "3089") hasRabadons = true;
  }

  // Apply attack speed bonus
  stats.attackSpeed = baseStats.attackspeed * (1 + baseStats.attackspeedperlevel * (level - 1) / 100 + bonusASPercent);
  stats.attackSpeed = Math.round(stats.attackSpeed * 1000) / 1000;

  // Apply Rabadon's Deathcap AP amplification
  if (hasRabadons) {
    stats.abilityPower = Math.round(stats.abilityPower * 1.35);
  }

  // Cap armor pen percent (doesn't stack above 1.0)
  stats.armorPenPercent = Math.min(stats.armorPenPercent, 1.0);
  stats.magicPenPercent = Math.min(stats.magicPenPercent, 1.0);

  // Round final values
  stats.hp = Math.round(stats.hp);
  stats.mp = Math.round(stats.mp);
  stats.attackDamage = Math.round(stats.attackDamage * 10) / 10;

  return stats;
}

/**
 * Get base AD at level (before items) for Spellblade calculations.
 */
export function getBaseAD(baseStats: DDragonChampionStats, level: number): number {
  return Math.round(statAtLevel(baseStats.attackdamage, baseStats.attackdamageperlevel, level) * 10) / 10;
}

/**
 * Get bonus AD (total AD - base AD) for scaling calculations.
 */
export function getBonusAD(totalAD: number, baseAD: number): number {
  return Math.max(0, totalAD - baseAD);
}
