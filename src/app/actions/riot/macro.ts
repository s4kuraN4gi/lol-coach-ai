'use server'

import { logger } from "@/lib/logger";
import fs from 'fs/promises';
import path from 'path';
import type { ChampionAttributes, MacroKnowledge, MacroAdviceContext, TruthEvent } from "./types";

// ─── Champion Attributes Loader ──────────────────────────────────

export async function getChampionAttributes(championName: string): Promise<ChampionAttributes | null> {
    try {
        const filePath = path.join(process.cwd(), 'src/data/champion_attributes.json');

        // Cache or Read file
        // For simplicity in Server Action, we read each time (it's fast enough or Vercel cached)
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        return data[championName] || null;
    } catch (e) {
        logger.warn(`Failed to load champion attributes for ${championName}:`, e);
        return null;
    }
}

// ─── Macro Knowledge Loader ──────────────────────────────────────

let _macroKnowledgeCache: MacroKnowledge | null = null;

export async function getMacroKnowledge(): Promise<MacroKnowledge | null> {
    if (_macroKnowledgeCache) return _macroKnowledgeCache;

    try {
        const filePath = path.join(process.cwd(), 'src/data/macro_knowledge.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        _macroKnowledgeCache = JSON.parse(fileContent);
        return _macroKnowledgeCache;
    } catch (e) {
        logger.warn('Failed to load macro knowledge:', e);
        return null;
    }
}

// ─── Relevant Macro Advice (Legacy) ─────────────────────────────

/**
 * Get relevant macro advice based on game state
 */
export async function getRelevantMacroAdvice(
    goldDiff: number,
    gameTimeMs: number,
    objectiveType?: string,
    isAllyObjective?: boolean,
    userRole?: string
): Promise<string> {
    // Legacy function - only returns objective-specific advice (not full enhanced advice)
    // This is used when we need ONLY objective advice without duplicating the enhanced advice
    const knowledge = await getMacroKnowledge();
    if (!knowledge) return "";

    const adviceParts: string[] = [];

    // Only objective-specific advice
    if (objectiveType && isAllyObjective === false) {
        let objKey = objectiveType.toUpperCase();
        if (objKey.includes('DRAGON')) objKey = 'DRAGON';
        if (objKey.includes('BARON')) objKey = 'BARON_NASHOR';
        if (objKey.includes('HERALD') || objKey.includes('RIFT')) objKey = 'RIFT_HERALD';
        if (objKey.includes('HORDE') || objKey.includes('GRUB')) objKey = 'HORDE';

        const objInfo = knowledge.objective_response[objKey];
        if (objInfo?.when_enemy_starts) {
            let goldSituation = "";
            if (goldDiff <= -5000) goldSituation = "gold_behind_large";
            else if (goldDiff <= -2000) goldSituation = "gold_behind_small";
            else goldSituation = "gold_even";

            const situationAdvice = objInfo.when_enemy_starts[goldSituation];
            if (situationAdvice) {
                const roleKey = userRole?.toUpperCase() || "";
                const roleSpecific = situationAdvice.role_specific?.[roleKey] || "";

                adviceParts.push(`
**[Enemy ${objKey} - Macro Response Guide]**
Situation: ${situationAdvice.situation}
Recommended Action: ${situationAdvice.recommended_action}
Reasoning: ${situationAdvice.reasoning}
${roleSpecific ? `Your Role (${roleKey}): ${roleSpecific}` : ''}
${situationAdvice.common_mistakes ? `Common Mistakes to Avoid: ${situationAdvice.common_mistakes.join('; ')}` : ''}
                `.trim());
            }
        }
    }

    return adviceParts.join('\n\n');
}

// ─── Enhanced Macro Advice ───────────────────────────────────────

export async function getEnhancedMacroAdvice(
    context: MacroAdviceContext,
    objectiveType?: string,
    isAllyObjective?: boolean
): Promise<string> {
    try {
        const knowledge = await getMacroKnowledge();
        if (!knowledge) {
            logger.warn("[getEnhancedMacroAdvice] Failed to load macro knowledge");
            return "";
        }

        const { goldDiff, gameTimeMs, userRole, events, focusMode, deathCount, csDiff, enemyObjectivesTaken } = context;
        const adviceParts: string[] = [];
        const detectedMistakes: string[] = [];

    // ============================================================
    // 1. Game State Strategy based on gold difference
    // ============================================================
    let gameState = "";
    if (goldDiff <= -7000) gameState = "losing_hard";
    else if (goldDiff <= -3000) gameState = "losing_slightly";
    else if (goldDiff >= 7000) gameState = "winning_hard";
    else if (goldDiff >= 3000) gameState = "winning_slightly";
    else gameState = "even";

    const stateStrategy = knowledge.game_state_strategy[gameState];
    if (stateStrategy) {
        const roleKey = userRole?.toUpperCase() || "";
        const roleAdvice = stateStrategy.role_specific?.[roleKey] || "";
        adviceParts.push(`
**[Current Game State: ${stateStrategy.description}]**
Strategy: ${stateStrategy.general_strategy}
Priorities: ${stateStrategy.priorities?.join(', ') || 'N/A'}
${stateStrategy.avoid ? `Avoid: ${stateStrategy.avoid.join(', ')}` : ''}
${roleAdvice ? `${roleKey} Role Advice: ${roleAdvice}` : ''}
        `.trim());
    }

    // Add playing_from_behind strategy if behind
    if (goldDiff <= -3000 && knowledge.game_state_strategy.playing_from_behind) {
        const behindStrategy = knowledge.game_state_strategy.playing_from_behind;
        const roleKey = userRole?.toUpperCase() || "";
        const roleAdvice = behindStrategy.role_specific?.[roleKey] || "";
        adviceParts.push(`
**[Playing From Behind - Key Concepts]**
Cross-Mapping: ${behindStrategy.key_concepts?.cross_mapping || '敵がいる場所の反対側を押す'}
Compressed Map Advantage: ${behindStrategy.key_concepts?.compressed_map_advantage || '押し込まれている時は移動距離が短い'}
${roleAdvice ? `${roleKey} Role: ${roleAdvice}` : ''}
        `.trim());
        detectedMistakes.push('not_cross_mapping_when_behind');
    }

    // ============================================================
    // 2. Time Phase Priorities
    // ============================================================
    const gameTimeMin = Math.floor(gameTimeMs / 60000);
    let timePhase = "";
    if (gameTimeMin < 14) timePhase = "early_game";
    else if (gameTimeMin < 25) timePhase = "mid_game";
    else timePhase = "late_game";

    const phaseInfo = knowledge.time_phase_priorities[timePhase];
    if (phaseInfo && userRole) {
        const roleKey = userRole.toUpperCase();
        const roleFocus = phaseInfo.role_focus?.[roleKey];
        if (roleFocus) {
            adviceParts.push(`
**[Time Phase: ${phaseInfo.description} (${phaseInfo.time_range})]**
Role Focus for ${roleKey}: ${roleFocus}
${phaseInfo.key_concept ? `Key Concept: ${phaseInfo.key_concept}` : ''}
            `.trim());
        }
    }

    // ============================================================
    // 3. Objective-specific advice (when enemy takes objective)
    // ============================================================
    if (objectiveType && isAllyObjective === false) {
        let objKey = objectiveType.toUpperCase();
        if (objKey.includes('DRAGON')) objKey = 'DRAGON';
        if (objKey.includes('BARON')) objKey = 'BARON_NASHOR';
        if (objKey.includes('HERALD') || objKey.includes('RIFT')) objKey = 'RIFT_HERALD';
        if (objKey.includes('HORDE') || objKey.includes('GRUB')) objKey = 'HORDE';

        const objInfo = knowledge.objective_response[objKey];
        if (objInfo?.when_enemy_starts) {
            let goldSituation = "";
            if (goldDiff <= -5000) goldSituation = "gold_behind_large";
            else if (goldDiff <= -2000) goldSituation = "gold_behind_small";
            else goldSituation = "gold_even";

            const situationAdvice = objInfo.when_enemy_starts[goldSituation];
            if (situationAdvice) {
                const roleKey = userRole?.toUpperCase() || "";
                const roleSpecific = situationAdvice.role_specific?.[roleKey] || "";

                adviceParts.push(`
**[Enemy ${objKey} - Macro Response Guide]**
Situation: ${situationAdvice.situation}
Recommended Action: ${situationAdvice.recommended_action}
Reasoning: ${situationAdvice.reasoning}
${roleSpecific ? `Your Role (${roleKey}): ${roleSpecific}` : ''}
${situationAdvice.common_mistakes ? `Common Mistakes to Avoid: ${situationAdvice.common_mistakes.join('; ')}` : ''}
                `.trim());
            }
        }
    }

    // ============================================================
    // 4. Analyze Events to Detect Common Macro Mistakes
    // ============================================================
    if (events && events.length > 0) {
        // Define objective spawn times for "death before objective" detection
        const objectiveSpawns = [
            { type: 'DRAGON', firstSpawn: 5 * 60 * 1000, respawn: 5 * 60 * 1000 },
            { type: 'RIFT_HERALD', firstSpawn: 8 * 60 * 1000, respawn: 0 }, // Only spawns once
            { type: 'BARON', firstSpawn: 20 * 60 * 1000, respawn: 6 * 60 * 1000 },
            { type: 'HORDE', firstSpawn: 5 * 60 * 1000, respawn: 2 * 60 * 1000 }
        ];

        // Check for deaths before objectives
        const deaths = events.filter(e => e.type === 'DEATH');
        const objectives = events.filter(e => e.type === 'OBJECTIVE');

        for (const death of deaths) {
            // Check if there's an enemy objective within 90 seconds after death
            const nearbyEnemyObj = objectives.find(obj =>
                obj.context?.isAllyObjective === false &&
                obj.timestamp > death.timestamp &&
                obj.timestamp - death.timestamp < 90000 // 90 seconds
            );
            if (nearbyEnemyObj) {
                detectedMistakes.push('dying_before_objective');
                break;
            }
        }

        // Check for vision control issues
        const wardEvents = events.filter(e => e.type === 'WARD');
        const enemyObjectives = objectives.filter(e => e.context?.isAllyObjective === false);
        if (enemyObjectives.length > 0 && wardEvents.length < 5) {
            detectedMistakes.push('no_vision_control');
        }

        // Check for grouping without purpose (multiple deaths in mid/late game without objective context)
        const midLateDeath = deaths.filter(d => d.timestamp > 14 * 60 * 1000);
        if (midLateDeath.length >= 3) {
            detectedMistakes.push('grouping_without_purpose');
        }
    }

    // Add detected mistakes if high death count
    if (deathCount !== undefined && deathCount >= 5) {
        detectedMistakes.push('dying_before_objective');
    }

    // ============================================================
    // 5. Fundamental Concepts (for laning phase or low ELO)
    // ============================================================
    if (focusMode === 'LANING' || timePhase === 'early_game') {
        const fundamentals = knowledge.fundamental_concepts;

        if (fundamentals?.wave_based_macro) {
            adviceParts.push(`
**[Fundamental: Wave-Based Macro]**
Core Principle: ${fundamentals.wave_based_macro.core_principle}
Key Insight: ${fundamentals.wave_based_macro.key_insight}
            `.trim());
        }

        if (fundamentals?.wave_management) {
            const wm = fundamentals.wave_management;
            adviceParts.push(`
**[Wave Management Basics]**
Two Forces: Size (${wm.two_main_forces?.size?.principle || 'ミニオン数'}) and Location (${wm.two_main_forces?.location?.principle || 'ウェーブ位置'})
Best Wave States:
- Slow Push: ${wm.wave_states?.slow_push?.advantages?.slice(0, 2).join(', ') || 'トレード優位'}
- Held Wave: ${wm.wave_states?.held_wave?.key_insight || '最強のウェーブ状態'}
            `.trim());
        }

        if (fundamentals?.push_and_rotate) {
            adviceParts.push(`
**[Push and Rotate Cycle]**
Process: ${fundamentals.push_and_rotate.process?.slice(0, 2).join(' → ') || 'ウェーブをプッシュ → チームに合流'}
Timer Tip: ${fundamentals.push_and_rotate.timer_awareness?.tip || 'ウェーブがタワーに届く時間を意識'}
            `.trim());
        }
    }

    // ============================================================
    // 6. Season 16 Changes (Always relevant)
    // ============================================================
    if (knowledge.season_16_changes) {
        const s16 = knowledge.season_16_changes;
        adviceParts.push(`
**[Season 16 Key Changes]**
Playstyle: ${s16.playstyle_shift?.key_concept || 'Hit-and-Run戦術が最適'}
Tower Plates: ${s16.tower_plates?.impact || 'スプリットプッシュの価値上昇'}
Crystalline Overgrowth: ${s16.crystalline_overgrowth?.optimal_usage || 'タワーを叩いてバースト→離脱→戻る'}
        `.trim());

        // Role quests if applicable
        if (userRole && s16.role_quests?.[userRole.toUpperCase()]) {
            const roleQuest = s16.role_quests[userRole.toUpperCase()];
            if (roleQuest.completion_rewards) {
                adviceParts.push(`
**[Your Role Quest (${userRole.toUpperCase()})]**
Rewards: ${Array.isArray(roleQuest.completion_rewards) ? roleQuest.completion_rewards.slice(0, 2).join(', ') : 'N/A'}
                `.trim());
            }
        }
    }

    // ============================================================
    // 7. Lane Assignment (for mid/late game)
    // ============================================================
    if ((focusMode === 'MACRO' || timePhase !== 'early_game') && knowledge.fundamental_concepts?.lane_assignment) {
        const la = knowledge.fundamental_concepts.lane_assignment;
        const roleKey = userRole?.toUpperCase() || "";
        const roleAssignment = la.roles?.[roleKey] || "";
        adviceParts.push(`
**[Lane Assignment Basics]**
Core Principle: ${la.core_principle}
Your Role (${roleKey}): ${roleAssignment}
Common Mistake: ${la.common_mistake}
        `.trim());
    }

    // ============================================================
    // 8. Include Detected Common Macro Mistakes
    // ============================================================
    const uniqueMistakes = [...new Set(detectedMistakes)];
    if (uniqueMistakes.length > 0 && knowledge.common_macro_mistakes) {
        const mistakeAdvices: string[] = [];
        for (const mistakeId of uniqueMistakes.slice(0, 3)) { // Limit to 3 mistakes
            const mistake = knowledge.common_macro_mistakes[mistakeId];
            if (mistake) {
                const roleKey = userRole?.toUpperCase() || "";
                const isRelevantRole = !mistake.related_roles || mistake.related_roles.includes(roleKey);
                if (isRelevantRole) {
                    mistakeAdvices.push(`
- **${mistake.description}**: ${mistake.advice}
  Example: ${mistake.examples?.[0] || 'N/A'}
                    `.trim());
                }
            }
        }
        if (mistakeAdvices.length > 0) {
            adviceParts.push(`
**[Detected Macro Mistakes - Fix These]**
${mistakeAdvices.join('\n')}
            `.trim());
        }
    }

    // ============================================================
    // 9. Wave Cycling (for laning dominance)
    // ============================================================
    if (focusMode === 'LANING' && knowledge.fundamental_concepts?.wave_cycling) {
        const wc = knowledge.fundamental_concepts.wave_cycling;
        adviceParts.push(`
**[Wave Cycling for Lane Dominance]**
Concept: ${wc.concept}
Key Points: ${wc.key_points?.slice(0, 2).join('; ') || 'N/A'}
        `.trim());
    }

        return adviceParts.join('\n\n');
    } catch (error) {
        logger.error("[getEnhancedMacroAdvice] Error:", error);
        return "";
    }
}
