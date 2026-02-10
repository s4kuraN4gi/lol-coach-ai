'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData, fetchRank, fetchLatestVersion, extractMatchEvents, extractFrameStats, getChampionAttributes, ChampionAttributes, TruthEvent, FrameStats, buildParticipantRoleMap, ParticipantRoleMap, getRelevantMacroAdvice, getEnhancedMacroAdvice, MacroAdviceContext } from "./riot";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisMode, getPersonaPrompt } from './promptUtils';
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from './constants';

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export type MatchSummary = {
    matchId: string;
    championName: string;
    win: boolean;
    kda: string;
    timestamp: number;
    queueId: number;
};

export async function getMatchSummary(matchId: string, puuid: string): Promise<MatchSummary | null> {
    const supabase = await createClient();

    const { data: matchData } = await supabase
        .from('match_cache')
        .select('data, match_id')
        .eq('match_id', matchId)
        .single();

    if (!matchData) return null;

    const info = matchData.data.info;
    const participant = info.participants.find((p: any) => p.puuid === puuid);
    if (!participant) return null;

    return {
        matchId: matchData.match_id,
        championName: participant.championName,
        win: participant.win,
        kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
        timestamp: info.gameStartTimestamp,
        queueId: info.queueId
    };
}

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
    rootCause: string; // 根本原因（1つに絞った最大の問題）
    rootCauseDetail?: string; // 根本原因の詳細説明（証拠付き）
    priorityFocus: "REDUCE_DEATHS" | "OBJECTIVE_CONTROL" | "WAVE_MANAGEMENT" | "VISION_CONTROL" | "TRADING" | "POSITIONING" | "CS_EFFICIENCY" | "MAP_AWARENESS";
    actionPlan: string[]; // 優先順位付きアクションプラン
    message: string; // 総括メッセージ
};

// ターニングポイント（試合の流れが変わった瞬間）
export type TurningPoint = {
    timestamp: number;
    timestampStr: string;
    event: string; // 何が起きたか
    goldSwing: number; // ゴールド差の変動
    description: string; // なぜこれがターニングポイントか
    whatShouldHaveDone: string; // 何をすべきだったか
};

// 今日の宿題（次の試合で意識すること1つ）
export type Homework = {
    title: string; // 短いタイトル
    description: string; // 具体的な説明
    howToCheck: string; // どうやって達成を確認するか
    relatedTimestamps: string[]; // この試合での関連シーン
};

// 強み/弱み分析
export type StrengthWeakness = {
    strengths: {
        category: string; // e.g., "CS効率", "キル参加率"
        value: string; // e.g., "7.2/min"
        comparison: string; // e.g., "同ランク平均: 6.5"
        comment?: string;
    }[];
    weaknesses: {
        category: string;
        value: string;
        comparison: string;
        comment?: string;
    }[];
};

// ランク別平均データ（比較用）
export type RankAverages = {
    rank: string;
    avgDeaths: number;
    avgCS: number;
    avgVisionScore: number;
    avgKillParticipation: number;
};

export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildComparison;
    summaryAnalysis?: SummaryAnalysis;
    turningPoint?: TurningPoint; // 試合のターニングポイント
    homework?: Homework; // 今日の宿題
    strengthWeakness?: StrengthWeakness; // 強み/弱み
};

