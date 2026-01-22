'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData, fetchRank, fetchLatestVersion, extractMatchEvents, getChampionAttributes, ChampionAttributes } from "./riot";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisMode, getPersonaPrompt } from './promptUtils';

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export type MatchSummary = {
    matchId: string;
    championName: string;
    win: boolean;
    kda: string;
    timestamp: number;
    queueId: number;
};

export async function getCoachMatches(puuid: string): Promise<MatchSummary[]> {
    const supabase = await createClient();
    
    // 1. Get Match IDs from Summoner Account
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('recent_match_ids')
        .eq('puuid', puuid)
        .single();
        
    if (!account?.recent_match_ids) return [];
    
    const matchIds = account.recent_match_ids as string[];
    if (matchIds.length === 0) return [];

    // 2. Fetch Match Details from Cache
    const { data: matchesData } = await supabase
        .from('match_cache')
        .select('data, match_id')
        .in('match_id', matchIds);

    if (!matchesData) return [];

    // 3. Process matches
    const summaries = matchesData.map(m => {
        const info = m.data.info;
        const participant = info.participants.find((p: any) => p.puuid === puuid);
        if (!participant) return null;
        
        return {
             matchId: m.match_id,
             championName: participant.championName,
             win: participant.win,
             kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
             timestamp: info.gameStartTimestamp,
             queueId: info.queueId
        };
    }).filter((s): s is MatchSummary => s !== null);
    
    return summaries.sort((a, b) => b.timestamp - a.timestamp);
}

export type CoachingInsight = {
    timestamp: number; // in milliseconds
    timestampStr: string; // e.g. "15:20"
    title: string;
    description: string;
    type: 'MISTAKE' | 'TURNING_POINT' | 'GOOD_PLAY' | 'INFO';
    advice: string;
};

export type BuildItem = {
    id: number; // Item ID for Icon
    itemName: string;
    reason?: string; // Reason for recommendation or critique
};

export type BuildComparison = {
    userItems: BuildItem[];
    opponentItems?: BuildItem[];
    opponentChampionName?: string;
    recommendedItems: BuildItem[];
    analysis: string; // "Why X is better than Y"
};


export type SummaryAnalysis = {
    rootCause: string; // 根本原因
    priorityFocus: "REDUCE_DEATHS" | "OBJECTIVE_CONTROL" | "WAVE_MANAGEMENT" | "VISION_CONTROL" | "TRADING" | "POSITIONING";
    actionPlan: string[]; // 優先順位付きアクションプラン
    message: string; // 総括メッセージ
};
export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildComparison;
    summaryAnalysis?: SummaryAnalysis; // 総括分析
};

// Fallback sequence: Stable 2.0 -> New 2.5 -> Legacy Standard
const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];

export type AnalysisFocus = {
    focusArea: string; // e.g., "LANING", "TEAMFIGHT", "MACRO", "BUILD", "VISION" or "LANING_PHASE"
    focusTime?: string; // e.g., "12:30"
    specificQuestion?: string;
    mode?: 'LANING' | 'MACRO' | 'TEAMFIGHT'; // New dynamic mode
};

