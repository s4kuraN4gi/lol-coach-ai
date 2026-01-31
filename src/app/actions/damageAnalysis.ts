'use server';

import { createClient } from "@/utils/supabase/server";
import { isExtraTier } from "./constants";
import { getAnalysisStatus } from "./analysis";

export type DamageAnalysisInput = {
    attacker: {
        champion: string;
        level: number;
        stats: {
            hp: number;
            attackDamage: number;
            abilityPower: number;
            armor: number;
            magicResist: number;
            attackSpeed: number;
            critChance: number;
            lethality: number;
            armorPenPercent: number;
            magicPenFlat: number;
            magicPenPercent: number;
            abilityHaste: number;
        };
        baseAD: number;
        abilities: {
            key: string;
            name: string;
            baseDamage: number[];
            scalings: { stat: string; ratio: number }[];
            damageType: string;
            cooldown: number[];
            rank: number;
        }[];
        items: string[];
        keystone: string | null;
    };
    defender: {
        champion: string;
        level: number;
        stats: {
            hp: number;
            attackDamage: number;
            abilityPower: number;
            armor: number;
            magicResist: number;
            attackSpeed: number;
            lethality: number;
            armorPenPercent: number;
            magicPenFlat: number;
            magicPenPercent: number;
        };
        items: string[];
        keystone: string | null;
    };
    locale: string;
};

export type ComboStep = {
    step: number;
    action: string;
    damage: number;
    type: 'physical' | 'magic' | 'true';
    procs: string[];
    cumulative: number;
    notes: string;
};

export type DamageAnalysisResult = {
    optimalCombo: {
        sequence: string[];
        reasoning: string;
    };
    comboBreakdown: ComboStep[];
    totalComboDamage: number;
    killPotential: {
        canKill: boolean;
        hpRemaining: number;
        overkill: number;
    };
    extendedTrade: {
        dps: number;
        timeToKill: number;
    };
    strategicAdvice: string;
};

const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

async function generateContentWithRetry(model: any, content: any, retries = 0): Promise<any> {
    try {
        return await model.generateContent(content);
    } catch (e: any) {
        const isRateLimit = e.message?.includes('429') || e.status === 429 || e.message?.includes('Too Many Requests');
        if (isRateLimit && retries < 2) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            return generateContentWithRetry(model, content, retries + 1);
        }
        if (isRateLimit) {
            throw new Error("AI Service is busy. Please try again in 30 seconds.");
        }
        throw e;
    }
}

