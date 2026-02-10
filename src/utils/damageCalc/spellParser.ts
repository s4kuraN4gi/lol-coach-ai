import type {
  DDragonSpell,
  DDragonPassive,
  ParsedAbility,
  ScalingStat,
  AbilityScaling,
  BinSpellData,
  BinSpellCalculation,
  BinFormulaPart,
} from "@/app/dashboard/match/[matchId]/components/DamageCalculator/types";

// ========================================
// DDragon helpers (tooltip-based detection)
// ========================================

/**
 * Detect damage type from DDragon tooltip HTML tags.
 */
function detectDamageType(tooltip: string): 'physical' | 'magic' | 'true' | 'unknown' {
  const magicCount = (tooltip.match(/<magicDamage>/gi) || []).length;
  const physicalCount = (tooltip.match(/<physicalDamage>/gi) || []).length;
  const trueCount = (tooltip.match(/<trueDamage>/gi) || []).length;

  if (trueCount > 0 && trueCount >= magicCount && trueCount >= physicalCount) return 'true';
  if (magicCount > 0 && magicCount >= physicalCount) return 'magic';
  if (physicalCount > 0) return 'physical';

  return 'unknown';
}

// ========================================
// CommunityDragon bin.json parser
// ========================================

/**
 * Map CommunityDragon mStat numeric values to ScalingStat.
 * Default (undefined/0) = AP.
 * mStat=1 = Bonus AD, mStat=2 = AD, etc.
 */
function mapBinStatToScaling(mStat: number | undefined): ScalingStat {
  switch (mStat) {
    case undefined:
    case 0: return 'ap';     // AbilityPower (default)
    case 1: return 'bonusAd'; // BonusAttackDamage
    case 2: return 'ad';     // AttackDamage (total)
    case 3: return 'armor';  // Armor
    case 4: return 'ap';     // AbilityPower (explicit)
    case 5: return 'mr';     // MagicResist
    case 6: return 'mr';     // Bonus MR (treat same as MR)
    case 11: return 'maxHp'; // MaxHealth
    case 29: return 'lethality'; // Lethality (Pyke R etc.)
    default: return 'unknown';
  }
}

// ========================================
// Level-based damage helpers
// ========================================

/** Representative champion levels for ranks 1-5 (typical when skill is leveled) */
const RANK_LEVELS = [1, 6, 11, 16, 18];

/**
 * Calculate level-interpolated value (ByCharLevelInterpolationCalculationPart).
 * Linear interpolation: mStartValue + (mEndValue - mStartValue) * (level - 1) / 17
 */
function interpolateByLevel(startValue: number, endValue: number, level: number): number {
  return startValue + (endValue - startValue) * (level - 1) / 17;
}

/**
 * Calculate breakpoint-based value (ByCharLevelBreakpointsCalculationPart).
 * Starts at mLevel1Value, then adds growth rate per level from breakpoints.
 */
function calculateBreakpointValue(
  level1Value: number,
  breakpoints: Array<{ mLevel: number; mBonusPerLevelAtAndAfter: number }>,
  level: number,
): number {
  // Sort breakpoints by level ascending
  const sorted = [...breakpoints].sort((a, b) => a.mLevel - b.mLevel);
  let value = level1Value;
  for (let lv = 2; lv <= level; lv++) {
    // Find the most recent breakpoint at or before this level
    let rate = 0;
    for (const bp of sorted) {
      if (bp.mLevel <= lv) rate = bp.mBonusPerLevelAtAndAfter;
    }
    value += rate;
  }
  return value;
}

/**
 * Extract level-based damage as a 5-element array (ranks 1-5).
 * Uses representative levels [1, 6, 11, 16, 18].
 */
function extractLevelBasedDamage(part: BinFormulaPart): number[] | null {
  if (part.__type === "ByCharLevelInterpolationCalculationPart") {
    const start = part.mStartValue ?? 0;
    const end = part.mEndValue ?? 0;
    if (start === 0 && end === 0) return null;
    return RANK_LEVELS.map(lv => Math.round(interpolateByLevel(start, end, lv)));
  }

  if (part.__type === "ByCharLevelBreakpointsCalculationPart") {
    const level1 = part.mLevel1Value ?? 0;
    const breakpoints = part.mBreakpoints;
    if (!breakpoints || breakpoints.length === 0) return null;
    return RANK_LEVELS.map(lv => Math.round(calculateBreakpointValue(level1, breakpoints, lv)));
  }

  return null;
}

