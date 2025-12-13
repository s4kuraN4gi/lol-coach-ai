'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData } from "./riot";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

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
    recommendedItems: BuildItem[];
    analysis: string; // "Why X is better than Y"
};

export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildComparison; // Renamed from BuildRecommendation
};

// Fallback sequence: Stable 2.0 -> New 2.5 -> Legacy Standard
const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];

export type AnalysisFocus = {
    focusArea: string; // e.g., "LANING", "TEAMFIGHT", "MACRO", "BUILD", "VISION"
    focusTime?: string; // e.g., "12:30"
    specificQuestion?: string;
};

export async function analyzeMatchTimeline(
    matchId: string, 
    puuid: string, 
    userApiKey?: string,
    focus?: AnalysisFocus 
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
        const [timelineRes, matchRes, ddItemRes] = await Promise.all([
            fetchMatchTimeline(matchId),
            fetchMatchDetail(matchId),
            fetchDDItemData()
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

        // 3. Extract User's Actual Build (End Game Items)
        const userItemIds = [
            userPart.item0, userPart.item1, userPart.item2, 
            userPart.item3, userPart.item4, userPart.item5
        ].filter(id => id > 0);

        const userItems: BuildItem[] = userItemIds.map(id => ({
            id,
            itemName: idMap[id]?.name || `Item ${id}`
        }));

        // 4. Summarize Timeline
        const events = summarizeTimeline(timeline, userPart.participantId, opponentPart?.participantId);

        // 5. Prompt Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        
        // --- Construct Prompt based on Focus ---
        let focusInstruction = "";
        if (focus) {
            focusInstruction = `
            【ユーザーからの具体的な指示】
            興味ある領域: ${focus.focusArea || "指定なし（全体）"}
            ${focus.focusTime ? `注目してほしい時間帯: ${focus.focusTime}付近` : ""}
            ${focus.specificQuestion ? `具体的な質問・悩み: "${focus.specificQuestion}"` : ""}
            
            指示がある場合は、その内容に対する回答を最優先し、それに関連するイベントを深く掘り下げてください。
            `;
        }
        
        const prompt = `
        あなたはプロのLoLコーチ（日本の高レートプレイヤー）です。
        以下の試合データに基づき「詳細な分析」と「ビルド比較評価」を行ってください。

        1. **タイムライン分析 (Insights)**:
           試合の流れに沿ったアドバイス。最大2〜3文で、具体的かつ説得力のある内容にしてください。

        2. **ビルド比較 (Build Comparison)**:
           ユーザーが実際に購入したアイテムと、この試合（対面・敵構成）で理想的だったアイテム構成を比較し、
           「なぜユーザーの選択が間違いだったのか（あるいは正しかったのか）」を解説してください。
           - 実際のビルド: ${userItems.map(i => i.itemName).join(', ')}
           - 特に「靴」「コアアイテム(1-3手目)」の選択ミスがあれば厳しく指摘してください。

        【重要：出力スタイルの制約】
        - **日本語**: 自然な日本語で出力してください。
        - **アイテム名**: 正確な日本語名（例：ディヴァイン サンダラー）を使用してください。

        ${focusInstruction}

        【コンテキスト】
        - ユーザー: ${userPart.championName} (${userPart.teamPosition})
        - KDA: ${userPart.kills}/${userPart.deaths}/${userPart.assists}
        - 対面: ${opponentPart ? opponentPart.championName : '不明'}

        【タイムラインイベント】
        ${JSON.stringify(events)}

        【出力形式 (JSON)】
        以下のJSON形式のみを出力してください。Markdownバッククォートは不要です。

        {
            "insights": [
                {
                    "timestamp": number (ms),
                    "timestampStr": string ("mm:ss"),
                    "title": string (短い見出し),
                    "description": string (状況説明),
                    "type": "MISTAKE" | "TURNING_POINT" | "GOOD_PLAY" | "INFO",
                    "advice": string (2-3文のアドバイス)
                }
            ],
            "buildRecommendation": {
                "recommendedItems": [
                    { "itemName": "アイテム名(日本語)", "reason": "短い採用理由" },
                    { "itemName": "アイテム名", "reason": "短い採用理由" },
                    { "itemName": "アイテム名", "reason": "短い採用理由" }
                    // 3〜4つ程度（靴含む）
                ],
                "analysis": string (ユーザーのビルドと推奨ビルドの比較解説。なぜそのアイテムが必要だったのか、ユーザーのビルドのどこが悪かったのかを具体的に解説。200文字程度。)
            }
        }
        `;

        let lastError = null;
        let analysisResult: any = null; // Temporary any
        
        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`Trying Gemini Model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                if (!text) throw new Error("Empty response");
                
                analysisResult = JSON.parse(text);
                console.log(`Success with model: ${modelName}`);
                break; // Success!
            } catch (e: any) {
                console.warn(`Model ${modelName} failed:`, e.message);
                lastError = e;
                continue;
            }
        }

        if (!analysisResult) {
            throw lastError || new Error("All AI models failed to generate content.");
        }

        // --- Post-Process: Map Recommended Names to IDs ---
        // Requires precise name matching. If strict user builds are passed, AI might return them back.
        // We will do a best-effort reverse lookup using nameMap.

        const recommendedWithIds = analysisResult.buildRecommendation.recommendedItems.map((item: any) => {
            const lowerName = item.itemName.toLowerCase().replace(/\s+/g, ''); // Simple normalization
            // Try explicit lookup
             let id = 0;
             // Search in nameMap values or keys
             // Japanese name in DDragon `name` field? Yes.
             
             // Name map is Key(Lower Name) -> ID.
             // We need to match AI output (Japanese) to DDragon JA name.
             // Try exact match first
             for (const [key, val] of Object.entries(itemMap)) {
                  if (key.replace(/\s+/g, '') === lowerName) {
                      id = parseInt(val);
                      break;
                  }
             }
             
             return {
                 ...item,
                 id: id // 0 if not found, UI should handle missing icon
             };
        });

        const finalResult: AnalysisResult = {
            insights: analysisResult.insights,
            buildRecommendation: {
                userItems: userItems,
                recommendedItems: recommendedWithIds,
                analysis: analysisResult.buildRecommendation.analysis
            }
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

// Helper: Summarize Timeline (Heuristic with Objectives)
function summarizeTimeline(timeline: any, userId: number, opponentId?: number) {
    const events: any[] = [];
    const frames = timeline.info.frames;

    frames.forEach((frame: any) => {
        const relevantEvents = frame.events.filter((e: any) => {
             // 1. Champion Kill (User or Opponent involved)
             if (e.type === 'CHAMPION_KILL') {
                 // User died, User killed, or Opponent killed (important context)
                 return e.victimId === userId || e.killerId === userId || e.assistingParticipantIds?.includes(userId) ||
                        (opponentId && (e.killerId === opponentId || e.victimId === opponentId));
             }
             // 2. Objectives (Dragon, Baron, Rift Herald) - GLOBAL relevance
             if (e.type === 'ELITE_MONSTER_KILL') return true; 
             
             // 3. Turrets (User taking or User losing)
             if (e.type === 'BUILDING_KILL') {
                 return e.killerId === userId || (e.teamId !== 0 && e.teamId === getTeamIdFromPid(userId, timeline) ); 
                 // Note: getting TeamID from PID in timeline is tricky without context, but we can infer.
                 // Actually easier: Just log all building kills, they are macro events.
                 return true;
             }
             
             // 4. Item Purchase (Crucial for Power Spikes)
             if (e.type === 'ITEM_PURCHASED') {
                 return e.participantId === userId || (opponentId && e.participantId === opponentId);
             }

             return false;
        });

        relevantEvents.forEach((e: any) => {
            // Simplify Item events to reduce tokens (only legendary/mythic? or just all for now)
            // Filtering very cheap items might be good optimization later.
            
            events.push({
                type: e.type,
                timestamp: e.timestamp,
                details: formatEventDetails(e, userId, opponentId)
            });
        });
    });

    return events;
}

function formatEventDetails(e: any, uid: number, oid?: number) {
    if (e.type === 'CHAMPION_KILL') {
        if (e.victimId === uid) return `User DIED (Killer: ${e.killerId})`;
        if (e.killerId === uid) return `User KILLED (Victim: ${e.victimId})`;
        if (oid && e.killerId === oid) return `Opponent KILLED someone`;
        if (oid && e.victimId === oid) return `Opponent DIED`;
        return `Teamfight (User Assist)`;
    }
    if (e.type === 'ITEM_PURCHASED') {
        return `${e.participantId === uid ? "User" : "Opponent"} bought Item ${e.itemId}`;
    }
    if (e.type === 'ELITE_MONSTER_KILL') {
        return `${e.monsterType} taken by Killer ${e.killerId}`;
    }
    return e.type;
}

function getTeamIdFromPid(pid: number, timeline: any) {
    // In standard timeline, pids 1-5 are Team 100, 6-10 are Team 200.
    return pid <= 5 ? 100 : 200;
}
