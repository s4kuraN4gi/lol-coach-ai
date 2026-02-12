'use server'

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = "asia"; // Account V1, Match V5 (Asia/Sea)
const PLATFORM_ROUTING = "jp1"; // Summoner V4, League V4 (Japan)

// Types
export type RiotAccount = {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export type SummonerDTO = {
    accountId: string;
    profileIconId: number;
    revisionDate: number;
    name: string;
    id: string; // SummonerID
    puuid: string;
    summonerLevel: number;
}

export type LeagueEntryDTO = {
    leagueId: string;
    queueType: string;
    tier: string;
    rank: string;
    summonerId: string;
    summonerName: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    hotStreak: boolean;
    veteran: boolean;
    freshBlood: boolean;
    inactive: boolean;
}

// 1. Get Account by Riot ID (Name + Tag)
export async function fetchRiotAccount(gameName: string, tagLine: string): Promise<RiotAccount | null> {
    if (!RIOT_API_KEY) return null;
    
    // URL Encode
    const encodedName = encodeURIComponent(gameName);
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${tagLine}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        if (!res.ok) {
            console.error(`Riot Account API Error: ${res.status}`);
            return null;
        }
        
        return await res.json();
    } catch (e) {
        console.error("fetchRiotAccount exception:", e);
        return null;
    }
}

// 2. Get Summoner by PUUID
export async function fetchSummonerByPuuid(puuid: string, noCache = false): Promise<SummonerDTO | null> {
    if (!RIOT_API_KEY) return null;
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?t=${Date.now()}`;
    
    try {
        console.log(`[RiotAPI] Fetching Summoner (Cache-Bust): ${url}`);
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            console.error(`[RiotAPI] Summoner Error: ${res.status} ${res.statusText}`);
            const body = await res.text();
            console.error(`[RiotAPI] Error Body: ${body}`);
            return null;
        }
        
        const data = await res.json();
        console.log(`[RiotAPI] Raw Keys: ${Object.keys(data).join(", ")}`);
        console.log(`[RiotAPI] Summoner Data: ${JSON.stringify(data)}`);

        if (!data.id) {
             console.error(`[RiotAPI] CRITICAL: Response missing 'id' field! Keys present: ${Object.keys(data)}`);
             data.id = data.puuid; // Hack: Try to use PUUID as ID
             data.name = data.name || "Summoner";
        }

        return data;
    } catch (e) {
        console.error("fetchSummonerByPuuid exception:", e);
        return null;
    }
}

// 3a. Get League Entries (Rank) by PUUID (Recommended - newer API)
export async function fetchRankByPuuid(puuid: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];

    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    console.log(`[RiotAPI] Fetching Rank by PUUID: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error(`[RiotAPI] League by PUUID Error: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();
        console.log(`[RiotAPI] Rank by PUUID Result: ${JSON.stringify(data)}`);
        return data;
    } catch (e) {
        console.error("[RiotAPI] fetchRankByPuuid exception:", e);
        return [];
    }
}

// 3b. Get League Entries (Rank) by SummonerID (Legacy - may not work if ID unavailable)
export async function fetchRank(summonerId: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];
    
    // Fallback logic verification
    // PUUID is long (78 chars), SummonerID is short (40-63 chars usually, but rarely 78).
    // The by-summoner endpoint STRICTLY requires Encrypted Summoner ID.
    // If we only have PUUID (because fetchSummoner failed to give ID), we CANNOT fetch rank.
    // if (summonerId.length > 60) {
    //    console.warn(`[RiotAPI] Cannot fetch rank with PUUID (length ${summonerId.length}). Returning Unranked.`);
    //    return [];
    // }
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    console.log(`[RiotAPI] Fetching Rank: ${url}`);
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            console.error(`League API Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
            console.warn(`[RiotAPI] fetchRank returned EMPTY for ID: ${summonerId}. URL: ${url}`);
        }
        return data;
    } catch (e) {
        console.error("fetchRank exception:", e);
        return [];
    }
}

