// ========================================
// Keystone Rune Damage Data
// ========================================

export type KeystoneData = {
  id: string;
  riotId: number;
  name: { ja: string; en: string; ko: string };
  tree: string;
  baseDamage: [number, number]; // [lv1, lv18] linear interpolation
  adRatio: number;
  apRatio: number;
  damageType: 'adaptive' | 'physical' | 'magic' | 'true';
  cooldown: number;
  description: { ja: string; en: string; ko: string };
};

/**
 * Interpolate keystone base damage at a given level (1-18)
 */
export function getKeystoneDamageAtLevel(keystone: KeystoneData, level: number): number {
  const [min, max] = keystone.baseDamage;
  return Math.round(min + (max - min) * (level - 1) / 17);
}

export const keystoneData: KeystoneData[] = [
  // --- Domination ---
  {
    id: "electrocute",
    riotId: 8112,
    name: { ja: "電撃", en: "Electrocute", ko: "감전" },
    tree: "Domination",
    baseDamage: [30, 180],
    adRatio: 0.4,
    apRatio: 0.25,
    damageType: "adaptive",
    cooldown: 25,
    description: {
      ja: "3回の攻撃/スキルで追加ダメージ",
      en: "3 attacks/abilities deal bonus damage",
      ko: "3회 공격/스킬로 추가 피해"
    }
  },
  {
    id: "dark-harvest",
    riotId: 8128,
    name: { ja: "魂の収穫", en: "Dark Harvest", ko: "어둠의 수확" },
    tree: "Domination",
    baseDamage: [20, 60],
    adRatio: 0.25,
    apRatio: 0.15,
    damageType: "adaptive",
    cooldown: 45,
    description: {
      ja: "低HP敵に追加ダメージ（スタック蓄積）",
      en: "Bonus damage to low HP enemies (stacking)",
      ko: "저체력 적에게 추가 피해 (스택 누적)"
    }
  },

  // --- Sorcery ---
  {
    id: "arcane-comet",
    riotId: 8229,
    name: { ja: "秘術の彗星", en: "Arcane Comet", ko: "비전 혜성" },
    tree: "Sorcery",
    baseDamage: [30, 100],
    adRatio: 0.2,
    apRatio: 0.35,
    damageType: "adaptive",
    cooldown: 20,
    description: {
      ja: "スキル命中時に彗星を落とす",
      en: "Landing an ability launches a comet",
      ko: "스킬 적중 시 혜성을 발사"
    }
  },
  {
    id: "summon-aery",
    riotId: 8214,
    name: { ja: "エアリー召喚", en: "Summon Aery", ko: "에어리 소환" },
    tree: "Sorcery",
    baseDamage: [10, 40],
    adRatio: 0.15,
    apRatio: 0.1,
    damageType: "adaptive",
    cooldown: 0,
    description: {
      ja: "攻撃/スキル時にエアリーが敵に向かう",
      en: "Attacks/abilities send Aery to enemies",
      ko: "공격/스킬 시 에어리가 적에게 돌진"
    }
  },

  // --- Precision ---
  {
    id: "conqueror",
    riotId: 8010,
    name: { ja: "征服者", en: "Conqueror", ko: "정복자" },
    tree: "Precision",
    baseDamage: [0, 0],  // Conqueror gives stacking AD/AP, not burst damage
    adRatio: 0,
    apRatio: 0,
    damageType: "adaptive",
    cooldown: 0,
    description: {
      ja: "戦闘中にAD/APがスタック増加（最大12スタック）",
      en: "Stacking AD/AP in combat (max 12 stacks)",
      ko: "전투 중 AD/AP 스택 증가 (최대 12스택)"
    }
  },
  {
    id: "lethal-tempo",
    riotId: 8008,
    name: { ja: "リーサルテンポ", en: "Lethal Tempo", ko: "치명적 속도" },
    tree: "Precision",
    baseDamage: [0, 0],  // AS steroid, not direct damage
    adRatio: 0,
    apRatio: 0,
    damageType: "physical",
    cooldown: 0,
    description: {
      ja: "攻撃速度がスタック増加",
      en: "Stacking attack speed bonus",
      ko: "공격 속도 스택 증가"
    }
  },
  {
    id: "press-the-attack",
    riotId: 8005,
    name: { ja: "プレスアタック", en: "Press the Attack", ko: "집중 공격" },
    tree: "Precision",
    baseDamage: [40, 180],
    adRatio: 0,
    apRatio: 0,
    damageType: "adaptive",
    cooldown: 6,
    description: {
      ja: "3回の通常攻撃で追加ダメージ + 被ダメージ増加",
      en: "3 auto attacks deal bonus damage + expose target",
      ko: "3회 기본 공격으로 추가 피해 + 받는 피해 증가"
    }
  },
  {
    id: "fleet-footwork",
    riotId: 8021,
    name: { ja: "フリートフットワーク", en: "Fleet Footwork", ko: "기민한 발놀림" },
    tree: "Precision",
    baseDamage: [0, 0],  // Heal, not damage
    adRatio: 0,
    apRatio: 0,
    damageType: "physical",
    cooldown: 0,
    description: {
      ja: "エナジー満タン時に回復 + 移動速度上昇",
      en: "Heal + move speed boost at full energy",
      ko: "에너지 충전 시 회복 + 이동 속도 증가"
    }
  },

  // --- Resolve ---
  {
    id: "grasp-of-the-undying",
    riotId: 8437,
    name: { ja: "不死者の握撃", en: "Grasp of the Undying", ko: "착취의 손아귀" },
    tree: "Resolve",
    baseDamage: [0, 0],  // % max HP damage
    adRatio: 0,
    apRatio: 0,
    damageType: "magic",
    cooldown: 4,
    description: {
      ja: "4秒戦闘後の通常攻撃で最大HP割合ダメージ",
      en: "After 4s combat, auto deals % max HP damage",
      ko: "4초 전투 후 기본 공격으로 최대 체력 비례 피해"
    }
  },

  // --- Inspiration ---
  {
    id: "first-strike",
    riotId: 8369,
    name: { ja: "ファーストストライク", en: "First Strike", ko: "선제 공격" },
    tree: "Inspiration",
    baseDamage: [0, 0],  // 9% bonus true damage on first hit
    adRatio: 0,
    apRatio: 0,
    damageType: "true",
    cooldown: 25,
    description: {
      ja: "先制攻撃で追加確定ダメージ + ゴールド獲得",
      en: "First attack deals bonus true damage + gold",
      ko: "선제 공격 시 추가 고정 피해 + 골드 획득"
    }
  },
];

/**
 * Conqueror stacking AD/AP bonus.
 * At max stacks (12): 1.2-3.6 AD or 2-6 AP per stack (level scaling)
 */
export function getConquerorBonusPerStack(level: number, isAP: boolean): number {
  if (isAP) {
    return 2 + (6 - 2) * (level - 1) / 17;
  }
  return 1.2 + (3.6 - 1.2) * (level - 1) / 17;
}

export const CONQUEROR_MAX_STACKS = 12;

/**
 * Find keystone app ID by Riot perk ID
 */
export function findKeystoneByRiotId(riotId: number): string | null {
  const ks = keystoneData.find(k => k.riotId === riotId);
  return ks?.id ?? null;
}