// ========================================
// Formula part processor (handles all 9 types)
// ========================================

type PartResult = {
  baseDamage: number[] | null;
  scaling: AbilityScaling | null;
};

/**
 * Process a single formula part recursively.
 * Returns extracted base damage array and/or scaling info.
 * depth limit prevents infinite recursion in nested subparts.
 */
function processFormulaPart(
  part: BinFormulaPart,
  dataValueMap: Record<string, number[]>,
  depth: number = 0,
): PartResult {
  if (depth >= 2) return { baseDamage: null, scaling: null };

  switch (part.__type) {
    // === Existing 3 types ===

    case "NamedDataValueCalculationPart": {
      if (!part.mDataValue) return { baseDamage: null, scaling: null };
      const key = part.mDataValue.toLowerCase();
      const values = dataValueMap[key];
      if (!values) return { baseDamage: null, scaling: null };

      if (key.includes("ratio") || key.includes("coefficient") || key.includes("apratio") || key.includes("adratio")) {
        let stat: ScalingStat = 'ap';
        if (key.includes("bonusad")) stat = 'bonusAd';
        else if (key.includes("ad")) stat = 'ad';
        else if (key.includes("hp") || key.includes("health")) stat = 'maxHp';
        else if (key.includes("armor")) stat = 'armor';
        else if (key.includes("mr") || key.includes("spellblock")) stat = 'mr';
        else if (key.includes("lethality")) stat = 'lethality';

        const ratio = values[1] ?? values[0] ?? 0;
        if (ratio > 0 && ratio <= 10) {
          return { baseDamage: null, scaling: { stat, ratio } };
        }
      } else {
        return { baseDamage: values.slice(1, 6), scaling: null };
      }
      return { baseDamage: null, scaling: null };
    }

    case "StatByCoefficientCalculationPart": {
      const stat = mapBinStatToScaling(part.mStat);
      const ratio = part.mCoefficient ?? 0;
      if (stat !== 'unknown' && ratio > 0 && ratio <= 10) {
        return { baseDamage: null, scaling: { stat, ratio } };
      }
      return { baseDamage: null, scaling: null };
    }

    case "StatByNamedDataValueCalculationPart": {
      const stat = mapBinStatToScaling(part.mStat);
      if (part.mDataValue) {
        const values = dataValueMap[part.mDataValue.toLowerCase()];
        const ratio = values?.[1] ?? values?.[0] ?? 0;
        if (stat !== 'unknown' && ratio > 0 && ratio <= 10) {
          return { baseDamage: null, scaling: { stat, ratio } };
        }
      }
      return { baseDamage: null, scaling: null };
    }

    // === New 6 types ===

    case "ByCharLevelInterpolationCalculationPart":
    case "ByCharLevelBreakpointsCalculationPart": {
      const dmg = extractLevelBasedDamage(part);
      return { baseDamage: dmg, scaling: null };
    }

    case "NumberCalculationPart": {
      const num = part.mNumber ?? 0;
      if (num > 0) {
        return { baseDamage: new Array(5).fill(num), scaling: null };
      }
      return { baseDamage: null, scaling: null };
    }

    case "SumOfSubPartsCalculationPart": {
      const subparts = part.mSubparts;
      if (!subparts || subparts.length === 0) return { baseDamage: null, scaling: null };

      let mergedBase: number[] | null = null;
      const mergedScalings: AbilityScaling[] = [];

      for (const sub of subparts) {
        const result = processFormulaPart(sub, dataValueMap, depth + 1);
        if (result.baseDamage) {
          if (!mergedBase) {
            mergedBase = [...result.baseDamage];
          } else {
            for (let i = 0; i < Math.min(mergedBase.length, result.baseDamage.length); i++) {
              mergedBase[i] += result.baseDamage[i];
            }
          }
        }
        if (result.scaling) {
          mergedScalings.push(result.scaling);
        }
      }

      // Return the first scaling found (SumOfSubParts typically combines base + ratio)
      return { baseDamage: mergedBase, scaling: mergedScalings[0] ?? null };
    }

    case "ProductOfSubPartsCalculationPart": {
      const p1 = part.mPart1;
      const p2 = part.mPart2;
      if (!p1 || !p2) return { baseDamage: null, scaling: null };

      const r1 = processFormulaPart(p1, dataValueMap, depth + 1);
      const r2 = processFormulaPart(p2, dataValueMap, depth + 1);

      // Multiply base damages element-wise if both have arrays
      if (r1.baseDamage && r2.baseDamage) {
        const product = r1.baseDamage.map((v, i) =>
          Math.round(v * (r2.baseDamage![i] ?? 1))
        );
        return { baseDamage: product, scaling: r1.scaling ?? r2.scaling ?? null };
      }

      // If one has base and other is a constant scalar, multiply
      const baseArr = r1.baseDamage ?? r2.baseDamage;
      const otherResult = r1.baseDamage ? r2 : r1;
      if (baseArr && !otherResult.baseDamage) {
        // The other part might be a constant — check for NumberCalculationPart result
        // If it has no baseDamage, just return the base array as-is
        return { baseDamage: baseArr, scaling: r1.scaling ?? r2.scaling ?? null };
      }

      // Scaling × scaling or other combinations — return what we can
      return { baseDamage: r1.baseDamage ?? r2.baseDamage, scaling: r1.scaling ?? r2.scaling ?? null };
    }

    case "StatBySubPartCalculationPart": {
      const stat = mapBinStatToScaling(part.mStat);
      if (stat === 'unknown') return { baseDamage: null, scaling: null };

      const sub = part.mSubpart;
      if (!sub) {
        // Fallback: use coefficient if present
        const ratio = part.mCoefficient ?? 0;
        if (ratio > 0 && ratio <= 10) {
          return { baseDamage: null, scaling: { stat, ratio } };
        }
        return { baseDamage: null, scaling: null };
      }

      // Process subpart to get the ratio value
      const subResult = processFormulaPart(sub, dataValueMap, depth + 1);
      if (subResult.baseDamage) {
        // Use rank 1 value as the ratio (subpart provides per-rank ratios)
        const ratio = subResult.baseDamage[0] ?? 0;
        if (ratio > 0 && ratio <= 10) {
          return { baseDamage: null, scaling: { stat, ratio } };
        }
      }
      return { baseDamage: null, scaling: null };
    }

    default:
      return { baseDamage: null, scaling: null };
  }
}