// 4. Get Match IDs by PUUID
export async function fetchMatchIds(puuid: string, count: number = 20, queue?: number, type?: string, championId?: number, retries = 3): Promise<{ success: boolean, data?: string[], error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "Server Configuration Error: RIOT_API_KEY is missing" };
    
    // Ensure region is correct. JP1 -> asia
    let url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    
    if (queue) url += `&queue=${queue}`;
    if (type) url += `&type=${type}`;
    if (championId) url += `&champion=${championId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            console.log(`[RiotAPI] MatchIDs 429 Hit. Waiting ${retryAfter}s...`);
            await delay((retryAfter + 1) * 1000); // Wait +1s buffer
            return fetchMatchIds(puuid, count, queue, type, championId, retries - 1);
        }
        
        if (!res.ok) {
            const body = await res.text();
            console.error(`MatchIDs API Error (${res.status}) URL: ${url} Body: ${body}`);
            return { success: false, error: `Riot API Error (${res.status}): ${res.statusText}` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchIds exception:", e);
        return { success: false, error: e.message || "Unknown Network Error" };
    }
}

// 5. Get Match Details by MatchID
// Helper delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchMatchDetail(matchId: string, retries = 3): Promise<{ success: boolean, data?: any, error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            console.log(`[RiotAPI] 429 Hit. Waiting ${retryAfter}s...`);
            await delay((retryAfter + 1) * 1000); // Wait +1s buffer
            return fetchMatchDetail(matchId, retries - 1);
        }
        
        if (!res.ok) {
            console.error(`MatchDetail Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Detail Error (${res.status})` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchDetail exception:", e);
        return { success: false, error: e.message };
    }
}
// 6. Get Match Timeline by MatchID
export async function fetchMatchTimeline(matchId: string): Promise<{ success: boolean, data?: any, error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };
    
    // Timeline endpoint: /lol/match/v5/matches/{matchId}/timeline
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 86400 } // Cache for 24 hours (Immutable data)
        });
        
        if (!res.ok) {
            console.error(`MatchTimeline Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Timeline Error (${res.status})` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchTimeline exception:", e);
        return { success: false, error: e.message };
    }
}

// 7. Get Third Party Code by SummonerID
export async function fetchThirdPartyCode(summonerId: string): Promise<string | null> {
    if (!RIOT_API_KEY) return null;
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/platform/v4/third-party-code/by-summoner/${summonerId}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store' // Verification code changes, so no cache
        });
        
        if (!res.ok) {
            console.error(`ThirdPartyCode API Error: ${res.status}`);
            return null;
        }
        
        // The API returns the code string directly in quotes, e.g. "LCA-1234"
        const code = await res.json();
        return code;
    } catch (e) {
        console.error("fetchThirdPartyCode exception:", e);
        return null;
    }
}

// 8. Get Latest Version
export async function fetchLatestVersion(): Promise<string> {
    try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: 'no-store' });
        if (!res.ok) return "14.24.1"; // Fallback
        const versions = await res.json();
        return versions[0] || "14.24.1";
    } catch (e) {
        console.error("fetchLatestVersion error:", e);
        return "14.24.1";
    }
}

// NEW: Champion Characteristics Loader
export type ChampionAttributes = {
    identity: string;
    powerSpike: string;
    waveClear: string;
    mobility: string;
    class: string;
    lanes: string[];
    damageType: string;
    notes?: string;
};

import fs from 'fs/promises';
import path from 'path';

export async function getChampionAttributes(championName: string): Promise<ChampionAttributes | null> {
    try {
        const filePath = path.join(process.cwd(), 'src/data/champion_attributes.json');

        // Cache or Read file
        // For simplicity in Server Action, we read each time (it's fast enough or Vercel cached)
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        return data[championName] || null;
    } catch (e) {
        console.warn(`Failed to load champion attributes for ${championName}:`, e);
        return null;
    }
}

// 9. Macro Knowledge Types and Loader
export type MacroKnowledge = {
    meta?: Record<string, any>;
    fundamental_concepts?: Record<string, any>;
    season_16_changes?: Record<string, any>;
    objective_response: Record<string, any>;
    game_state_strategy: Record<string, any>;
    time_phase_priorities: Record<string, any>;
    common_macro_mistakes: Record<string, any>;
};

let _macroKnowledgeCache: MacroKnowledge | null = null;

export async function getMacroKnowledge(): Promise<MacroKnowledge | null> {
    if (_macroKnowledgeCache) return _macroKnowledgeCache;

    try {
        const filePath = path.join(process.cwd(), 'src/data/macro_knowledge.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        _macroKnowledgeCache = JSON.parse(fileContent);
        return _macroKnowledgeCache;
    } catch (e) {
        console.warn('Failed to load macro knowledge:', e);
        return null;
    }
}

/**
 * Get relevant macro advice based on game state
 */
// Enhanced context for macro advice generation
export type MacroAdviceContext = {
    goldDiff: number;
    gameTimeMs: number;
    userRole?: string;
    events?: TruthEvent[];
    focusMode?: 'LANING' | 'MACRO' | 'TEAMFIGHT';
    deathCount?: number;
    csDiff?: number;
    enemyObjectivesTaken?: string[];
};

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

export async function getEnhancedMacroAdvice(
    context: MacroAdviceContext,
    objectiveType?: string,
    isAllyObjective?: boolean
): Promise<string> {
    try {
        const knowledge = await getMacroKnowledge();
        if (!knowledge) {
            console.warn("[getEnhancedMacroAdvice] Failed to load macro knowledge");
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
        console.error("[getEnhancedMacroAdvice] Error:", error);
        return "";
    }
}

// 10r. Get Runes Reforged (for public rune guide)
export async function fetchRunesReforged(language: 'ja' | 'en' | 'ko' = 'ja') {
    const localeMap: Record<string, string> = { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR' };
    const locale = localeMap[language] || 'ja_JP';
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/runesReforged.json`;
    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        return { version, runes: await res.json() as any[] };
    } catch (e) {
        console.error("fetchRunesReforged error:", e);
        return null;
    }
}

