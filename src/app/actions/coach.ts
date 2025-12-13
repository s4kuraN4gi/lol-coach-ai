'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail } from "./riot";
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
    itemName: string;
    reason: string;
};

export type BuildRecommendation = {
    coreItems: BuildItem[];
    situationalItems: BuildItem[];
};

export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildRecommendation;
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
        const [timelineRes, matchRes] = await Promise.all([
            fetchMatchTimeline(matchId),
            fetchMatchDetail(matchId)
        ]);

        if (!timelineRes.success || !timelineRes.data) return { success: false, error: "Failed to fetch timeline" };
        if (!matchRes.success || !matchRes.data) return { success: false, error: "Failed to fetch match details" };

        const timeline = timelineRes.data;
        const match = matchRes.data;

        // 2. Build Match Context
        const context = getMatchContext(match, puuid);
        if (!context) return { success: false, error: "Participant analysis failed" };

        const { userPart, opponentPart } = context;

        // 3. Summarize Timeline
        const events = summarizeTimeline(timeline, userPart.participantId, opponentPart?.participantId);

        // 4. Prompt Gemini with Fallback Logic
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
        以下の試合タイムラインと構成を分析し、ユーザーへ以下の2点を提供してください。

        1. **タイムライン分析 (Insights)**: 試合の流れに応じた具体的なアドバイス。
        2. **おすすめビルド提案 (Build)**: この試合（対面・敵構成）に対して最適だったアイテム構成。

        【重要：出力スタイルの厳格な制約】
        - **超簡潔に**: パッと見て分かるように、説明は**最大2行以内**に収めてください。
        - **箇条書きベース**: 長文は禁止です。
        - **日本語**: 自然な日本語で。
        - **マクロ重視**: ミクロ（操作）より判断（マクロ）を指摘してください。

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
                    "title": string (短い見出し 例: "リコール判断ミス"),
                    "description": string (状況説明 1行),
                    "type": "MISTAKE" | "TURNING_POINT" | "GOOD_PLAY" | "INFO",
                    "advice": string (簡潔な改善案 1-2行)
                }
            ],
            "buildRecommendation": {
                "coreItems": [
                    { "itemName": "アイテム名(英語正式名称優先)", "reason": "短い採用理由" },
                    { "itemName": "アイテム名", "reason": "短い採用理由" },
                    { "itemName": "アイテム名", "reason": "短い採用理由" }
                ],
                "situationalItems": [
                    { "itemName": "アイテム名", "reason": "短い採用理由" },
                    { "itemName": "アイテム名", "reason": "短い採用理由" }
                ]
            }
        }
        `;

        let lastError = null;
        let analysisResult: AnalysisResult | null = null;

        // Try primary model first (manually instantiated for clarity in loop)
        // Actually, the loop handles everything.
        
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

        return { success: true, data: analysisResult };

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