export async function analyzeMatchTimeline(
    matchId: string, 
    puuid: string, 
    userApiKey?: string,
    focus?: AnalysisFocus,
    locale: string = "ja" 
): Promise<{ success: boolean, data?: AnalysisResult, error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { success: false, error: "Not authenticated" };

    // --- Logic for Limits & Keys (Shared with analyzeVideo/analyzeMatch) ---
    const { getAnalysisStatus } = await import("./analysis");
    const status = await getAnalysisStatus();
    if (!status) return { success: false, error: "User profile not found." };

    console.log("DEBUG_AI_COACH_LIMITS:", { 
        userId: user.id, 
        isPremium: status.is_premium, 
        credits: status.analysis_credits, 
        hasUserKey: !!userApiKey,
        focus: focus
    });

    let useEnvKey = false;
    let shouldIncrementCount = false;

    if (status.is_premium) {
        // 1. Premium User
        const today = new Date().toISOString().split('T')[0];
        const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
        let currentCount = status.daily_analysis_count;
        if (lastDate !== today) currentCount = 0;

        if (currentCount >= 50) return { success: false, error: "Daily limit reached (50/50). Try again tomorrow." };
        
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        // 2. Free User
        if (userApiKey) {
            useEnvKey = false; // Use provided key
        } else {
            // Fallback: Check for legacy credits or deny
            if (status.analysis_credits > 0) {
                useEnvKey = true;
                // Will decrement later
            } else {
                return { success: false, error: "Upgrade required. Please upgrade to Premium or enter your API Key." };
            }
        }
    }

    const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;

    if (!apiKeyToUse) {
        return { success: false, error: "API Key Not Found" };
    }
    
    // --- End Limit Logic ---

    try {
        // 1. Fetch Data
        const [timelineRes, matchRes, ddItemRes, latestVersion] = await Promise.all([
            fetchMatchTimeline(matchId),
            fetchMatchDetail(matchId),
            fetchDDItemData(),
            fetchLatestVersion()
        ]);

        if (!timelineRes.success || !timelineRes.data) return { success: false, error: "Failed to fetch timeline" };
        if (!matchRes.success || !matchRes.data) return { success: false, error: "Failed to fetch match details" };

        const timeline = timelineRes.data;
        const match = matchRes.data;
        const itemMap = ddItemRes?.nameMap || {};
        const idMap = ddItemRes?.idMap || {};

        // 2. Build Match Context
        const context = getMatchContext(match, puuid);
        if (!context) return { success: false, error: "Participant analysis failed" };

        const { userPart, opponentPart } = context;

        // --- NEW: Fetch Rank for Persona ---
        let rankTier = "UNRANKED";
        try {
            const ranks = await fetchRank(userPart.summonerId);
            const soloDuo = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");
            if (soloDuo) rankTier = soloDuo.tier; // e.g., "GOLD", "DIAMOND"
        } catch (e) {
            console.warn("Rank fetch failed, using UNRANKED", e);
        }

        // 3. Extract User's Actual Build (End Game Items)
        const userItemIds = [
            userPart.item0, userPart.item1, userPart.item2, 
            userPart.item3, userPart.item4, userPart.item5
        ].filter(id => id > 0);

        const userItems: BuildItem[] = userItemIds.map(id => ({
            id,
            itemName: idMap[id]?.name || `Item ${id}`
        }));

        // Extract Opponent's Items if available
        let opponentItemsStr = "不明";
        let opponentItems: BuildItem[] = []; // NEW
        
        if (opponentPart) {
            const oppItemIds = [
                opponentPart.item0, opponentPart.item1, opponentPart.item2,
                opponentPart.item3, opponentPart.item4, opponentPart.item5
            ].filter(id => id > 0);
            
            const oppItems = oppItemIds.map(id => idMap[id]?.name || `Item ${id}`);
            if (oppItems.length > 0) opponentItemsStr = oppItems.join(', ');
            
            // Structured Object for Frontend
            opponentItems = oppItemIds.map(id => ({
                id,
                itemName: idMap[id]?.name || `Item ${id}`
            }));
        }

        // 4. Summarize Timeline (Truth Injection)
        // Extract events with mode-based time filtering for reduced hallucination
        let timeRange: { startMs: number, endMs: number } | undefined;
        if (focus?.mode === 'LANING') {
            timeRange = { startMs: 0, endMs: 900000 }; // 0-15 min
        } else if (focus?.mode === 'TEAMFIGHT') {
            timeRange = { startMs: 900000, endMs: 3600000 }; // 15min+
        }
        // For MACRO mode, no filter (full game analysis)
        
        const rawEvents = await extractMatchEvents(timeline, puuid, timeRange);
        
        // Priority sorting: OBJECTIVE > TURRET > KILL (Macro focus)
        const priorityOrder: Record<string, number> = { 'OBJECTIVE': 1, 'TURRET': 2, 'KILL': 3 };
        const sortedEvents = rawEvents.sort((a, b) => {
            const aPriority = priorityOrder[a.type] || 99;
            const bPriority = priorityOrder[b.type] || 99;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return a.timestamp - b.timestamp;
        });
        
        // Limit to 40 events to avoid token overflow while keeping quality
        const events = sortedEvents.slice(0, 40);

        // 5. Fetch Champion Attributes
        const champAttrs = await getChampionAttributes(userPart.championName);

        // 6. Prompt Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        
        // Use the new versatile prompt generator
        const systemPrompt = generateSystemPrompt(
            rankTier, 
            userItems, 
            opponentItemsStr, 
            events, 
            userPart, 
            opponentPart,
            champAttrs, // Pass attributes 
            focus,
            latestVersion,
            locale
        );

        let responseText = "";
        let usedModel = "";
        let analysisResult: any = null;

        // 6. Generate AI Content with Retries
        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`Trying Gemini Model: ${modelName}`);
                const genAI = new GoogleGenerativeAI(apiKeyToUse);
                
                // Note: JSON Schema constraint removed due to SDK type compatibility.
                // Using prompt-based instruction for output format instead.
                const model = genAI.getGenerativeModel({ 
                    model: modelName, 
                    generationConfig: { 
                        responseMimeType: "application/json"
                    } 
                });

                const result = await model.generateContent(systemPrompt);
                const response = await result.response;
                responseText = response.text();

                if (responseText) {
                    usedModel = modelName;
                    analysisResult = JSON.parse(responseText);
                    console.log(`Success with model: ${modelName}`);
                    break; // Success!
                }
            } catch (modelError: any) {
                console.error(`Gemini Model Error (${modelName}):`, modelError?.message || modelError);
                // Continue to next model
            }
        }

        if (!responseText || !analysisResult) {
            console.error("All Gemini models failed. API Key valid?", !!apiKeyToUse);
            return { success: false, error: "AI Service Unavailable (All models failed). Please check API Key or try again later." };
        }

        // --- Post-Process: Map Recommended Names to IDs ---
        // Requires precise name matching. If strict user builds are passed, AI might return them back.
        // We will do a best-effort reverse lookup using nameMap.

        const recommendedWithIds = analysisResult.buildRecommendation.recommendedItems.map((item: any) => {
            // Robust Normalization: Remove whitespace, Nakaguro (・), Colons (:：), and full-width spaces
            const normalizeRegex = /[\s\u3000\t・:：]+/g;
            const lowerName = item.itemName.toLowerCase().replace(normalizeRegex, '');
            
            // Try explicit lookup
             let id = 0;
             // Search in nameMap values or keys
             // Japanese name in DDragon `name` field? Yes.
             
             // Name map is Key(Lower Name) -> ID.
             // We need to match AI output (Japanese) to DDragon JA name.
             // Try exact match first
             for (const [key, val] of Object.entries(itemMap)) {
                  if (key.replace(normalizeRegex, '') === lowerName) {
                      id = parseInt(val);
                      break;
                  }
             }
             
             return {
                 ...item,
                 id: id
             };
        });
        
        // Filter out items not found in DDragon (id = 0) and log warning
        const validatedRecommendedItems = recommendedWithIds.filter((item: any) => {
            if (item.id === 0) {
                console.warn(`[Item Validation] Unknown item "${item.itemName}" - possibly hallucinated or outdated`);
                return false; // Exclude unknown items
            }
            return true;
        });
        
        if (recommendedWithIds.length > validatedRecommendedItems.length) {
            console.log(`[Post-Process] Removed ${recommendedWithIds.length - validatedRecommendedItems.length} unknown item recommendations.`);
        }

        // --- Post-Process Validation: Cross-check insights with Truth Events ---
        // Filter out insights that reference timestamps not present in Truth Events (±60s tolerance)
        const validatedInsights = analysisResult.insights.filter((insight: any) => {
            const insightTs = insight.timestamp as number;
            // Check if any Truth Event exists within 60 seconds of this insight timestamp
            const hasMatchingEvent = events.some(e => Math.abs(e.timestamp - insightTs) < 60000);
            if (!hasMatchingEvent) {
                console.warn(`[Validation] Filtered insight at ${insight.timestampStr}: No matching Truth Event`);
            }
            return hasMatchingEvent;
        });
        
        // Log validation stats
        const removedCount = analysisResult.insights.length - validatedInsights.length;
        if (removedCount > 0) {
            console.log(`[Post-Process] Removed ${removedCount} potentially hallucinated insights.`);
        }

        const finalResult: AnalysisResult = {
            insights: validatedInsights,
            buildRecommendation: {
                userItems: userItems,
                opponentItems: opponentItems,
                opponentChampionName: opponentPart?.championName || "Unknown",
                recommendedItems: validatedRecommendedItems,
                analysis: analysisResult.buildRecommendation.analysis
            },
            summaryAnalysis: analysisResult.summaryAnalysis
        };


        // --- Update Usage Limits (DB) ---
        if (shouldIncrementCount) {
            const today = new Date().toISOString();
            const todayDateStr = today.split('T')[0];
            const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
            let newCount = status.daily_analysis_count + 1;
            if (lastDateStr !== todayDateStr) newCount = 1;
      
            await supabase.from("profiles").update({ daily_analysis_count: newCount, last_analysis_date: today }).eq("id", user.id);
        } else if (!userApiKey && useEnvKey && !status.is_premium) {
            // Consume Credit
            await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", user.id);
        }
        // -------------------------------

        return { success: true, data: finalResult };

    } catch (e: any) {
        console.error("Coaching Analysis Error:", e);
        return { success: false, error: e.message };
    }
}