// 10a. Get All Champions (for public champion DB)
export async function fetchAllChampions(language: 'ja' | 'en' | 'ko' = 'ja') {
    const localeMap: Record<string, string> = { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR' };
    const locale = localeMap[language] || 'ja_JP';
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion.json`;
    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        const data = await res.json();
        return { version, champions: Object.values(data.data) as any[] };
    } catch (e) {
        console.error("fetchAllChampions error:", e);
        return null;
    }
}

// 10. Get DDragon Item Data (Cached per language)
const _itemCacheByLang: Record<string, Record<string, any>> = {};
const _itemNameCacheByLang: Record<string, Record<string, string>> = {}; // Name -> ID

export async function fetchDDItemData(language: 'ja' | 'en' | 'ko' = 'ja'): Promise<{ idMap: Record<string, any>, nameMap: Record<string, string> } | null> {
    // Map language code to Data Dragon locale
    const localeMap: Record<string, string> = {
        'ja': 'ja_JP',
        'en': 'en_US',
        'ko': 'ko_KR'
    };
    const locale = localeMap[language] || 'ja_JP';

    if (_itemCacheByLang[locale] && _itemNameCacheByLang[locale]) {
        return { idMap: _itemCacheByLang[locale], nameMap: _itemNameCacheByLang[locale] };
    }

    // Fetch latest version dynamically
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/item.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const data = await res.json();
        _itemCacheByLang[locale] = data.data;

        _itemNameCacheByLang[locale] = {};
        // Build Name -> ID Map (Normalize names to lower case for loose matching)
        for (const [id, item] of Object.entries(data.data as Record<string, any>)) {
            _itemNameCacheByLang[locale][item.name.toLowerCase()] = id;
            // Also map colloquials if we want later
        }

        return { idMap: _itemCacheByLang[locale]!, nameMap: _itemNameCacheByLang[locale]! };
    } catch (e) {
        console.error("fetchDDItemData error:", e);
        return null;
    }
}

// 10b. Get DDragon Champion Detail (Stats + Spells) for Damage Calculator
const _championDetailCache: Record<string, any> = {};

export async function fetchChampionDetail(championName: string, language: 'ja' | 'en' | 'ko' = 'ja'): Promise<any | null> {
    const localeMap: Record<string, string> = {
        'ja': 'ja_JP',
        'en': 'en_US',
        'ko': 'ko_KR'
    };
    const locale = localeMap[language] || 'ja_JP';
    const cacheKey = `${championName}_${locale}`;

    if (_championDetailCache[cacheKey]) {
        return _championDetailCache[cacheKey];
    }

    const version = await fetchLatestVersion();
    // Fix known DDragon naming inconsistencies
    const nameMap: Record<string, string> = {
        "FiddleSticks": "Fiddlesticks",
    };
    const cName = nameMap[championName] || championName;
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${cName}.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const data = await res.json();
        const detail = data.data?.[cName] || null;
        if (detail) {
            _championDetailCache[cacheKey] = detail;
        }
        return detail;
    } catch (e) {
        console.error("fetchChampionDetail error:", e);
        return null;
    }
}

// 10c. Get CommunityDragon bin.json for champion spell data
const _championBinCache: Record<string, Record<string, any>> = {};

export async function fetchChampionBinData(championName: string): Promise<Record<string, any> | null> {
    const champLower = championName.toLowerCase();
    if (_championBinCache[champLower]) {
        return _championBinCache[champLower];
    }

    const url = `https://raw.communitydragon.org/latest/game/data/characters/${champLower}/${champLower}.bin.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) {
            console.error(`fetchChampionBinData error: ${res.status} for ${championName}`);
            return null;
        }

        const data = await res.json();
        _championBinCache[champLower] = data;
        return data;
    } catch (e) {
        console.error("fetchChampionBinData error:", e);
        return null;
    }
}