// ========================================
// Main bin.json parser
// ========================================

/**
 * Extract base damage and scaling from a bin.json spell entry.
 *
 * Strategy:
 * 1. Look at mSpellCalculations for the first "damage" calculation
 * 2. Parse its mFormulaParts using processFormulaPart (handles 9 types)
 */
function parseBinSpellData(
  binSpell: BinSpellData,
): { baseDamage: number[]; scalings: AbilityScaling[] } | null {
  const { mDataValues, mSpellCalculations } = binSpell;
  if (!mSpellCalculations || !mDataValues) return null;

  // Build a lookup for DataValues
  const dataValueMap: Record<string, number[]> = {};
  for (const dv of mDataValues) {
    dataValueMap[dv.mName.toLowerCase()] = dv.mValues;
  }

  // Find the primary damage calculation
  // Priority: look for keys containing "damage" (case-insensitive)
  const calcEntries = Object.entries(mSpellCalculations);
  let primaryCalc: BinSpellCalculation | null = null;

  // First pass: find exact "TotalDamage" or similar
  for (const [key, calc] of calcEntries) {
    const keyLower = key.toLowerCase();
    if (
      calc.__type === "GameCalculation" &&
      (keyLower.includes("totaldamage") ||
       keyLower.includes("calculatedamage") ||
       keyLower.includes("calculateddamage"))
    ) {
      primaryCalc = calc;
      break;
    }
  }

  // Second pass: any "damage" key
  if (!primaryCalc) {
    for (const [key, calc] of calcEntries) {
      if (calc.__type === "GameCalculation" && key.toLowerCase().includes("damage")) {
        primaryCalc = calc;
        break;
      }
    }
  }

  // Third pass: first GameCalculation
  if (!primaryCalc) {
    for (const [, calc] of calcEntries) {
      if (calc.__type === "GameCalculation" && calc.mFormulaParts) {
        primaryCalc = calc;
        break;
      }
    }
  }

  if (!primaryCalc?.mFormulaParts) return null;

  let baseDamage: number[] = [];
  const scalings: AbilityScaling[] = [];

  for (const part of primaryCalc.mFormulaParts) {
    const result = processFormulaPart(part, dataValueMap);
    if (result.baseDamage && baseDamage.length === 0) {
      baseDamage = result.baseDamage;
    } else if (result.baseDamage && baseDamage.length > 0) {
      // Add to existing base damage (multiple base sources)
      for (let i = 0; i < Math.min(baseDamage.length, result.baseDamage.length); i++) {
        baseDamage[i] += result.baseDamage[i];
      }
    }
    if (result.scaling) {
      scalings.push(result.scaling);
    }
  }

  // Relaxed guard: allow spells with only scalings (no base damage)
  if (baseDamage.length === 0 && scalings.length === 0) return null;

  // Ensure baseDamage has 5 entries even if only scalings exist
  if (baseDamage.length === 0) {
    baseDamage = new Array(5).fill(0);
  }

  return { baseDamage, scalings };
}

