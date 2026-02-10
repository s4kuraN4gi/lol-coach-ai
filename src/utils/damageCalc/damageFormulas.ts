import type { ComputedStats, SingleDamageResult } from "@/app/dashboard/match/[matchId]/components/DamageCalculator/types";

/**
 * Calculate effective armor after penetration.
 * Order: % armor pen → flat reduction (lethality)
 * Lethality scales with attacker level: flat = lethality * (0.6 + 0.4 * level / 18)
 */
export function getEffectiveArmor(
  targetArmor: number,
  attackerLevel: number,
  armorPenPercent: number,
  lethality: number
): number {
  const afterPercent = targetArmor * (1 - armorPenPercent);
  const flatPen = lethality * (0.6 + 0.4 * attackerLevel / 18);
  return Math.max(0, afterPercent - flatPen);
}

/**
 * Calculate effective magic resist after penetration.
 * Order: % magic pen → flat magic pen
 */
export function getEffectiveMR(
  targetMR: number,
  magicPenPercent: number,
  magicPenFlat: number
): number {
  const afterPercent = targetMR * (1 - magicPenPercent);
  return Math.max(0, afterPercent - magicPenFlat);
}

/**
 * Calculate damage multiplier from effective defense.
 * Formula: 100 / (100 + effectiveDefense)
 */
export function defenseMitigation(effectiveDefense: number): number {
  if (effectiveDefense <= 0) return 1;
  return 100 / (100 + effectiveDefense);
}

/**
 * Calculate physical damage after armor mitigation.
 */
export function calculatePhysicalDamage(
  rawDamage: number,
  attackerStats: ComputedStats,
  attackerLevel: number,
  targetStats: ComputedStats
): number {
  const effectiveArmor = getEffectiveArmor(
    targetStats.armor,
    attackerLevel,
    attackerStats.armorPenPercent,
    attackerStats.lethality
  );
  return Math.round(rawDamage * defenseMitigation(effectiveArmor));
}

/**
 * Calculate magic damage after MR mitigation.
 */
export function calculateMagicDamage(
  rawDamage: number,
  attackerStats: ComputedStats,
  targetStats: ComputedStats
): number {
  const effectiveMR = getEffectiveMR(
    targetStats.magicResist,
    attackerStats.magicPenPercent,
    attackerStats.magicPenFlat
  );
  return Math.round(rawDamage * defenseMitigation(effectiveMR));
}

/**
 * Calculate mitigated damage based on damage type.
 */
export function calculateMitigatedDamage(
  rawDamage: number,
  damageType: 'physical' | 'magic' | 'true',
  attackerStats: ComputedStats,
  attackerLevel: number,
  targetStats: ComputedStats
): number {
  switch (damageType) {
    case 'physical':
      return calculatePhysicalDamage(rawDamage, attackerStats, attackerLevel, targetStats);
    case 'magic':
      return calculateMagicDamage(rawDamage, attackerStats, targetStats);
    case 'true':
      return Math.round(rawDamage);
  }
}

/**
 * Calculate auto attack damage result.
 */
export function calculateAutoAttack(
  attackerStats: ComputedStats,
  attackerLevel: number,
  targetStats: ComputedStats,
  critMultiplier: number = 1.75, // default crit multiplier
  hasCritBonus: boolean = false, // Infinity Edge
  critBonusAmount: number = 0.40
): SingleDamageResult {
  const rawDamage = attackerStats.attackDamage;
  const mitigated = calculatePhysicalDamage(rawDamage, attackerStats, attackerLevel, targetStats);

  // Calculate crit damage for display
  const effectiveCritMultiplier = hasCritBonus ? critMultiplier + critBonusAmount : critMultiplier;
  const critRaw = rawDamage * effectiveCritMultiplier;
  const critMitigated = calculatePhysicalDamage(critRaw, attackerStats, attackerLevel, targetStats);

  const hasCrit = attackerStats.critChance > 0;
  const breakdown = hasCrit
    ? `${rawDamage.toFixed(0)} AD (crit: ${critMitigated})`
    : `${rawDamage.toFixed(0)} AD`;

  return {
    label: "Auto Attack",
    rawDamage,
    mitigatedDamage: mitigated,
    damageType: 'physical',
    breakdown,
  };
}

/**
 * Calculate ability damage result.
 */
export function calculateAbilityDamage(
  abilityName: string,
  baseDamage: number,
  scalings: { stat: string; ratio: number }[],
  damageType: 'physical' | 'magic' | 'true',
  attackerStats: ComputedStats,
  attackerLevel: number,
  baseAD: number,
  targetStats: ComputedStats
): SingleDamageResult {
  let totalScaling = 0;
  const scalingParts: string[] = [];

  for (const scaling of scalings) {
    let statValue = 0;
    let statLabel = "";

    switch (scaling.stat) {
      case 'ap':
        statValue = attackerStats.abilityPower;
        statLabel = "AP";
        break;
      case 'ad':
        statValue = attackerStats.attackDamage;
        statLabel = "AD";
        break;
      case 'bonusAd':
        statValue = Math.max(0, attackerStats.attackDamage - baseAD);
        statLabel = "bAD";
        break;
      case 'baseAd':
        statValue = baseAD;
        statLabel = "bsAD";
        break;
      case 'maxHp':
        statValue = attackerStats.hp;
        statLabel = "HP";
        break;
      case 'armor':
        statValue = attackerStats.armor;
        statLabel = "AR";
        break;
      case 'mr':
        statValue = attackerStats.magicResist;
        statLabel = "MR";
        break;
      case 'lethality':
        statValue = attackerStats.lethality;
        statLabel = "Leth";
        break;
      default:
        continue;
    }

    const scalingDamage = statValue * scaling.ratio;
    totalScaling += scalingDamage;
    scalingParts.push(`${scalingDamage.toFixed(0)}(${(scaling.ratio * 100).toFixed(0)}% ${statLabel})`);
  }

  const rawDamage = baseDamage + totalScaling;
  const mitigated = calculateMitigatedDamage(rawDamage, damageType, attackerStats, attackerLevel, targetStats);

  const breakdown = scalingParts.length > 0
    ? `${baseDamage} + ${scalingParts.join(" + ")}`
    : `${baseDamage}`;

  return {
    label: abilityName,
    rawDamage: Math.round(rawDamage),
    mitigatedDamage: mitigated,
    damageType,
    breakdown,
  };
}