// 10. Extract Truth Events from Timeline (Fact Injection)
export type TruthEvent = {
    timestamp: number;
    timestampStr: string;
    type: 'KILL' | 'DEATH' | 'OBJECTIVE' | 'TURRET' | 'WARD' | 'ITEM' | 'LEVEL' | 'SPELL' | 'OTHER';
    detail: string;
    position: { x: number, y: number };
    participants: number[]; // IDs of involved players
    // Enhanced context for richer analysis
    context?: {
        goldDiff?: number;       // Gold difference at this moment (user vs opponent)
        levelDiff?: number;      // Level difference
        csDiff?: number;         // CS difference
        assistCount?: number;    // Number of assists (for kills)
        isFirstBlood?: boolean;
        killType?: 'SOLO' | 'LANE_2V2' | 'GANK' | 'ROAM' | 'TEAMFIGHT' | 'UNKNOWN';  // Role-aware classification
        involvedRoles?: string[];  // Roles of participants (e.g., ["BOTTOM", "UTILITY", "JUNGLE"])
        isAllyObjective?: boolean;  // true = YOUR team got it, false = ENEMY team got it
        objectiveType?: string;     // DRAGON, BARON, RIFT_HERALD, HORDE, etc.
        wardType?: string;       // YELLOW_TRINKET, CONTROL_WARD, etc.
        itemId?: number;
        itemName?: string;
        spellSlot?: number;      // 1=D, 2=F (summoner spells)
    };
};

// 11. Frame Statistics (Gold/CS/Level over time)
export type FrameStats = {
    timestamp: number;
    timestampStr: string;
    user: {
        currentGold: number;
        totalGold: number;
        level: number;
        cs: number;
        jungleCs: number;
        position: { x: number, y: number };
    };
    opponent?: {
        totalGold: number;
        level: number;
        cs: number;
        jungleCs: number;
        position: { x: number, y: number };
    };
    goldDiff: number;    // user - opponent
    csDiff: number;      // user - opponent
    levelDiff: number;   // user - opponent
};

// 12. Participant Role Mapping
export type ParticipantRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | 'UNKNOWN';

export type ParticipantRoleMap = {
    [participantId: number]: {
        role: ParticipantRole;
        championName: string;
        teamId: number;  // 100 = Blue, 200 = Red
    };
};

/**
 * Build a mapping of participantId -> role/champion/team
 * This allows us to determine WHO participated in each event
 */
export async function buildParticipantRoleMap(matchData: any): Promise<ParticipantRoleMap> {
    const roleMap: ParticipantRoleMap = {};

    if (!matchData?.info?.participants) return roleMap;

    matchData.info.participants.forEach((p: any, index: number) => {
        const participantId = index + 1; // 1-10

        // teamPosition: "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", or ""
        let role: ParticipantRole = 'UNKNOWN';
        const pos = p.teamPosition?.toUpperCase() || '';

        if (pos === 'TOP') role = 'TOP';
        else if (pos === 'JUNGLE') role = 'JUNGLE';
        else if (pos === 'MIDDLE' || pos === 'MID') role = 'MIDDLE';
        else if (pos === 'BOTTOM' || pos === 'ADC' || pos === 'CARRY') role = 'BOTTOM';
        else if (pos === 'UTILITY' || pos === 'SUPPORT' || pos === 'SUP') role = 'UTILITY';

        roleMap[participantId] = {
            role,
            championName: p.championName || 'Unknown',
            teamId: p.teamId || (participantId <= 5 ? 100 : 200)
        };
    });

    return roleMap;
}

/**
 * Determine the type of kill based on participants and their roles
 * (Internal helper - not exported as Server Action)
 */