/**
 * Find bin.json spell entry for a given DDragon spell ID.
 *
 * CommunityDragon key patterns:
 * - Characters/{Champion}/Spells/{SpellId}Ability/{SpellId}
 * - Characters/{Champion}/Spells/{Champion}{Q|W|E|R}Ability/{Champion}{Q|W|E|R}
 */
function findBinSpellEntry(
  binData: Record<string, any>,
  championName: string,
  spellId: string,
  key: string,
): BinSpellData | null {
  const champName = championName;

  // Try exact DDragon spell ID first
  const patterns = [
    `Characters/${champName}/Spells/${spellId}Ability/${spellId}`,
    `Characters/${champName}/Spells/${champName}${key}Ability/${champName}${key}`,
    `Characters/${champName}/Spells/${spellId}Ability`,
  ];

  for (const pattern of patterns) {
    const entry = binData[pattern];
    if (entry?.mSpell) {
      const spell = entry.mSpell;
      // bin.json uses "DataValues" (not "mDataValues") for spell data
      const dataValues = spell.mDataValues || spell.DataValues;
      if (dataValues || spell.mSpellCalculations) {
        return {
          mDataValues: dataValues || [],
          mSpellCalculations: spell.mSpellCalculations || {},
          mCastTime: spell.mCastTime ?? undefined,
        };
      }
    }
  }

  // Fallback: search through all keys for matching spell
  const spellIdLower = spellId.toLowerCase();
  for (const [binKey, value] of Object.entries(binData)) {
    if (
      binKey.toLowerCase().includes(`/spells/${spellIdLower}`) &&
      binKey.toLowerCase().endsWith(`/${spellIdLower}`)
    ) {
      const spell = (value as any)?.mSpell;
      if (!spell) continue;
      const dataValues = spell.mDataValues || spell.DataValues;
      if (dataValues || spell.mSpellCalculations) {
        return {
          mDataValues: dataValues || [],
          mSpellCalculations: spell.mSpellCalculations || {},
          mCastTime: spell.mCastTime ?? undefined,
        };
      }
    }
  }

  return null;
}

// ========================================
// Main parser
// ========================================

/**
 * Parse a single spell using CommunityDragon bin data + DDragon metadata.
 */