// Helper: Extract Match Context (User + Opponent + Runes)
function getMatchContext(match: any, puuid: string) {
    const participants = match.info.participants;
    const userPart = participants.find((p: any) => p.puuid === puuid);

    if (!userPart) return null;

    // Find direct opponent (Same position, different team)
    // Note: In some modes (Arena, ARAM), position might be fuzzy, but for SR it works.
    const opponentPart = participants.find((p: any) => 
        p.teamId !== userPart.teamId && 
        p.teamPosition === userPart.teamPosition &&
        p.teamPosition !== '' 
        // Fallback: If position is empty (ARAM), maybe just ignore opponent specific context or pick highest gold enemy?
        // For now strict lane opponent is best for "Macro".
    );

    return { userPart, opponentPart };
}

// Helper: Generate System Prompt based on Mode and Rank

function generateSystemPrompt(
    rank: string, 
    userItems: BuildItem[],
    opponentItemsStr: string,
    events: any[],
    userPart: any,
    opponentPart: any,
    champAttrs: ChampionAttributes | null,
    focus?: AnalysisFocus,
    patchVersion: string = "14.24.1",
    locale: string = "ja"
) {
    // 1. Determine Persona based on Rank (Shared Logic)
    const personaInstruction = getPersonaPrompt(rank);

    // 2. User Focus
    let focusInstruction = "";
    if (focus) {
        focusInstruction = `
        [User's Specific Question]
        Area of Interest: ${focus.focusArea || "Not specified"}
        ${focus.specificQuestion ? `Specific Concern: "${focus.specificQuestion}"` : ""}
        
        Prioritize answering this question in your response.
        `;
    }

    // 3. Match Context & Attributes
    let roleInstruction = "";
    if (champAttrs) {
        roleInstruction = `
        **[IMPORTANT: Champion Role Identity]**
        The user's champion (${userPart.championName}) has the following characteristics.
        Strictly evaluate whether the player's actions aligned with this role.

        - **Win Condition (Identity)**: ${champAttrs.identity} 
           (e.g., SPLIT_PUSHER should avoid teamfights, TEAMFIGHT should not over-sidelane)
        - **Power Spike**: ${champAttrs.powerSpike} 
           (e.g., LATE means avoiding early fights is correct, LEVEL_6 means avoid fighting before ult)
        - **Wave Clear**: ${champAttrs.waveClear} 
           (e.g., POOR wave clear means don't criticize for not roaming)
        - **Mobility**: ${champAttrs.mobility}
        `;
    } else {
        roleInstruction = `
        User's Champion: ${userPart.championName}
        (No attribute data: Evaluate as a general ${userPart.teamPosition})
        `;
    }

    // Determine output language
    const outputLanguage = locale === "ja" ? "Japanese" : locale === "ko" ? "Korean" : "English";

    return `
    ${personaInstruction}
    
    [IMPORTANT: Prerequisites]
    - Current Patch Version: **${patchVersion}**
    - **Target**: Focus on **MACRO analysis (decision-making, game state awareness)**.
    - **PROHIBITED**: 
      - Do NOT comment on CS count or skill accuracy (micro operations).
      - Do NOT mention "missed skillshots" or "slow reactions".
      - Do NOT recommend removed items (e.g., Divine Sunderer).
      - Do NOT mention other lane players (e.g., "Your jungler should have...").
      - Do NOT suggest actions impossible for the user's role.
    - Base all advice on the current item meta (Map 14, Season 2024/2025).

    Based on the match data below, provide coaching aimed at **individual player growth**.

    ${roleInstruction}

    [Role-Based Analysis - CRITICAL]
    The user played as **${userPart.teamPosition}**.
    Analyze ONLY actions this role could have taken:
    
    ■ TOP:
      - Split push pressure, TP to objectives
    ■ JUNGLE:
      - Positioning before objectives spawn, gank timing  
    ■ MIDDLE:
      - Roaming to side lanes, movement after wave push
    ■ BOTTOM:
      - Dragon fight participation, lane priority
    ■ UTILITY:
      - Vision control, ADC protection, warding around objectives

    [Truth Events from Riot API]
    The following events are **absolute facts**. Prioritize these over AI assumptions.
    ${JSON.stringify(events.slice(0, 50))} 
    (Abbreviated for token efficiency. Major kills, towers, objectives only.)

    [Analysis Procedure - Fact-Based Only]
    1. **Fact Verification (CRITICAL)**: Review the event list above. Only state "what happened".
    
    2. **[STRICTLY PROHIBITED] Speculation**:
       - The term "gank" or "jungler intervention" can ONLY be used if participants include a jungler.
       - NEVER describe a solo kill (no assists) as "getting ganked".
       - NEVER use speculative phrases like "probably", "might have", "I think".
       - NEVER invent information not in Truth Events (positions, causes, intentions).
    
    3. **Gank Detection Rules**:
       - 3+ participants → Teamfight or gank possibility
       - 2 participants only (killer + victim) → Solo kill, NOT a gank
       - With assists → Can describe as "multi-person attack"
    
    4. **Macro Evaluation (Fact-Based)**:
       - Evaluate objective gains/losses timing and sequence
       - Evaluate build path and recall timing
       - Note actions contradicting the champion's role

    ${focusInstruction}

    1. **Timeline Analysis (Insights) - Fact-Based Format**:
       **[ABSOLUTELY PROHIBITED] Situation Description/Fabrication**
       - Do NOT describe situations like "overextended" or "bad positioning" (you cannot see the video)
       - Instead, state ONLY confirmed facts from Truth Events
       
       **[Correct Output Format]**
       - title: Fact-based titles like "2v1 Death" or "Objective Secured"
       - description: Confirmed facts like "Kill with X participants" or "Y level difference"
       - advice: General advice based on numbers disadvantage/level difference/gold difference
       
       **[Role-Specific Advice - Based on User's Role]**
       - On objective loss (as ${userPart.teamPosition}) → "How could you have contributed to this objective as your role"
       - On tower destruction → "Push timing, awareness of opposite side of map"
       - On kill/death → "Macro decision at that time (should you rotate or farm)"
       
       **[Advice Format]**
       - Output in format: "As ${userPart.teamPosition}, you should have..."
       - Do NOT mention other lane players

       **[CRITICAL] Output at least 6 insights.**

    2. **Build Comparison & Recall Timing**:
       Evaluate the user's actual item purchases, timing, and recall decisions.
       - Actual Build: ${userItems.map(i => i.itemName).join(', ')}
       - Opponent Build: ${opponentItemsStr}
       - **[IMPORTANT]** Check if recalls/item updates align with power spike (${champAttrs?.powerSpike || 'unknown'}).
       - **[IMPORTANT]** Specifically state if the build was advantageous against the opponent (${opponentPart ? opponentPart.championName : 'unknown'}) and if recall timing was appropriate.

    3. **Summary Analysis - MOST IMPORTANT**:
       After analyzing all insights, identify the **root cause** and **priority improvement area**.
       
       **[Causal Analysis]**
       Example: Couldn't join dragon → Why? → Gap with lane opponent → Why? → Early deaths
       Trace back like this to identify the **root cause**.
       
       **[priorityFocus Selection Criteria]**
       - REDUCE_DEATHS: Deaths are frequent and causing other problems
       - OBJECTIVE_CONTROL: Issues with objective decisions
       - WAVE_MANAGEMENT: Poor wave management
       - VISION_CONTROL: Insufficient vision control
       - TRADING: Issues with lane trading decisions
       - POSITIONING: Positioning problems

    [CRITICAL: Output Style]
    - **Language**: Output in natural **${outputLanguage}**.
    - **Assertive tone**: Use definitive statements like "You should have..." instead of "I think...".

    [Context]
    - User: ${userPart.championName} (${userPart.teamPosition})
    - Rank: ${rank.toUpperCase()}
    - KDA: ${userPart.kills}/${userPart.deaths}/${userPart.assists}
    - Opponent: ${opponentPart ? opponentPart.championName : 'Unknown'}

    [Output Format (JSON)]
    Output ONLY the following JSON format. No markdown backticks.

    {
        "insights": [
            {
                "timestamp": number (ms),
                "timestampStr": string ("mm:ss"),
                "title": string (short headline),
                "description": string (confirmed facts only: e.g., "2v1 kill", "1 assist"),
                "type": "MISTAKE" | "TURNING_POINT" | "GOOD_PLAY" | "INFO",
                "advice": string (general advice based on numbers/level difference)
            }
        ],
        "buildRecommendation": {
            "recommendedItems": [
                { "itemName": "Item Name", "reason": "Short reason" },
                { "itemName": "Item Name", "reason": "Short reason" }
            ],
            "analysis": string (Comparison of user build vs recommended. ~200 chars.)
        },
        "summaryAnalysis": {
            "rootCause": string (Root cause of issues this match),
            "priorityFocus": "REDUCE_DEATHS" | "OBJECTIVE_CONTROL" | "WAVE_MANAGEMENT" | "VISION_CONTROL" | "TRADING" | "POSITIONING",
            "actionPlan": [
                string (1. Top priority improvement),
                string (2. Second priority),
                string (3. Third priority)
            ],
            "message": string (~200 chars summary. Start with "The most important improvement for this match is...")
        }
    }
    `;
}