function determineKillType(
    killerPid: number,
    victimPid: number,
    assisterPids: number[],
    roleMap: ParticipantRoleMap,
    userPid: number
): 'SOLO' | 'LANE_2V2' | 'GANK' | 'ROAM' | 'TEAMFIGHT' | 'UNKNOWN' {
    const allParticipants = [killerPid, victimPid, ...assisterPids];
    const uniqueParticipants = [...new Set(allParticipants.filter(p => p > 0))];
    const totalCount = uniqueParticipants.length;

    // Get user's role and team
    const userInfo = roleMap[userPid];
    if (!userInfo) return 'UNKNOWN';

    const userRole = userInfo.role;
    const userTeam = userInfo.teamId;

    // Collect roles of all participants
    const participantRoles = uniqueParticipants.map(pid => ({
        pid,
        ...roleMap[pid]
    }));

    // Separate by team
    const allies = participantRoles.filter(p => p.teamId === userTeam);
    const enemies = participantRoles.filter(p => p.teamId !== userTeam);

    // 1. Solo Kill: 1v1, no assists
    if (totalCount === 2 && assisterPids.length === 0) {
        return 'SOLO';
    }

    // 2. Teamfight: 5+ participants
    if (totalCount >= 5) {
        return 'TEAMFIGHT';
    }

    // 3. Check if JUNGLE is involved (from either team, not being the user)
    const junglerInvolved = participantRoles.some(p =>
        p.role === 'JUNGLE' && p.pid !== userPid
    );

    if (junglerInvolved) {
        return 'GANK';
    }

    // 4. Check for roam (MID or TOP from enemy team joining a non-mid/top fight)
    const isUserBotLane = userRole === 'BOTTOM' || userRole === 'UTILITY';
    const roamerInvolved = enemies.some(p =>
        (p.role === 'MIDDLE' || p.role === 'TOP') &&
        isUserBotLane
    );

    if (roamerInvolved) {
        return 'ROAM';
    }

    // 5. Lane 2v2 (BOT + SUP vs BOT + SUP)
    if (isUserBotLane) {
        const allyRoles = allies.map(a => a.role);
        const enemyRoles = enemies.map(e => e.role);

        const isAllyBotLane = allyRoles.every(r => r === 'BOTTOM' || r === 'UTILITY');
        const isEnemyBotLane = enemyRoles.every(r => r === 'BOTTOM' || r === 'UTILITY');

        if (isAllyBotLane && isEnemyBotLane && totalCount <= 4) {
            return 'LANE_2V2';
        }
    }

    // 6. For other lanes, check if only lane opponents are involved
    const userLaneOpponentRole = userRole; // Same role = lane opponent
    const onlyLaneOpponents = enemies.every(e => e.role === userLaneOpponentRole);

    if (onlyLaneOpponents && totalCount <= 3) {
        return 'SOLO'; // Could be a 1v1 with assist from minions counted oddly, or just lane fight
    }

    // Default: If we can't determine, check participant count
    if (totalCount === 3) {
        return 'GANK'; // 3 people, likely a gank if we couldn't determine otherwise
    }

    return 'UNKNOWN';
}