function buildPrompt(input: DamageAnalysisInput): string {
    const { attacker, defender, locale } = input;

    const langInstruction = locale === 'ja'
        ? '日本語で回答してください。'
        : locale === 'ko'
            ? '한국어로 답변해주세요.'
            : 'Respond in English.';

    const abilityDetails = attacker.abilities
        .filter(a => a.rank > 0)
        .map(a => {
            const scalingStr = a.scalings.map(s => `${(s.ratio * 100).toFixed(0)}% ${s.stat}`).join(' + ');
            return `  ${a.key} (${a.name}): Base ${a.baseDamage[a.rank - 1] || 0}, Scaling: ${scalingStr || 'none'}, Type: ${a.damageType}, CD: ${a.cooldown[a.rank - 1] || 0}s, Rank ${a.rank}`;
        })
        .join('\n');

    return `You are a League of Legends damage calculation expert. Analyze the following 1v1 matchup and calculate the optimal burst combo.

${langInstruction}

=== ATTACKER ===
Champion: ${attacker.champion} (Level ${attacker.level})
Stats: HP=${attacker.stats.hp}, AD=${attacker.stats.attackDamage} (Base: ${attacker.baseAD}), AP=${attacker.stats.abilityPower}, AS=${attacker.stats.attackSpeed.toFixed(2)}, Crit=${(attacker.stats.critChance * 100).toFixed(0)}%, AH=${attacker.stats.abilityHaste}
Pen: Lethality=${attacker.stats.lethality}, Armor Pen%=${(attacker.stats.armorPenPercent * 100).toFixed(0)}%, Magic Pen Flat=${attacker.stats.magicPenFlat}, Magic Pen%=${(attacker.stats.magicPenPercent * 100).toFixed(0)}%
Abilities:
${abilityDetails || '  (none learned)'}
Items: ${attacker.items.length > 0 ? attacker.items.join(', ') : 'None'}
Keystone: ${attacker.keystone || 'None'}

=== DEFENDER ===
Champion: ${defender.champion} (Level ${defender.level})
Stats: HP=${defender.stats.hp}, AD=${defender.stats.attackDamage}, AP=${defender.stats.abilityPower}, Armor=${defender.stats.armor}, MR=${defender.stats.magicResist}
Items: ${defender.items.length > 0 ? defender.items.join(', ') : 'None'}
Keystone: ${defender.keystone || 'None'}

=== DEFENSE FORMULAS ===
Physical Damage Reduction:
  Effective Armor = Armor × (1 - Armor Pen%) - Lethality × (0.6 + 0.4 × AttackerLevel/18)
  Damage Multiplier = 100 / (100 + Effective Armor) if Effective Armor >= 0
  Damage Multiplier = 2 - 100 / (100 - Effective Armor) if Effective Armor < 0

Magic Damage Reduction:
  Effective MR = MR × (1 - Magic Pen%) - Magic Pen Flat
  Same formula as above with Effective MR

=== INSTRUCTIONS ===
1. Calculate the optimal burst combo (fastest way to deal maximum damage)
2. Include auto-attacks between abilities (AA-cancels) where applicable
3. Account for item passives (Spellblade/Sheen procs, Luden's, etc.) and keystone damage
4. Use the defense formulas above for accurate post-mitigation damage
5. Consider the champion's known combos and animation cancels

Output ONLY valid JSON in this format:
{
  "optimalCombo": {
    "sequence": ["AA", "Q", "AA", "W", "E", "R", "AA"],
    "reasoning": "Brief explanation of why this combo order"
  },
  "comboBreakdown": [
    {
      "step": 1,
      "action": "AA (Auto Attack)",
      "damage": 125,
      "type": "physical",
      "procs": ["Electrocute (ready)"],
      "cumulative": 125,
      "notes": "Opens with auto to start combo"
    }
  ],
  "totalComboDamage": 1500,
  "killPotential": {
    "canKill": true,
    "hpRemaining": -200,
    "overkill": 200
  },
  "extendedTrade": {
    "dps": 450,
    "timeToKill": 3.5
  },
  "strategicAdvice": "Tactical advice for this matchup"
}`;
}

export async function analyzeDamageMatchup(input: DamageAnalysisInput): Promise<{
    success: boolean;
    data?: DamageAnalysisResult;
    error?: string;
}> {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Extra tier check
    const status = await getAnalysisStatus();
    if (!isExtraTier(status)) {
        return { success: false, error: "Extra plan required for AI damage analysis" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { success: false, error: "AI service not configured" };
    }

    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const prompt = buildPrompt(input);

        let finalJson = "";

        for (const modelName of MODELS_TO_TRY) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { responseMimeType: "application/json" }
                });
                const result = await generateContentWithRetry(model, prompt);
                finalJson = result.response.text();
                if (finalJson) break;
            } catch (e: any) {
                console.warn(`[DamageAnalysis] Failed with ${modelName}: ${e.message}`);
            }
        }

        if (!finalJson) {
            throw new Error("All AI models failed to respond");
        }

        // Sanitize markdown wrappers
        finalJson = finalJson.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(finalJson) as DamageAnalysisResult;
        return { success: true, data: parsed };

    } catch (e: any) {
        console.error("[DamageAnalysis] Error:", e);
        return { success: false, error: e.message || "Analysis failed" };
    }
}
