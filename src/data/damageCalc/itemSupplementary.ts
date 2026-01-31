// ========================================
// Item Supplementary Data
// DDragon stats object doesn't include lethality, pen, ability haste, etc.
// This file provides those stats + passive effects for damage calculation.
// ========================================

export type ItemPassive = {
  name: string;
  trigger: 'onHit' | 'afterAbility' | 'burst' | 'passive';
  damage?: {
    formula: string;    // human-readable formula key
    type: 'physical' | 'magic' | 'true';
  };
  amplification?: {
    stat: string;
    percent: number;
  };
  cooldown?: number;
};

export type SupplementaryStats = {
  lethality?: number;
  armorPenPercent?: number;
  magicPenFlat?: number;
  magicPenPercent?: number;
  abilityHaste?: number;
  omnivamp?: number;
  critDamageBonus?: number;
};

export type ItemSupplement = {
  stats?: SupplementaryStats;
  passives?: ItemPassive[];
};

/**
 * Evaluate item passive damage based on attacker stats.
 * Returns raw damage before mitigation.
 */
export function evaluatePassiveDamage(
  passive: ItemPassive,
  attackerStats: {
    baseAD: number;
    totalAD: number;
    bonusAD: number;
    ap: number;
    maxHP: number;
  },
  targetStats: {
    currentHP: number;
    maxHP: number;
  }
): number {
  if (!passive.damage) return 0;

  switch (passive.damage.formula) {
    // Spellblade variants
    case "2.0 * baseAD":
      return 2.0 * attackerStats.baseAD;
    case "1.0 * baseAD":
      return 1.0 * attackerStats.baseAD;
    case "0.75 * AP + 0.5 * baseAD":
      return 0.75 * attackerStats.ap + 0.5 * attackerStats.baseAD;

    // On-hit effects
    case "0.10 * targetCurrentHP":
      return 0.10 * targetStats.currentHP;
    case "0.15 * AP":
      return 0.15 * attackerStats.ap;
    case "15 + 0.15 * AP":
      return 15 + 0.15 * attackerStats.ap;
    case "flatOnHit:42":
      return 42; // Wit's End base

    // Burst effects
    case "100 + 0.10 * AP":
      return 100 + 0.10 * attackerStats.ap;

    default:
      return 0;
  }
}

// ========================================
// Item Data by ID
// Item IDs correspond to DDragon item.json keys
// ========================================

