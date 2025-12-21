'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData, fetchRank, fetchLatestVersion } from "./riot";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisMode, getPersonaPrompt, getModePrompt } from './promptUtils';

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
    opponentItems?: BuildItem[];
    opponentChampionName?: string;
    recommendedItems: BuildItem[];
    analysis: string; // "Why X is better than Y"
};

export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildComparison; // Renamed from BuildRecommendation
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

        // 4. Summarize Timeline (Filter by Mode)
        const mode = focus?.mode || 'MACRO'; // Default to Macro if not specified
        const events = summarizeTimeline(timeline, userPart.participantId, opponentPart?.participantId, mode);

        // 5. Prompt Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        
        // Use the new versatile prompt generator
        const systemPrompt = generateSystemPrompt(
            rankTier, 
            mode, 
            userItems, 
            opponentItemsStr, 
            events, 
            userPart, 
            opponentPart, 
            focus,
            latestVersion
        );

        let responseText = "";
        let usedModel = "";
        let analysisResult: any = null;

        // 6. Generate AI Content with Retries
        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`Trying Gemini Model: ${modelName}`);
                const genAI = new GoogleGenerativeAI(apiKeyToUse);
                const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

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
                 id: id // 0 if not found, UI should handle missing icon
             };
        });

        const finalResult: AnalysisResult = {
            insights: analysisResult.insights,
            buildRecommendation: {
                userItems: userItems,
                opponentItems: opponentItems,
                opponentChampionName: opponentPart?.championName || "Unknown",
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

// Helper: Generate System Prompt based on Mode and Rank

function generateSystemPrompt(
    rank: string, // e.g. "GOLD", "IRON", "CHALLENGER"
    mode: 'LANING' | 'MACRO' | 'TEAMFIGHT',
    userItems: BuildItem[],
    opponentItemsStr: string,
    events: any[],
    userPart: any,
    opponentPart: any,
    focus?: AnalysisFocus,
    patchVersion: string = "14.24.1"
) {
    // 1. Determine Persona based on Rank (Shared Logic)
    const personaInstruction = getPersonaPrompt(rank);

    // 2. Mode Specific Instructions (Shared Logic)
    const modeInstruction = getModePrompt(mode);

    // 3. User Focus
    let focusInstruction = "";
    if (focus) {
        focusInstruction = `
        【ユーザーからの具体的な質問】
        興味ある領域: ${focus.focusArea || "指定なし"}
        ${focus.specificQuestion ? `具体的な悩み: "${focus.specificQuestion}"` : ""}
        
        この質問に対する回答を最優先に含めてください。
        `;
    }

    return `
    ${personaInstruction}
    
    【重要：前提条件】
    - 現在のパッチバージョン: **${patchVersion}**
    - **禁止事項**: 以下の削除されたアイテムは絶対に推奨しないでください。
      - ミシックアイテム全般（ディヴァイン サンダラー、ゴアドリンカー、エバーフロスト、ガレッドフォース等）
      - ヘクステック・ガンブレード (Hextech Gunblade)
      - 削除されたルーン（リーサルテンポ等）
    - 必ず最新のアイテム環境（Map 14, Season 2024/2025）に基づいてアドバイスしてください。

    以下の試合データに基づき、選択されたモード「${mode}」に特化したコーチングを行ってください。

    ${modeInstruction}
    ${focusInstruction}

    1. **タイムライン分析 (Insights)**:
       試合の流れに沿ったアドバイス。最大2〜3文で、具体的かつ説得力のある内容にしてください。
       **【超重要】必ず「6個以上」のインサイトを出力してください。数が少ないと分析として不十分です。**

    2. **ビルド比較 (Build Comparison)**:
       ユーザーが実際に購入したアイテムと、この試合（対面・敵構成・敵のビルド状況）で理想的だったアイテム構成を比較し、
       「なぜユーザーの選択が間違いだったのか（あるいは正しかったのか）」を解説してください。
       - 実際のビルド: ${userItems.map(i => i.itemName).join(', ')}
       - 対面のビルド: ${opponentItemsStr}
       - 特に「靴」「コアアイテム(1-3手目)」の選択ミスがあれば厳しく指摘してください。
       - **【重要】「対面（${opponentPart ? opponentPart.championName : '不明'}）のアイテム状況（MR/Armor積みなど）を加味して、なぜそのアイテムが有効か」を具体的に述べてください。**

    【重要：出力スタイルの制約】
    - **日本語**: 自然な日本語で出力してください。
    - **アイテム名**: 正式な日本語名（例：ディヴァイン サンダラー）を使用してください。

    【コンテキスト】
    - ユーザー: ${userPart.championName} (${userPart.teamPosition})
    - ランク帯: ${rank.toUpperCase()}
    - KDA: ${userPart.kills}/${userPart.deaths}/${userPart.assists}
    - 対面: ${opponentPart ? opponentPart.championName : '不明'}

    【重要: マクロ分析とデス診断のルール】
    提供されたデータには詳細なコンテキストが含まれています。以下の基準で厳密に分析してください。

    1. **カテゴリ: SOLO_KILL_LOSS (1v1敗北)**
       - コンテキスト: \`isSolo: true\`
       - **厳禁**: 「ガンク」や「人数差」を言い訳にすること。
       - **指摘点**: スキル精度、ダメージ計算ミス、無理なトレード、サモナースペルの差、カウンター関係の理解不足。

    2. **カテゴリ: GANK_OR_TEAMFIGHT (ガンク/集団戦敗北)**
       - **Check 1: 視界 (\`nearbyVision: false\`)**:
         - 文字通り「直近90秒間、周辺2000ユニット以内にワードが置かれていない」ことを検知済みです。
         - アドバイス: 「ワードを置いていれば防げた」「視界管理の甘さ」を強く指摘してください。
       - **Check 2: 所持ゴールド (\`goldOnHand > 1000\`)**:
         - 1000G以上持った（=装備更新可能な）状態でデスしています。
         - アドバイス: 「リコールタイミングの遅れ」「装備差（相手は買い物済みかも）による敗北」を指摘してください。
       - **Check 3: 生存時間 (\`timeAliveMins\`)**:
         - 極端に長時間生存していた後のデスなら「欲張りすぎ（Overstay）」を指摘。
         - 復帰直後のデスなら「プレイの雑さ」を指摘。

    【タイムラインイベント (解析済みデータ)】
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
            "analysis": string (ユーザーのビルドと推奨ビルドの比較解説。200文字程度。)
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