export async function extractMatchEvents(
    timeline: any,
    puuid: string,
    range?: { startMs: number, endMs: number },
    opponentPid?: number,  // Optional: opponent's participant ID for context
    roleMap?: ParticipantRoleMap,  // NEW: Role mapping for accurate kill type detection
    language: 'ja' | 'en' | 'ko' = 'en'  // Language for event descriptions
): Promise<TruthEvent[]> {
    if (!timeline || !timeline.info || !timeline.info.frames) return [];

    // Translation templates for event details
    const eventTexts = {
        ja: {
            youKilled: (victim: string) => `あなたが${victim}をキル`,
            assists: (count: number) => `(+${count}アシスト)`,
            killedBy: (victim: string, killer: string) => `${victim}が${killer}にキルされた`,
            allySecured: (type: string, subType?: string) => `[味方獲得] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[敵獲得] ${type}${subType ? ` (${subType})` : ''} - なぜ取られたか分析`,
            allyDestroyed: (structure: string) => `[味方破壊] ${structure}`,
            enemyDestroyed: (structure: string) => `[敵破壊] ${structure} - なぜ破壊されたか分析`,
            wardPlaced: (wardType: string) => `ワード設置: ${wardType}`,
            wardDestroyed: 'ワード破壊',
            itemPurchased: (itemName: string) => `アイテム購入: ${itemName}`,
            levelUp: (level: number) => `レベル${level}に到達`,
            skillLevelUp: (slot: number) => `スキル${slot}をレベルアップ`,
            turret: 'タワー',
            player: 'プレイヤー'
        },
        en: {
            youKilled: (victim: string) => `YOU killed ${victim}`,
            assists: (count: number) => `(+${count} assists)`,
            killedBy: (victim: string, killer: string) => `${victim} killed by ${killer}`,
            allySecured: (type: string, subType?: string) => `[ALLY SECURED] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[ENEMY TOOK] ${type}${subType ? ` (${subType})` : ''} - Analyze: Why did YOUR team lose this objective?`,
            allyDestroyed: (structure: string) => `[ALLY DESTROYED] ${structure}`,
            enemyDestroyed: (structure: string) => `[ENEMY DESTROYED] Your ${structure} - Analyze: Why was this tower lost?`,
            wardPlaced: (wardType: string) => `Ward placed: ${wardType}`,
            wardDestroyed: 'Ward destroyed',
            itemPurchased: (itemName: string) => `Item purchased: ${itemName}`,
            levelUp: (level: number) => `Reached level ${level}`,
            skillLevelUp: (slot: number) => `Leveled up skill ${slot}`,
            turret: 'Turret',
            player: 'Player'
        },
        ko: {
            youKilled: (victim: string) => `당신이 ${victim}을(를) 처치`,
            assists: (count: number) => `(+${count} 어시스트)`,
            killedBy: (victim: string, killer: string) => `${victim}이(가) ${killer}에게 처치됨`,
            allySecured: (type: string, subType?: string) => `[아군 획득] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[적 획득] ${type}${subType ? ` (${subType})` : ''} - 왜 빼앗겼는지 분석`,
            allyDestroyed: (structure: string) => `[아군 파괴] ${structure}`,
            enemyDestroyed: (structure: string) => `[적 파괴] ${structure} - 왜 파괴되었는지 분석`,
            wardPlaced: (wardType: string) => `와드 설치: ${wardType}`,
            wardDestroyed: '와드 파괴됨',
            itemPurchased: (itemName: string) => `아이템 구매: ${itemName}`,
            levelUp: (level: number) => `레벨 ${level} 도달`,
            skillLevelUp: (slot: number) => `스킬 ${slot} 레벨업`,
            turret: '타워',
            player: '플레이어'
        }
    };
    const txt = eventTexts[language];

    const frames = timeline.info.frames;
    const extracted: TruthEvent[] = [];

    // Find Participant ID for PUUID
    let myPid = 0;
    if (timeline.info.participants) {
        const p = timeline.info.participants.find((p: any) => p.puuid === puuid);
        if (p) myPid = p.participantId;
    }

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper: Get frame stats at a given timestamp
    const getFrameStatsAt = (timestamp: number) => {
        let closestFrame = frames[0];
        for (const frame of frames) {
            if (frame.timestamp <= timestamp) {
                closestFrame = frame;
            } else {
                break;
            }
        }

        if (!closestFrame?.participantFrames) return null;

        const myFrame = closestFrame.participantFrames[myPid.toString()];
        const oppFrame = opponentPid ? closestFrame.participantFrames[opponentPid.toString()] : null;

        if (!myFrame) return null;

        return {
            myGold: myFrame.totalGold || 0,
            myLevel: myFrame.level || 1,
            myCs: (myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0),
            oppGold: oppFrame?.totalGold || 0,
            oppLevel: oppFrame?.level || 1,
            oppCs: (oppFrame?.minionsKilled || 0) + (oppFrame?.jungleMinionsKilled || 0),
            goldDiff: (myFrame.totalGold || 0) - (oppFrame?.totalGold || 0),
            levelDiff: (myFrame.level || 1) - (oppFrame?.level || 1),
            csDiff: ((myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0)) -
                    ((oppFrame?.minionsKilled || 0) + (oppFrame?.jungleMinionsKilled || 0))
        };
    };

    // Helper: Get involved roles for an event
    const getInvolvedRoles = (participantIds: number[]): string[] => {
        if (!roleMap) return [];
        return participantIds
            .filter(pid => pid > 0 && roleMap[pid])
            .map(pid => `${roleMap[pid].role}(${roleMap[pid].championName})`);
    };

    // Track first blood
    let firstBloodOccurred = false;

    frames.forEach((frame: any) => {
        // Time Filter
        if (range) {
            if (frame.timestamp < range.startMs - 60000) return;
            if (frame.timestamp > range.endMs + 60000) return;
        }

        frame.events.forEach((e: any) => {
            // Strict Time Check
            if (range) {
                if (e.timestamp < range.startMs || e.timestamp > range.endMs) return;
            }

            let eventObj: TruthEvent | null = null;
            const frameStats = getFrameStatsAt(e.timestamp);

            // === CHAMPION_KILL ===
            if (e.type === 'CHAMPION_KILL') {
                const killer = e.killerId;
                const victim = e.victimId;
                const assisters = e.assistingParticipantIds || [];
                const isFirstBlood = !firstBloodOccurred;
                if (isFirstBlood) firstBloodOccurred = true;

                // Determine kill type using role-aware logic
                const killType = roleMap
                    ? determineKillType(killer, victim, assisters, roleMap, myPid)
                    : (assisters.length === 0 ? 'SOLO' : assisters.length + 2 >= 5 ? 'TEAMFIGHT' : 'UNKNOWN');

                // Get involved roles for detailed context
                const allParticipants = [killer, victim, ...assisters];
                const involvedRoles = getInvolvedRoles(allParticipants);

                // Determine if this is USER's kill or death
                const isUserDeath = victim === myPid;
                const isUserKill = killer === myPid;

                // Build detailed context string with role information
                let ctx = "";
                const killerInfo = roleMap?.[killer];
                const victimInfo = roleMap?.[victim];

                if (isUserDeath) {
                    const killerDesc = killerInfo
                        ? `${killerInfo.championName}(${killerInfo.role})`
                        : `Player ${killer}`;
                    ctx = `YOU died to ${killerDesc}`;
                    if (assisters.length > 0) {
                        const assisterRoles = assisters
                            .map((aid: number) => roleMap?.[aid]?.role || 'UNKNOWN')
                            .join(', ');
                        ctx += ` (+${assisters.length} assists: ${assisterRoles})`;
                    }
                    // Add kill type explanation
                    const killTypeExplanation: Record<string, string> = {
                        'SOLO': '1v1',
                        'LANE_2V2': 'Lane Fight (2v2)',
                        'GANK': 'Jungle Gank',
                        'ROAM': 'Roam',
                        'TEAMFIGHT': 'Teamfight',
                        'UNKNOWN': ''
                    };
                    if (killTypeExplanation[killType]) {
                        ctx += ` [${killTypeExplanation[killType]}]`;
                    }
                } else if (isUserKill) {
                    const victimDesc = victimInfo
                        ? `${victimInfo.championName}(${victimInfo.role})`
                        : `${txt.player} ${victim}`;
                    ctx = txt.youKilled(victimDesc);
                    if (assisters.length > 0) ctx += ` ${txt.assists(assisters.length)}`;
                    ctx += ` [${killType}]`;
                } else {
                    ctx = txt.killedBy(`${txt.player} ${victim}`, `${txt.player} ${killer}`);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: isUserDeath ? 'DEATH' : 'KILL',
                    detail: ctx,
                    position: e.position || { x: 0, y: 0 },
                    participants: allParticipants,
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        levelDiff: frameStats?.levelDiff,
                        csDiff: frameStats?.csDiff,
                        assistCount: assisters.length,
                        isFirstBlood,
                        killType,
                        involvedRoles
                    }
                };
            }
            // === ELITE_MONSTER_KILL (Dragon, Baron, Herald, Grubs) ===
            else if (e.type === 'ELITE_MONSTER_KILL') {
                const monsterType = e.monsterType || 'UNKNOWN';
                const monsterSubType = e.monsterSubType || '';
                const killerTeam = e.killerTeamId;
                const myTeam = myPid <= 5 ? 100 : 200;
                const isAllyObjective = killerTeam === myTeam;

                // Create clear, unambiguous detail (translated)
                let detail = "";
                if (isAllyObjective) {
                    detail = txt.allySecured(monsterType, monsterSubType || undefined);
                } else {
                    detail = txt.enemyTook(monsterType, monsterSubType || undefined);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'OBJECTIVE',
                    detail,
                    position: e.position || { x: 0, y: 0 },
                    participants: [e.killerId],
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        isAllyObjective,
                        objectiveType: monsterType
                    }
                };
            }
            // === BUILDING_KILL (Turret, Inhibitor) ===
            else if (e.type === 'BUILDING_KILL') {
                const buildingType = e.buildingType || txt.turret;
                const laneType = e.laneType || '';
                const towerType = e.towerType || '';
                const killerTeam = e.teamId === 100 ? 200 : 100; // Building's team is opposite of destroyer
                const myTeam = myPid <= 5 ? 100 : 200;
                const isAllyObjective = killerTeam !== myTeam; // true = YOUR team destroyed enemy tower

                // Create clear, unambiguous detail (translated)
                let detail = "";
                const structureName = `${laneType} ${towerType || buildingType}`.trim();
                if (isAllyObjective) {
                    detail = txt.allyDestroyed(structureName);
                } else {
                    detail = txt.enemyDestroyed(structureName);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'TURRET',
                    detail,
                    position: e.position || { x: 0, y: 0 },
                    participants: e.killerId ? [e.killerId] : [],
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        isAllyObjective,
                        objectiveType: buildingType
                    }
                };
            }
            // === WARD_PLACED ===
            else if (e.type === 'WARD_PLACED' && e.creatorId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'WARD',
                    detail: txt.wardPlaced(e.wardType || 'WARD'),
                    position: { x: 0, y: 0 }, // Ward position not in event
                    participants: [myPid],
                    context: {
                        wardType: e.wardType
                    }
                };
            }
            // === WARD_KILL ===
            else if (e.type === 'WARD_KILL' && e.killerId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'WARD',
                    detail: txt.wardDestroyed,
                    position: e.position || { x: 0, y: 0 },
                    participants: [myPid],
                    context: {
                        wardType: e.wardType
                    }
                };
            }
            // === ITEM_PURCHASED (Important items only) ===
            else if (e.type === 'ITEM_PURCHASED' && e.participantId === myPid) {
                // Only track significant items (cost > 1000 gold or completed items)
                // We'll filter by ID ranges or specific IDs if needed
                const itemId = e.itemId;
                // Skip consumables and small items (rough filter)
                if (itemId > 3000 || [3340, 3363, 3364, 2055].includes(itemId)) {
                    eventObj = {
                        timestamp: e.timestamp,
                        timestampStr: formatTime(e.timestamp),
                        type: 'ITEM',
                        detail: txt.itemPurchased(`#${itemId}`),
                        position: { x: 0, y: 0 },
                        participants: [myPid],
                        context: {
                            itemId,
                            goldDiff: frameStats?.goldDiff
                        }
                    };
                }
            }
            // === LEVEL_UP ===
            else if (e.type === 'LEVEL_UP' && e.participantId === myPid) {
                // Only track important levels (6, 11, 16 for ult upgrades)
                if ([6, 11, 16].includes(e.level)) {
                    eventObj = {
                        timestamp: e.timestamp,
                        timestampStr: formatTime(e.timestamp),
                        type: 'LEVEL',
                        detail: txt.levelUp(e.level),
                        position: { x: 0, y: 0 },
                        participants: [myPid],
                        context: {
                            levelDiff: frameStats?.levelDiff
                        }
                    };
                }
            }
            // === CHAMPION_SPECIAL_KILL (Multi-kills, etc.) ===
            else if (e.type === 'CHAMPION_SPECIAL_KILL' && e.killerId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'KILL',
                    detail: `YOU achieved ${e.killType || 'SPECIAL_KILL'}`,
                    position: e.position || { x: 0, y: 0 },
                    participants: [myPid]
                };
            }

            if (eventObj) extracted.push(eventObj);
        });
    });

    return extracted;
}