// Helper: Summarize Timeline (Heuristic with Objectives & Context)
function summarizeTimeline(
    timeline: any, 
    userId: number, 
    opponentId?: number,
    mode: 'LANING' | 'MACRO' | 'TEAMFIGHT' = 'MACRO'
) {
    const events: any[] = [];
    const frames = timeline.info.frames;
    
    // Track Last Recall or Spawn for "Uptime"
    let lastSpawnTime = 0; 

    // Pre-scan for Vision Events (Ward Placed) to optimize lookup
    const wardEvents: { timestamp: number, x: number, y: number }[] = [];
    frames.forEach((f: any) => {
        f.events.forEach((e: any) => {
            if (e.type === 'WARD_PLACED' && e.creatorId === userId) {
                wardEvents.push({ timestamp: e.timestamp, x: e.x || 0, y: e.y || 0 });
            }
        });
    });

    frames.forEach((frame: any) => {
        // Mode Filtering Logic
        // LANING: Only events before 15 min (900000 ms)
        // TEAMFIGHT: Only events after 15 min
        if (mode === 'LANING' && frame.timestamp > 900000) return;
        if (mode === 'TEAMFIGHT' && frame.timestamp < 900000) return;

        // Update user state from frame
        const userFrame = frame.participantFrames?.[userId.toString()];
        const currentGold = userFrame?.currentGold || 0;
        const userPos = userFrame?.position || { x: 0, y: 0 };
        
        const relevantEvents = frame.events.filter((e: any) => {
             // 1. Champion Kill (User or Opponent involved)
             if (e.type === 'CHAMPION_KILL') {
                 // Update Spawn time on death? No, on respawn? 
                 // We just track death time.
                 if (e.victimId === userId) {
                     lastSpawnTime = e.timestamp; // Reset uptime counter roughly
                     return true;
                 }
                 return e.killerId === userId || e.assistingParticipantIds?.includes(userId) ||
                        (opponentId && (e.killerId === opponentId || e.victimId === opponentId));
             }
             // 2. Objectives
             if (e.type === 'ELITE_MONSTER_KILL') return true; 
             
             // 3. Turrets
             if (e.type === 'BUILDING_KILL') {
                 // Filter relevant ones
                 return true;
             }

             // 4. Mode Specific Events
             if (mode === 'LANING' && e.type === 'SKILL_LEVEL_UP' && e.participantId === userId) {
                 return true; // Trace skill order in laning
             }
             
             return false; // Skip items for prompt brevity unless specialized
        });

        relevantEvents.forEach((e: any) => {
            if (e.type === 'CHAMPION_KILL' && e.victimId === userId) {
                // --- Analyze Death Context ---
                const assistCount = e.assistingParticipantIds ? e.assistingParticipantIds.length : 0;
                const isSolo = assistCount === 0;
                const timeSinceLastSpawn = ((e.timestamp - lastSpawnTime) / 60000).toFixed(1); // mins
                
                // Vision Check: Any ward placed near user in last 90s?
                // We assume we look for wards placed ROUGHLY near death spot.
                // Death event has x,y usually.
                const deathX = e.position?.x || userPos.x;
                const deathY = e.position?.y || userPos.y;
                
                const recentWards = wardEvents.filter(w => 
                    w.timestamp < e.timestamp && 
                    w.timestamp > (e.timestamp - 90000) &&
                    getDistance(w.x, w.y, deathX, deathY) < 2000
                );
                const hasNearbyVision = recentWards.length > 0;

                events.push({
                    type: "USER_DIED",
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    category: isSolo ? "SOLO_KILL_LOSS" : "GANK_OR_TEAMFIGHT",
                    killerId: e.killerId,
                    assists: assistCount,
                    context: {
                        goldOnHand: currentGold,
                        nearbyVision: hasNearbyVision,
                        timeAliveMins: timeSinceLastSpawn,
                        isSolo: isSolo
                    },
                    details: isSolo 
                        ? `1v1 Defeat against ${e.killerId}` 
                        : `Caught by ${e.killerId} + ${assistCount} others`
                });
            } else if (e.type === 'SKILL_LEVEL_UP') {
                // Simplified Skill Event
                events.push({
                    type: "SKILL_UP",
                    timestamp: e.timestamp,
                    skill: e.skillSlot, // 1=Q, 2=W, 3=E, 4=R
                    level: e.levelUpType 
                });
            } else {
                events.push({
                    type: e.type,
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    details: formatEventDetails(e, userId, opponentId)
                });
            }
        });
    });

    return events;
}

function formatEventDetails(e: any, uid: number, oid?: number) {
    if (e.type === 'CHAMPION_KILL') {
         if (e.victimId === uid) return "User DIED"; // Handled above but fallback
         if (e.killerId === uid) return `User KILLED (Victim: ${e.victimId})`;
         if (oid && e.killerId === oid) return `Opponent KILLED someone`;
         if (oid && e.victimId === oid) return `Opponent DIED`;
         return `Teamfight (User Assist)`;
    }
    if (e.type === 'ELITE_MONSTER_KILL') return `${e.monsterType} taken by ${e.killerId}`;
    if (e.type === 'BUILDING_KILL') return `Turret Destroyed`;
    return e.type;
}

function getDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTeamIdFromPid(pid: number, timeline: any) {
    return pid <= 5 ? 100 : 200;
}