// Fallback sequence: Stable 2.0 -> New 2.5 -> Legacy Standard
const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

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

    const weeklyCount = status.weekly_analysis_count || 0;

    if (status.is_premium) {
        // 1. Premium User - 20 analyses per week
        if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
            const resetDate = status.weekly_reset_date ? new Date(status.weekly_reset_date).toLocaleDateString('ja-JP') : '月曜日';
            return { success: false, error: `週間制限に達しました (${weeklyCount}/${PREMIUM_WEEKLY_ANALYSIS_LIMIT})。${resetDate}にリセットされます。` };
        }

        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        // 2. Free User - 3 analyses per week (unless using own API key)
        if (userApiKey) {
            useEnvKey = false; // Use provided key
        } else {
            if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
                const resetDate = status.weekly_reset_date ? new Date(status.weekly_reset_date).toLocaleDateString('ja-JP') : '月曜日';
                return { success: false, error: `無料プランの週間制限に達しました (${weeklyCount}/${FREE_WEEKLY_ANALYSIS_LIMIT})。${resetDate}にリセットされます。プレミアムプランへのアップグレードで週20回まで分析できます。` };
            }
            useEnvKey = true;
            shouldIncrementCount = true;
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

        // 2. Build Match Context (with timeline for participant IDs)
        const context = getMatchContext(match, puuid, timeline);
        if (!context) return { success: false, error: "Participant analysis failed" };

        const { userPart, opponentPart, userPid, opponentPid } = context;

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

        // 4. Build Participant Role Map for accurate kill type detection
        const roleMap = await buildParticipantRoleMap(match);
        console.log("[Coach] Role Map:", JSON.stringify(roleMap));

        // 5. Summarize Timeline (Truth Injection) - Enhanced with role-aware context
        let timeRange: { startMs: number, endMs: number } | undefined;
        if (focus?.mode === 'LANING') {
            timeRange = { startMs: 0, endMs: 900000 }; // 0-15 min
        } else if (focus?.mode === 'TEAMFIGHT') {
            timeRange = { startMs: 900000, endMs: 3600000 }; // 15min+
        }
        // For MACRO mode, no filter (full game analysis)

        // Extract events WITH opponent context AND role mapping for accurate analysis
        const rawEvents = await extractMatchEvents(timeline, puuid, timeRange, opponentPid, roleMap);

        // 6. Extract frame statistics (Gold/CS/Level over time)
        const frameStats = await extractFrameStats(timeline, puuid, opponentPid);

        // Priority sorting: DEATH > OBJECTIVE > TURRET > KILL > WARD (Macro focus)
        const priorityOrder: Record<string, number> = {
            'DEATH': 1,      // User's deaths are highest priority
            'OBJECTIVE': 2,
            'TURRET': 3,
            'KILL': 4,
            'WARD': 5,
            'ITEM': 6,
            'LEVEL': 7
        };
        const sortedEvents = rawEvents.sort((a, b) => {
            const aPriority = priorityOrder[a.type] || 99;
            const bPriority = priorityOrder[b.type] || 99;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return a.timestamp - b.timestamp;
        });

        // Limit to 50 events (increased from 40 for richer context)
        const events = sortedEvents.slice(0, 50);

        // Extract key frame stats for prompt (every 5 minutes)
        const keyFrameStats = frameStats.filter((_, i) => i % 5 === 0 || i === frameStats.length - 1);

        // 7. Fetch Champion Attributes
        const champAttrs = await getChampionAttributes(userPart.championName);

        // 8. Get Macro Knowledge based on game state (ENHANCED)
        // Find the latest gold diff and game duration
        const latestFrameStat = keyFrameStats[keyFrameStats.length - 1];
        const avgGoldDiff = latestFrameStat?.goldDiff || 0;
        const avgCsDiff = latestFrameStat?.csDiff || 0;
        const gameDurationMs = match.info.gameDuration * 1000; // Convert to ms

        // Count user deaths for pattern detection
        const userDeaths = events.filter(e => e.type === 'DEATH');
        const deathCount = userDeaths.length;

        // Find enemy objective events to get relevant macro advice
        const enemyObjectiveEvents = events.filter(e =>
            (e.type === 'OBJECTIVE' || e.type === 'TURRET') &&
            e.context?.isAllyObjective === false
        );

        // Determine focus mode based on analysis focus
        let focusModeForMacro: 'LANING' | 'MACRO' | 'TEAMFIGHT' = 'MACRO';
        if (focus?.mode === 'LANING') focusModeForMacro = 'LANING';
        else if (focus?.mode === 'TEAMFIGHT') focusModeForMacro = 'TEAMFIGHT';

        // Build enhanced context for macro advice
        const macroContext: MacroAdviceContext = {
            goldDiff: avgGoldDiff,
            gameTimeMs: gameDurationMs,
            userRole: userPart.teamPosition,
            events: events,
            focusMode: focusModeForMacro,
            deathCount: deathCount,
            csDiff: avgCsDiff,
            enemyObjectivesTaken: enemyObjectiveEvents.map(e => e.context?.objectiveType || 'UNKNOWN')
        };

        // Get enhanced macro advice with full context
        const generalMacroAdvice = await getEnhancedMacroAdvice(
            macroContext,
            undefined,
            undefined
        );

        // Get objective-specific advice for the most impactful enemy objective
        let objectiveMacroAdvice = "";
        if (enemyObjectiveEvents.length > 0) {
            // Prioritize Baron > Dragon > Herald > Turret
            const priorityOrder: Record<string, number> = {
                'BARON_NASHOR': 1, 'BARON': 1,
                'DRAGON': 2, 'ELDER_DRAGON': 1,
                'RIFT_HERALD': 3,
                'HORDE': 4,
                'TOWER_BUILDING': 5
            };

            const sortedObjectives = enemyObjectiveEvents.sort((a, b) => {
                const aPriority = priorityOrder[a.context?.objectiveType || ''] || 99;
                const bPriority = priorityOrder[b.context?.objectiveType || ''] || 99;
                return aPriority - bPriority;
            });

            const mostImpactfulEvent = sortedObjectives[0];
            if (mostImpactfulEvent) {
                // Use legacy function for objective-specific advice to avoid duplication
                objectiveMacroAdvice = await getRelevantMacroAdvice(
                    avgGoldDiff,
                    mostImpactfulEvent.timestamp,
                    mostImpactfulEvent.context?.objectiveType,
                    false,  // Enemy objective
                    userPart.teamPosition
                );
            }
        }

        // Combine macro advice (enhanced general + objective-specific)
        const combinedMacroAdvice = [generalMacroAdvice, objectiveMacroAdvice].filter(Boolean).join('\n\n');

        console.log("[Coach] Enhanced Macro Advice Length:", combinedMacroAdvice.length);
        console.log("[Coach] Detected Focus Mode:", focusModeForMacro);
        console.log("[Coach] User Deaths:", deathCount, "| Enemy Objectives:", enemyObjectiveEvents.length);

        // 9. Prompt Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);

        // Use the new versatile prompt generator with enhanced data
        const systemPrompt = generateSystemPrompt(
            rankTier,
            userItems,
            opponentItemsStr,
            events,
            userPart,
            opponentPart,
            champAttrs,
            focus,
            latestVersion,
            locale,
            keyFrameStats,
            roleMap,
            combinedMacroAdvice  // NEW: Macro knowledge injection
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

        // Debug: Log the structure of analysisResult
        console.log("[Coach] Analysis Result Keys:", Object.keys(analysisResult));
        console.log("[Coach] Has buildRecommendation:", !!analysisResult.buildRecommendation);
        console.log("[Coach] Has insights:", !!analysisResult.insights);
        console.log("[Coach] Has summaryAnalysis:", !!analysisResult.summaryAnalysis);

        // --- Post-Process: Map Recommended Names to IDs ---
        // Requires precise name matching. If strict user builds are passed, AI might return them back.
        // We will do a best-effort reverse lookup using nameMap.

        // Safety check for buildRecommendation
        if (!analysisResult.buildRecommendation || !analysisResult.buildRecommendation.recommendedItems) {
            console.error("[Coach] Invalid response structure - missing buildRecommendation or recommendedItems");
            console.error("[Coach] Raw response:", JSON.stringify(analysisResult).substring(0, 500));
            return { success: false, error: "AI returned invalid response structure. Please try again." };
        }

        // Safety check for insights
        if (!analysisResult.insights || !Array.isArray(analysisResult.insights)) {
            console.error("[Coach] Invalid response structure - missing or invalid insights");
            analysisResult.insights = [];
        }

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
            summaryAnalysis: analysisResult.summaryAnalysis,
            turningPoint: analysisResult.turningPoint,
            homework: analysisResult.homework,
            strengthWeakness: analysisResult.strengthWeakness
        };

        // Log new fields for debugging
        console.log("[Coach] Has turningPoint:", !!analysisResult.turningPoint);
        console.log("[Coach] Has homework:", !!analysisResult.homework);
        console.log("[Coach] Has strengthWeakness:", !!analysisResult.strengthWeakness);


        // --- Update Usage Limits (DB) ---
        // Both premium and free users increment weekly count when using env key
        if (shouldIncrementCount) {
            const newWeeklyCount = (status.weekly_analysis_count || 0) + 1;
            await supabase.from("profiles").update({ weekly_analysis_count: newWeeklyCount }).eq("id", user.id);
        }
        // -------------------------------

        return { success: true, data: finalResult };

    } catch (e: any) {
        console.error("Coaching Analysis Error:", e);
        return { success: false, error: e.message };
    }
}