export function parseSpell(
  spell: DDragonSpell,
  key: string,
  ddVersion: string,
  binData: Record<string, any> | null,
  championName: string,
): ParsedAbility {
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${spell.image?.full || ""}`;
  const damageType = detectDamageType(spell.tooltip || "");
  const cooldown = spell.cooldown || new Array(spell.maxrank).fill(0);
  const description = spell.description || "";

  // Try CommunityDragon bin data first
  let baseDamage: number[] = new Array(spell.maxrank).fill(0);
  let scalings: AbilityScaling[] = [];
  let isDataComplete = false;
  let castTime = key === 'R' ? 0.5 : 0.25; // default cast times

  if (binData) {
    const binSpellEntry = findBinSpellEntry(binData, championName, spell.id, key);
    if (binSpellEntry) {
      const parsed = parseBinSpellData(binSpellEntry);
      if (parsed && (parsed.baseDamage.some(d => d > 0) || parsed.scalings.length > 0)) {
        baseDamage = parsed.baseDamage;
        scalings = parsed.scalings;
        isDataComplete = true;
      }
      if (binSpellEntry.mCastTime !== undefined) {
        castTime = binSpellEntry.mCastTime;
      }
    }
  }

  return {
    key,
    id: spell.id,
    name: spell.name,
    description,
    iconUrl,
    maxRank: spell.maxrank,
    baseDamage,
    scalings,
    damageType: damageType === 'unknown' ? 'magic' : damageType,
    cooldown,
    castTime,
    isDataComplete,
  };
}

/**
 * Parse all 4 spells (Q, W, E, R) from DDragon champion detail + CommunityDragon bin data.
 */
export function parseAllSpells(
  spells: DDragonSpell[],
  ddVersion: string,
  binData: Record<string, any> | null = null,
  championName: string = "",
): ParsedAbility[] {
  const keys = ["Q", "W", "E", "R"];
  return spells.slice(0, 4).map((spell, i) =>
    parseSpell(spell, keys[i], ddVersion, binData, championName)
  );
}

/**
 * Find bin.json passive entry for a given champion.
 *
 * CommunityDragon key patterns for passives:
 * - Characters/{Champion}/Spells/{Champion}PassiveAbility/{Champion}Passive
 * - Characters/{Champion}/Spells/{PassiveImageId}Ability/{PassiveImageId}
 */
function findBinPassiveEntry(
  binData: Record<string, any>,
  championName: string,
  passiveImageId: string,
): BinSpellData | null {
  const patterns = [
    `Characters/${championName}/Spells/${championName}PassiveAbility/${championName}Passive`,
    `Characters/${championName}/Spells/${passiveImageId}Ability/${passiveImageId}`,
  ];

  for (const pattern of patterns) {
    const entry = binData[pattern];
    if (entry?.mSpell) {
      const spell = entry.mSpell;
      const dataValues = spell.mDataValues || spell.DataValues;
      if (dataValues || spell.mSpellCalculations) {
        return {
          mDataValues: dataValues || [],
          mSpellCalculations: spell.mSpellCalculations || {},
          mCastTime: spell.mCastTime ?? undefined,
        };
      }
    }
  }

  // Fallback: search for passive-related keys
  const champLower = championName.toLowerCase();
  for (const [binKey, value] of Object.entries(binData)) {
    const keyLower = binKey.toLowerCase();
    if (
      keyLower.includes(`characters/${champLower}/spells/`) &&
      keyLower.includes("passive")
    ) {
      const spell = (value as any)?.mSpell;
      if (!spell) continue;
      const dataValues = spell.mDataValues || spell.DataValues;
      if (dataValues || spell.mSpellCalculations) {
        return {
          mDataValues: dataValues || [],
          mSpellCalculations: spell.mSpellCalculations || {},
          mCastTime: spell.mCastTime ?? undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Parse champion passive using CommunityDragon bin data + DDragon passive metadata.
 * Returns a ParsedAbility with key="P", castTime=0, cooldown=[].
 * If no damage data is found, isDataComplete will be false.
 */
export function parsePassive(
  passive: DDragonPassive,
  ddVersion: string,
  binData: Record<string, any> | null,
  championName: string,
): ParsedAbility {
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/passive/${passive.image?.full || ""}`;
  const description = passive.description || "";
  const damageType = detectDamageType(description);

  // Extract image ID (filename without extension) for bin.json lookup
  const passiveImageId = passive.image?.full?.replace(/\.png$/i, "") || "";

  let baseDamage: number[] = new Array(5).fill(0);
  let scalings: AbilityScaling[] = [];
  let isDataComplete = false;

  if (binData) {
    const binPassiveEntry = findBinPassiveEntry(binData, championName, passiveImageId);
    if (binPassiveEntry) {
      const parsed = parseBinSpellData(binPassiveEntry);
      if (parsed && (parsed.baseDamage.some(d => d > 0) || parsed.scalings.length > 0)) {
        baseDamage = parsed.baseDamage;
        scalings = parsed.scalings;
        isDataComplete = true;
      }
    }
  }

  return {
    key: "P",
    id: passiveImageId || `${championName}Passive`,
    name: passive.name,
    description,
    iconUrl,
    maxRank: 5,
    baseDamage,
    scalings,
    damageType: damageType === 'unknown' ? 'magic' : damageType,
    cooldown: [],
    castTime: 0,
    isDataComplete,
  };
}