export const itemSupplementaryData: Record<string, ItemSupplement> = {

  // ====== LETHALITY ITEMS ======

  // Youmuu's Ghostblade
  "3142": {
    stats: { lethality: 18, abilityHaste: 15 },
  },

  // Edge of Night
  "3814": {
    stats: { lethality: 10, abilityHaste: 15 },
  },

  // Serpent's Fang
  "6694": {
    stats: { lethality: 12, abilityHaste: 10 },
  },

  // Hubris
  "6697": {
    stats: { lethality: 15, abilityHaste: 10 },
  },

  // Opportunity
  "6701": {
    stats: { lethality: 18 },
  },

  // Voltaic Cyclosword
  "6698": {
    stats: { lethality: 12 },
  },

  // Profane Hydra
  "6696": {
    stats: { lethality: 12, abilityHaste: 20 },
  },

  // ====== ARMOR PENETRATION ITEMS ======

  // Lord Dominik's Regards
  "3036": {
    stats: { armorPenPercent: 0.35 },
  },

  // Mortal Reminder
  "3033": {
    stats: { armorPenPercent: 0.35 },
  },

  // Black Cleaver
  "3071": {
    stats: { armorPenPercent: 0.30, abilityHaste: 20 },
  },

  // Serylda's Grudge
  "6695": {
    stats: { armorPenPercent: 0.30, abilityHaste: 15 },
  },

  // ====== MAGIC PENETRATION ITEMS ======

  // Sorcerer's Shoes
  "3020": {
    stats: { magicPenFlat: 15 },
  },

  // Shadowflame
  "4645": {
    stats: { magicPenFlat: 12 },
  },

  // Void Staff
  "3135": {
    stats: { magicPenPercent: 0.40 },
  },

  // Stormsurge
  "6653": {
    stats: { magicPenFlat: 10 },
    passives: [{
      name: "Squall",
      trigger: "burst",
      damage: { formula: "100 + 0.10 * AP", type: "magic" },
      cooldown: 30,
    }],
  },

  // Cryptbloom
  "6620": {
    stats: { magicPenFlat: 10 },
  },

  // ====== SPELLBLADE ITEMS ======

  // Trinity Force
  "3078": {
    stats: { abilityHaste: 20 },
    passives: [{
      name: "Spellblade",
      trigger: "afterAbility",
      damage: { formula: "2.0 * baseAD", type: "physical" },
      cooldown: 1.5,
    }],
  },

  // Lich Bane
  "3100": {
    stats: { abilityHaste: 10 },
    passives: [{
      name: "Spellblade",
      trigger: "afterAbility",
      damage: { formula: "0.75 * AP + 0.5 * baseAD", type: "magic" },
      cooldown: 2.5,
    }],
  },

  // Iceborn Gauntlet
  "6662": {
    stats: { abilityHaste: 20 },
    passives: [{
      name: "Spellblade",
      trigger: "afterAbility",
      damage: { formula: "1.0 * baseAD", type: "physical" },
      cooldown: 1.5,
    }],
  },

  // ====== ON-HIT ITEMS ======

  // Blade of the Ruined King
  "3153": {
    passives: [{
      name: "Mist's Edge",
      trigger: "onHit",
      damage: { formula: "0.10 * targetCurrentHP", type: "physical" },
    }],
  },

  // Nashor's Tooth
  "3115": {
    stats: { abilityHaste: 10 },
    passives: [{
      name: "Icathian Bite",
      trigger: "onHit",
      damage: { formula: "15 + 0.15 * AP", type: "magic" },
    }],
  },

  // Wit's End
  "3091": {
    passives: [{
      name: "Fray",
      trigger: "onHit",
      damage: { formula: "flatOnHit:42", type: "magic" },
    }],
  },

  // ====== CRIT AMPLIFICATION ======

  // Infinity Edge
  "3031": {
    stats: { critDamageBonus: 0.40 },
    // Note: only active when crit chance >= 60%
  },

  // ====== AP AMPLIFICATION ======

  // Rabadon's Deathcap
  "3089": {
    passives: [{
      name: "Magical Opus",
      trigger: "passive",
      amplification: { stat: "ap", percent: 0.35 },
    }],
  },

  // ====== BURST ITEMS ======

  // Luden's Companion
  "6655": {
    stats: { magicPenFlat: 10, abilityHaste: 10 },
    passives: [{
      name: "Fire",
      trigger: "burst",
      damage: { formula: "100 + 0.10 * AP", type: "magic" },
      cooldown: 10,
    }],
  },

  // ====== ABILITY HASTE ONLY ======

  // Cosmic Drive
  "4629": {
    stats: { abilityHaste: 25 },
  },

  // Frozen Heart
  "3110": {
    stats: { abilityHaste: 20 },
  },

  // Zhonya's Hourglass
  "3157": {
    stats: { abilityHaste: 10 },
  },

  // Banshee's Veil
  "3102": {
    stats: { abilityHaste: 10 },
  },

  // Navori Flickerblade
  "6675": {
    stats: { abilityHaste: 15 },
  },

  // Essence Reaver
  "3508": {
    stats: { abilityHaste: 20 },
    passives: [{
      name: "Spellblade",
      trigger: "afterAbility",
      damage: { formula: "1.0 * baseAD", type: "physical" },
      cooldown: 1.5,
    }],
  },

  // Death's Dance
  "6333": {
    stats: { abilityHaste: 15 },
  },

  // Maw of Malmortius
  "3156": {
    stats: { abilityHaste: 10 },
  },

  // Spirit Visage
  "3065": {
    stats: { abilityHaste: 10 },
  },

  // Sunfire Aegis / Hollow Radiance
  "6664": {
    stats: { abilityHaste: 10 },
  },

  // Jak'Sho, The Protean
  "6665": {
    stats: { abilityHaste: 10 },
  },

  // Liandry's Torment
  "4633": {
    stats: { abilityHaste: 15 },
  },

  // Rod of Ages
  "6657": {
    stats: { abilityHaste: 10 },
  },

  // ====== BOOTS (for magic pen) ======

  // Ionian Boots of Lucidity
  "3158": {
    stats: { abilityHaste: 15 },
  },
};