// Helper: Extract Match Context (User + Opponent + Runes)
function getMatchContext(match: any, puuid: string, timeline?: any) {
    const participants = match.info.participants;
    const userPart = participants.find((p: any) => p.puuid === puuid);

    if (!userPart) return null;

    // Find direct opponent (Same position, different team)
    const opponentPart = participants.find((p: any) =>
        p.teamId !== userPart.teamId &&
        p.teamPosition === userPart.teamPosition &&
        p.teamPosition !== ''
    );

    // Get Participant IDs from timeline (1-10 based on team)
    let userPid = 0;
    let opponentPid = 0;

    if (timeline?.info?.participants) {
        const timelineParticipants = timeline.info.participants;
        const userTimelinePart = timelineParticipants.find((p: any) => p.puuid === puuid);
        if (userTimelinePart) userPid = userTimelinePart.participantId;

        if (opponentPart) {
            const oppTimelinePart = timelineParticipants.find((p: any) => p.puuid === opponentPart.puuid);
            if (oppTimelinePart) opponentPid = oppTimelinePart.participantId;
        }
    } else {
        // Fallback: Use match participant index (not always reliable)
        const userIndex = participants.findIndex((p: any) => p.puuid === puuid);
        userPid = userIndex + 1;
        if (opponentPart) {
            const oppIndex = participants.findIndex((p: any) => p.puuid === opponentPart.puuid);
            opponentPid = oppIndex + 1;
        }
    }

    return { userPart, opponentPart, userPid, opponentPid };
}