// 12. Extract Frame Statistics (Gold/CS/Level over time)
export async function extractFrameStats(
    timeline: any,
    puuid: string,
    opponentPid?: number
): Promise<FrameStats[]> {
    if (!timeline || !timeline.info || !timeline.info.frames) return [];

    const frames = timeline.info.frames;
    const stats: FrameStats[] = [];

    // Find Participant ID for PUUID
    let myPid = 0;
    if (timeline.info.participants) {
        const p = timeline.info.participants.find((p: any) => p.puuid === puuid);
        if (p) myPid = p.participantId;
    }

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    frames.forEach((frame: any) => {
        if (!frame.participantFrames) return;

        const myFrame = frame.participantFrames[myPid.toString()];
        if (!myFrame) return;

        const oppFrame = opponentPid ? frame.participantFrames[opponentPid.toString()] : null;

        const myCs = (myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0);
        const oppCs = oppFrame ? (oppFrame.minionsKilled || 0) + (oppFrame.jungleMinionsKilled || 0) : 0;

        stats.push({
            timestamp: frame.timestamp,
            timestampStr: formatTime(frame.timestamp),
            user: {
                totalGold: myFrame.totalGold || 0,
                currentGold: myFrame.currentGold || 0,
                level: myFrame.level || 1,
                cs: myFrame.minionsKilled || 0,
                jungleCs: myFrame.jungleMinionsKilled || 0,
                position: myFrame.position || { x: 0, y: 0 }
            },
            opponent: oppFrame ? {
                totalGold: oppFrame.totalGold || 0,
                level: oppFrame.level || 1,
                cs: oppFrame.minionsKilled || 0,
                jungleCs: oppFrame.jungleMinionsKilled || 0,
                position: oppFrame.position || { x: 0, y: 0 }
            } : undefined,
            goldDiff: (myFrame.totalGold || 0) - (oppFrame?.totalGold || 0),
            csDiff: myCs - oppCs,
            levelDiff: (myFrame.level || 1) - (oppFrame?.level || 1)
        });
    });

    return stats;
}
