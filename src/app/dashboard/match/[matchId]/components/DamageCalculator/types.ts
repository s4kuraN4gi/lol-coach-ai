// ========================================
// Damage Calculator Types
// ========================================

// --- DDragon Champion Detail Types ---

export type DDragonChampionStats = {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  crit: number;
  critperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeedperlevel: number;
  attackspeed: number;
};

export type DDragonSpellVar = {
  link: string;   // "spelldamage", "attackdamage", "bonusattackdamage", "bonushealth", etc.
  coeff: number | number[];
  key: string;    // "a1", "a2", etc.
};

export type DDragonSpell = {
  id: string;
  name: string;
  description: string;
  tooltip: string;
  maxrank: number;
  cooldown: number[];
  cooldownBurn: string;
  cost: number[];
  costBurn: string;
  effect: (number[] | null)[];
  effectBurn: (string | null)[];
  vars: DDragonSpellVar[];
  image: { full: string };
};

export type DDragonPassive = {
  name: string;
  description: string;
  image: { full: string };
};

export type DDragonChampionDetail = {
  id: string;
  key: string;
  name: string;
  title: string;
  stats: DDragonChampionStats;
  spells: DDragonSpell[];
  passive: DDragonPassive;
  image: { full: string };
};

// --- Parsed Ability Types ---

export type ScalingStat = 'ap' | 'ad' | 'bonusAd' | 'baseAd' | 'bonusHp' | 'maxHp' | 'armor' | 'mr' | 'lethality' | 'unknown';

export type AbilityScaling = {
  stat: ScalingStat;
  ratio: number;
};

export type ParsedAbility = {
  key: string;             // "Q", "W", "E", "R"
  id: string;              // spell ID
  name: string;
  description: string;     // DDragon plain-text description
  iconUrl: string;
  maxRank: number;
  baseDamage: number[];    // per rank
  scalings: AbilityScaling[];
  damageType: 'physical' | 'magic' | 'true' | 'unknown';
  cooldown: number[];
  castTime: number;        // seconds, from bin.json mCastTime (default 0.25s)
  isDataComplete: boolean;
};

// --- Calculator State ---

export type CalculatorSide = {
  champion: string;
  level: number;
  items: (string | null)[];   // item IDs, 6 slots
  spellRanks: number[];       // [Q, W, E, R], 0 = not learned, 1-5 = rank
  keystone: string | null;
};

export type CalculatorState = {
  left: CalculatorSide;
  right: CalculatorSide;
};

// --- Computed Stats ---

export type ComputedStats = {
  hp: number;
  mp: number;
  armor: number;
  magicResist: number;
  attackDamage: number;
  abilityPower: number;
  attackSpeed: number;
  critChance: number;
  lethality: number;
  armorPenPercent: number;
  magicPenFlat: number;
  magicPenPercent: number;
  abilityHaste: number;
  moveSpeed: number;
};

// --- CommunityDragon Bin Data Types ---

export type BinDataValue = {
  mName: string;
  mValues: number[];  // 7 entries: indices 0-6 (rank 0-5, index 0 often unused)
};

export type BinFormulaPart = {
  __type: string;
  mDataValue?: string;
  mCoefficient?: number;
  mStat?: number;          // 0=AP(default), 1=BonusAD, 2=AD, etc.
  mStartValue?: number;    // for ByCharLevelInterpolationCalculationPart
  mEndValue?: number;
  // ByCharLevelBreakpointsCalculationPart
  mLevel1Value?: number;
  mBreakpoints?: Array<{ mLevel: number; mBonusPerLevelAtAndAfter: number }>;
  // SumOfSubPartsCalculationPart
  mSubparts?: BinFormulaPart[];
  // ProductOfSubPartsCalculationPart
  mPart1?: BinFormulaPart;
  mPart2?: BinFormulaPart;
  // StatBySubPartCalculationPart
  mSubpart?: BinFormulaPart;
  // NumberCalculationPart
  mNumber?: number;
};

export type BinSpellCalculation = {
  __type: string;           // "GameCalculation" | "GameCalculationModified"
  mFormulaParts?: BinFormulaPart[];
  mModifiedGameCalculation?: string;
  mMultiplier?: BinFormulaPart;
};

export type BinSpellData = {
  mDataValues: BinDataValue[];
  mSpellCalculations: Record<string, BinSpellCalculation>;
  mCastTime?: number;
};

// --- Damage Results ---

export type SingleDamageResult = {
  label: string;
  rawDamage: number;
  mitigatedDamage: number;    // after defense
  damageType: 'physical' | 'magic' | 'true';
  breakdown: string;           // e.g., "140 + 85(0.45 AP)"
};

export type DamageCalculationResult = {
  autoAttack: SingleDamageResult;
  abilities: SingleDamageResult[];   // Q, W, E, R
  itemPassives: SingleDamageResult[];
  keystoneDamage: SingleDamageResult | null;
  totalCombo: number;
  targetHpPercent: number;     // combo / targetHP * 100
};