// Helper: Generate System Prompt based on Mode and Rank

function generateSystemPrompt(
    rank: string,
    userItems: BuildItem[],
    opponentItemsStr: string,
    events: TruthEvent[],
    userPart: any,
    opponentPart: any,
    champAttrs: ChampionAttributes | null,
    focus?: AnalysisFocus,
    patchVersion: string = "14.24.1",
    locale: string = "ja",
    frameStats?: FrameStats[],
    roleMap?: ParticipantRoleMap,
    macroAdvice?: string  // NEW: Macro knowledge injection
) {
    // 1. Determine Persona based on Rank
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

    // 3. Champion Identity
    let roleInstruction = "";
    if (champAttrs) {
        roleInstruction = `
        **[Champion Identity: ${userPart.championName}]**
        - Win Condition: ${champAttrs.identity}
        - Power Spike: ${champAttrs.powerSpike}
        - Wave Clear: ${champAttrs.waveClear}
        - Mobility: ${champAttrs.mobility}
        `;
    }

    // 4. Build Frame Stats Summary (Gold/CS trend)
    let frameStatsSummary = "";
    if (frameStats && frameStats.length > 0) {
        const keyPoints = frameStats.map(f => ({
            time: f.timestampStr,
            goldDiff: f.goldDiff,
            csDiff: f.csDiff,
            levelDiff: f.levelDiff
        }));
        frameStatsSummary = `
        **[Game State Progression - FACTUAL DATA]**
        Gold/CS/Level difference vs lane opponent over time:
        ${JSON.stringify(keyPoints)}

        Use this data to:
        - Identify WHEN the user fell behind or got ahead
        - Correlate deaths/kills with gold swings
        - Evaluate if user maintained or lost advantages
        `;
    }

    // 5. Build match roster for context
    let matchRosterSummary = "";
    if (roleMap) {
        const blueTeam = Object.entries(roleMap)
            .filter(([_, info]) => info.teamId === 100)
            .map(([pid, info]) => `${info.role}: ${info.championName}`)
            .join(', ');
        const redTeam = Object.entries(roleMap)
            .filter(([_, info]) => info.teamId === 200)
            .map(([pid, info]) => `${info.role}: ${info.championName}`)
            .join(', ');

        const userTeam = userPart.teamId === 100 ? 'BLUE' : 'RED';
        matchRosterSummary = `
        **[Match Roster - Use for Kill Type Verification]**
        Blue Team: ${blueTeam}
        Red Team: ${redTeam}
        YOU are on ${userTeam} team as ${userPart.teamPosition}.

        **Kill Type Legend:**
        - SOLO: 1v1 fight, no other participants
        - LANE_2V2: Bot lane fight (ADC+SUP vs ADC+SUP)
        - GANK: Jungle intervention from either team
        - ROAM: Mid or Top laner joining another lane's fight
        - TEAMFIGHT: 5+ participants involved
        `;
    }

    // 6. Format events with context including involved roles and objective ownership
    const formattedEvents = events.map(e => ({
        time: e.timestampStr,
        type: e.type,
        detail: e.detail,
        context: e.context ? {
            goldDiff: e.context.goldDiff,
            levelDiff: e.context.levelDiff,
            killType: e.context.killType,
            assistCount: e.context.assistCount,
            involvedRoles: e.context.involvedRoles,
            isAllyObjective: e.context.isAllyObjective,  // true = YOUR team, false = ENEMY team
            objectiveType: e.context.objectiveType
        } : undefined
    }));

    // Determine output language
    const outputLanguage = locale === "ja" ? "Japanese" : locale === "ko" ? "Korean" : "English";

    return `
    ${personaInstruction}

    You are analyzing a League of Legends match to provide **actionable coaching**.
    Current Patch: **${patchVersion}**

    ============================================================
    ANALYSIS FRAMEWORK: FACT → INFERENCE → ADVICE
    ============================================================

    Your analysis MUST follow this 3-step structure for each insight:

    1. **FACT** (What happened - from Truth Events)
       - State ONLY what is confirmed in the data
       - Example: "At 8:32, you died in a 2v1 (1 assist recorded)"

    2. **INFERENCE** (What this implies - logical deduction)
       - Draw conclusions ONLY from the facts provided
       - Use gold/level/CS data to support your reasoning
       - Example: "You were 500g behind at this point, making the fight unfavorable"
       - ALLOWED: "This death likely occurred because..." (when supported by data)
       - FORBIDDEN: "You probably overextended" (no positional data available)

    3. **ADVICE** (What to do differently)
       - Provide specific, actionable improvement
       - Tailor to the user's rank (${rank}) and champion (${userPart.championName})

    ============================================================
    WHAT YOU CAN AND CANNOT SAY
    ============================================================

    ✅ ALLOWED (Fact-based inference):
    - "You died at 8:32 while 500g behind. Fighting at a gold disadvantage reduces win probability."
    - "Your death coincided with dragon spawn. As ${userPart.teamPosition}, being dead during objective spawns is costly."
    - "The enemy secured 3 objectives while you had 0 ward events recorded. Vision control appears insufficient."
    - "You achieved a solo kill at 6:15 with a 1-level advantage. This was a good trade window."

    ❌ FORBIDDEN (Unsupported speculation):
    - "You were probably out of position" (no positional data)
    - "You missed your skillshots" (no micro data)
    - "Your jungler should have helped" (focus on USER only)
    - "The enemy was fed" (analyze USER's actions, not blame)

    ============================================================
    OBJECTIVE ANALYSIS RULES (CRITICAL)
    ============================================================

    **Check "isAllyObjective" in each OBJECTIVE/TURRET event context:**

    ✅ When isAllyObjective = TRUE (YOUR team secured):
    - This is a GOOD_PLAY or INFO
    - Praise if the user contributed (e.g., "Good objective prioritization")
    - Note the gold advantage gained

    ❌ When isAllyObjective = FALSE (ENEMY team secured):
    - This is a MISTAKE or TURNING_POINT for the user
    - Analyze: "Why did YOUR team lose this objective?"
    - Consider: Was the user dead? Out of position? No priority?
    - Advice should focus on: "How could YOU have prevented this loss?"
    - Example: "Enemy secured Dragon while you were dead. Avoid fighting before objective spawns."
    - Example: "Enemy took Baron. As ${userPart.teamPosition}, consider: Were you applying pressure elsewhere? Could you have contested?"

    **DO NOT give advice like:**
    - "After securing the objective, retreat safely" (when ENEMY secured it)
    - "Good objective control" (when ENEMY took it)

    ============================================================
    MATCH DATA (ABSOLUTE FACTS)
    ============================================================

    ${roleInstruction}

    **[User Context]**
    - Champion: ${userPart.championName} (${userPart.teamPosition})
    - Rank: ${rank.toUpperCase()}
    - Final KDA: ${userPart.kills}/${userPart.deaths}/${userPart.assists}
    - Lane Opponent: ${opponentPart ? opponentPart.championName : 'Unknown'}
    - Final Build: ${userItems.map(i => i.itemName).join(', ')}
    - Opponent Build: ${opponentItemsStr}

    ${frameStatsSummary}

    ${matchRosterSummary}

    **[Truth Events - Timestamped Facts]**
    Each event includes "involvedRoles" showing WHO participated (e.g., "JUNGLE(LeeSin)" = jungle gank).
    ${JSON.stringify(formattedEvents, null, 2)}

    ${macroAdvice ? `
    ============================================================
    MACRO STRATEGY KNOWLEDGE (MANDATORY - USE IN ALL SECTIONS)
    ============================================================

    The following macro knowledge is ACCURATE and MUST be used throughout your analysis.
    Reference specific concepts by name (e.g., "スロープッシュ", "Hit-and-Run戦術", "クロスマッピング").

    ${macroAdvice}

    **CRITICAL - USE THIS KNOWLEDGE IN ALL SECTIONS:**

    1. **In Insights (advice field)**:
       - Reference specific wave management techniques: スロープッシュ、フリーズ、ヘルドウェーブ
       - Use Season 16 specific strategies: Hit-and-Run戦術、Crystalline Overgrowth活用、Faillight視界
       - Mention role-specific advice based on user's role (${userPart.teamPosition})
       - Example: "このデスの後、クロスマッピングで反対サイドを押すべきでした"

    2. **In Turning Point**:
       - Explain what macro strategy could have changed the outcome
       - Reference specific concepts: ウェーブを押してからローテーション、オブジェクト前のデスを避ける
       - Example: "敵がバロンを触った時、ゴールド差-5000gだったため、SPLIT_PUSH_OPPOSITEが正解でした"

    3. **In Homework**:
       - Choose ONE specific macro concept from the knowledge above
       - Use the exact terminology from the knowledge base
       - Example: title="2ウェーブサイクルを意識", description="第1ウェーブでスロープッシュ→第2ウェーブでクラッシュ→中央で受ける、を繰り返す"

    4. **In Summary Analysis**:
       - Root cause should reference specific macro mistakes from the knowledge
       - Action plan should include specific strategies with their Japanese names
       - Example: rootCause="レーン離脱後にウェーブを押していない（Push and Rotate失敗）"

    5. **For objectives lost to enemy**:
       - Use gold-based strategy recommendations exactly as written
       - Reference the recommended_action (e.g., SPLIT_PUSH_OPPOSITE, CONTEST_WITH_VISION)
       - Include role-specific advice for ${userPart.teamPosition}
    ` : ''}

    ============================================================
    ANALYSIS REQUIREMENTS
    ============================================================

    ${focusInstruction}

    **1. Timeline Insights (MINIMUM 6 insights required - USE MACRO KNOWLEDGE)**

    For each significant event, provide:
    - timestamp/timestampStr: When it happened
    - title: Short factual headline (e.g., "Solo Death at Gold Disadvantage")
    - description: FACT + INFERENCE combined
    - type: MISTAKE | GOOD_PLAY | TURNING_POINT | INFO
    - advice: **MUST reference specific macro concepts from MACRO STRATEGY KNOWLEDGE**
      - For deaths: "この状況ではフリーズを維持して安全にファームすべきでした"
      - For objectives: "ゴールド差-5000gではSPLIT_PUSH_OPPOSITEが正解。反対サイドでプレートを獲得すべきでした"
      - For wave issues: "2ウェーブサイクルを意識し、クラッシュ後は中央でウェーブを受けるべきでした"
      - For rotations: "Push and Rotateの基本。ウェーブを押してからローテーションすべきでした"

    **Priority for insights:**
    1. User DEATHS (especially early game and near objectives) - explain with wave/map state
    2. Objective contests - use gold-based strategy recommendations
    3. Tower trades - reference Hit-and-Run戦術 and プレート獲得
    4. Kill streaks or shutdown deaths
    5. Notable gold/level swings - link to game state strategy

    **2. Build Analysis**

    Evaluate:
    - Was the build appropriate against ${opponentPart ? opponentPart.championName : 'the opponent'}?
    - Did item timing align with ${champAttrs?.powerSpike || 'power spikes'}?
    - Recommend 2-3 items that would have been better (with reasoning)

    **3. Summary Analysis (MOST IMPORTANT - USE MACRO KNOWLEDGE)**

    Identify:
    - **Root Cause**: Reference a SPECIFIC macro mistake from the knowledge base:
      - "Push and Rotate失敗（ウェーブを押さずにローテーション）"
      - "オブジェクト前のデス（ドラゴンスポーン前90秒以内のデス）"
      - "Hit-and-Run戦術の欠如（タワーを削りきろうとして捕まる）"
      - "クロスマッピング未実施（ビハインド時に敵と同じ場所でファイト）"
      - "2ウェーブサイクル崩壊（スロープッシュを作らず毎回ハードプッシュ）"
    - **Root Cause Detail**: Evidence from THIS match with specific timestamps
    - **Priority Focus**: Select ONE from:
      REDUCE_DEATHS | OBJECTIVE_CONTROL | WAVE_MANAGEMENT | VISION_CONTROL | TRADING | POSITIONING | CS_EFFICIENCY | MAP_AWARENESS
    - **Action Plan**: 3 specific improvements using MACRO KNOWLEDGE terminology:
      - Good: "ローテーション前にウェーブを必ず押す（Push and Rotate）"
      - Good: "ビハインド時はクロスマッピングで反対サイドを押す"
      - Bad: "デスを減らす" (具体的な方法がない)
    - **Message**: Encouraging but honest summary (~200 chars)

    **4. Turning Point (CRITICAL - USE MACRO KNOWLEDGE FOR whatShouldHaveDone)**

    Analyze the gold progression and events to find THE key moment where:
    - The gold difference shifted significantly (500g+ swing)
    - The game's trajectory was determined
    - User could have changed the outcome with different action

    Include:
    - Exact timestamp of the turning point
    - What event triggered it (e.g., "2v1死亡 → ドラゴンロスト")
    - Gold swing amount (e.g., +1500 to -500 = -2000 swing)
    - **whatShouldHaveDone**: Reference SPECIFIC macro strategies from the knowledge:
      - If behind 5000g+: "SPLIT_PUSH_OPPOSITEを選択し、反対サイドでタワープレートを獲得すべきだった"
      - If death before objective: "オブジェクトスポーン1分前はデスを避け、ウェーブをプッシュして準備すべきだった"
      - If failed teamfight: "クロスマッピングで敵がいない場所のリソースを取るべきだった"
      - If wave mismanagement: "ローテーション前にPush and Rotateの基本を守り、ウェーブを敵タワーに当ててから動くべきだった"

    **5. Homework (ONE actionable item for next game - USE MACRO KNOWLEDGE)**

    Based on the analysis, give the user ONE specific macro concept to practice.
    **IMPORTANT: Choose from the MACRO STRATEGY KNOWLEDGE above, not generic advice.**

    Good examples (using specific concepts):
    - Title: "2ウェーブサイクルの習得", Description: "スロープッシュ→クラッシュ→中央受けのサイクルを繰り返す"
    - Title: "Hit-and-Run戦術", Description: "タワーを攻撃→Overgrowthバースト→離脱→防御バフが切れたら戻る"
    - Title: "クロスマッピングの実践", Description: "敵が5人でプッシュ中、反対サイドでタワーを取る"
    - Title: "オブジェクト前のデスを避ける", Description: "ドラゴン/バロンスポーン1分前からリスクを取らない"
    - Title: "Push and Rotateの基本", Description: "ウェーブを敵タワーに押してからチームに合流"

    Bad examples (too generic):
    - "ミニマップを見る" - 具体的なマクロ概念ではない
    - "デスを減らす" - どうやって減らすかが不明

    Required fields:
    - Title: Specific macro concept name from knowledge base
    - Description: Why this is important and exact steps to do it
    - How to check: Measurable success criteria (e.g., "ローテーション前にウェーブを押せた回数が5回以上")
    - Related timestamps: 2-3 timestamps from THIS match where this would have helped

    **6. Strengths & Weaknesses Analysis**

    Compare the user's performance to ${rank} tier averages:

    ${rank} Tier Averages (approximate):
    - Deaths: ${getRankAverages(rank).avgDeaths}/game
    - CS/min: ${getRankAverages(rank).avgCS}
    - Vision Score: ${getRankAverages(rank).avgVisionScore}
    - Kill Participation: ${getRankAverages(rank).avgKillParticipation}%

    User's stats this game:
    - Deaths: ${userPart.deaths}
    - CS: ${userPart.totalMinionsKilled + userPart.neutralMinionsKilled} (${((userPart.totalMinionsKilled + userPart.neutralMinionsKilled) / (frameStats?.[frameStats.length - 1]?.timestamp || 1800000) * 60000).toFixed(1)}/min)
    - Vision Score: ${userPart.visionScore || 0}
    - Kill Participation: ${Math.round(((userPart.kills + userPart.assists) / Math.max(1, userPart.kills + userPart.assists + userPart.deaths)) * 100)}% (estimate)

    List 1-2 STRENGTHS (where user performed above average) and 1-2 WEAKNESSES (below average)

    ============================================================
    OUTPUT FORMAT
    ============================================================

    Output ONLY valid JSON (no markdown, no backticks):
    - Language: **${outputLanguage}**
    - Tone: Assertive ("You should have..." not "Maybe you could...")

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
            "rootCause": string (ONE root cause - be specific, e.g., "レーン戦での過剰なトレード"),
            "rootCauseDetail": string (Detailed explanation with evidence, ~300 chars),
            "priorityFocus": "REDUCE_DEATHS" | "OBJECTIVE_CONTROL" | "WAVE_MANAGEMENT" | "VISION_CONTROL" | "TRADING" | "POSITIONING" | "CS_EFFICIENCY" | "MAP_AWARENESS",
            "actionPlan": [
                string (1. Top priority improvement),
                string (2. Second priority),
                string (3. Third priority)
            ],
            "message": string (~200 chars summary)
        },
        "turningPoint": {
            "timestamp": number (ms),
            "timestampStr": string ("mm:ss"),
            "event": string (What happened, e.g., "2v1デスからドラゴンロスト"),
            "goldSwing": number (Gold difference change, e.g., -2000),
            "description": string (Why this was the turning point, ~200 chars),
            "whatShouldHaveDone": string (Specific alternative action, ~150 chars)
        },
        "homework": {
            "title": string (Short memorable title, e.g., "ミニマップ確認"),
            "description": string (Why and how to practice this, ~200 chars),
            "howToCheck": string (Success criteria, e.g., "次の試合でデス3以下"),
            "relatedTimestamps": [string] (2-3 timestamps from this match, e.g., ["8:32", "14:15"])
        },
        "strengthWeakness": {
            "strengths": [
                {
                    "category": string (e.g., "CS効率"),
                    "value": string (e.g., "7.2/min"),
                    "comparison": string (e.g., "同ランク平均: 6.5"),
                    "comment": string (optional, short praise)
                }
            ],
            "weaknesses": [
                {
                    "category": string (e.g., "デス数"),
                    "value": string (e.g., "8回"),
                    "comparison": string (e.g., "同ランク平均: 4.5回"),
                    "comment": string (optional, improvement hint)
                }
            ]
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

// Helper: Get Rank-specific average stats for comparison
function getRankAverages(rank: string): RankAverages {
    // Data based on LoL statistics from various sources (approximate averages)
    const rankData: Record<string, RankAverages> = {
        'IRON': { rank: 'IRON', avgDeaths: 8.5, avgCS: 4.5, avgVisionScore: 12, avgKillParticipation: 45 },
        'BRONZE': { rank: 'BRONZE', avgDeaths: 7.8, avgCS: 5.0, avgVisionScore: 15, avgKillParticipation: 48 },
        'SILVER': { rank: 'SILVER', avgDeaths: 6.8, avgCS: 5.5, avgVisionScore: 18, avgKillParticipation: 52 },
        'GOLD': { rank: 'GOLD', avgDeaths: 5.8, avgCS: 6.0, avgVisionScore: 22, avgKillParticipation: 55 },
        'PLATINUM': { rank: 'PLATINUM', avgDeaths: 5.2, avgCS: 6.5, avgVisionScore: 26, avgKillParticipation: 58 },
        'EMERALD': { rank: 'EMERALD', avgDeaths: 4.8, avgCS: 7.0, avgVisionScore: 30, avgKillParticipation: 60 },
        'DIAMOND': { rank: 'DIAMOND', avgDeaths: 4.5, avgCS: 7.5, avgVisionScore: 35, avgKillParticipation: 62 },
        'MASTER': { rank: 'MASTER', avgDeaths: 4.2, avgCS: 8.0, avgVisionScore: 40, avgKillParticipation: 65 },
        'GRANDMASTER': { rank: 'GRANDMASTER', avgDeaths: 4.0, avgCS: 8.5, avgVisionScore: 45, avgKillParticipation: 68 },
        'CHALLENGER': { rank: 'CHALLENGER', avgDeaths: 3.8, avgCS: 9.0, avgVisionScore: 50, avgKillParticipation: 70 },
        'UNRANKED': { rank: 'UNRANKED', avgDeaths: 6.5, avgCS: 5.5, avgVisionScore: 18, avgKillParticipation: 50 }
    };

    const normalizedRank = rank.toUpperCase();
    return rankData[normalizedRank] || rankData['UNRANKED'];
}
