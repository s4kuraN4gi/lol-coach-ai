'use server';

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchMatchDetail, fetchMatchTimeline, fetchLatestVersion, extractMatchEvents, TruthEvent, fetchDDItemData } from "./riot";
import { getAnalysisStatus } from "./analysis";
import { WEEKLY_ANALYSIS_LIMIT } from "./constants";
import macroKnowledge from "@/data/macro_knowledge.json";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

// ============================================================
// TYPES
// ============================================================

export type VideoMacroSegment = {
    segmentId: number;
    type: 'OBJECTIVE' | 'DEATH' | 'TURNING_POINT';
    targetTimestamp: number;      // Game time in ms
    targetTimestampStr: string;   // "mm:ss"
    analysisStartTime: number;    // 30 seconds before target
    analysisEndTime: number;      // Target time
    eventDescription: string;     // What happened at this timestamp
};

export type VideoMacroAnalysisRequest = {
    matchId: string;
    puuid: string;
    segments: VideoMacroSegment[];
    frames: {
        segmentId: number;
        frameIndex: number;
        gameTime: number;
        base64Data: string;  // Base64 image data
    }[];
};

export type SegmentAnalysis = {
    segmentId: number;
    type: 'OBJECTIVE' | 'DEATH' | 'TURNING_POINT';
    timestamp: string;

    // What we observed
    observation: {
        userPosition: string;        // Where was the user on minimap
        allyPositions: string;       // Where were allies
        enemyPositions: string;      // Visible enemy positions
        waveState: string;           // Wave positions on minimap
        objectiveState: string;      // Dragon/Baron timer if visible
    };

    // The winning pattern
    winningPattern: {
        title: string;               // e.g., "ドラゴン準備の正しい動き"
        steps: string[];             // Step-by-step what should happen
        macroConceptUsed: string;    // e.g., "Push and Rotate"
    };

    // What actually happened vs winning pattern
    gap: {
        description: string;         // The difference
        criticalMoment: string;      // When the decision diverged
        whatShouldHaveDone: string;  // Specific action
    };
};

export type BuildItem = {
    id: number;
    itemName: string;
};

export type BuildRecommendation = {
    userItems: BuildItem[];
    userChampionName: string;
    opponentItems: BuildItem[];
    opponentChampionName: string;
    recommendedItems: BuildItem[];
    analysis: string;  // AI-generated advice
};

export type VideoMacroAnalysisResult = {
    success: boolean;
    matchId: string;
    analyzedAt: string;
    segments: SegmentAnalysis[];
    overallSummary: {
        mainIssue: string;           // The biggest macro problem
        homework: {
            title: string;
            description: string;
            howToCheck: string;
            relatedTimestamps: string[];  // Related scene timestamps for review
        };
    };
    buildRecommendation?: BuildRecommendation;  // Build advice
    error?: string;
    warnings?: string[];  // Segment-level errors or warnings
    requestedSegments?: number;  // How many segments were requested
    completedSegments?: number;  // How many were successfully analyzed
};

// ============================================================
// TIME DETECTION FROM FRAME
// ============================================================

/**
 * Detect in-game time from a video frame using Gemini vision
 * The game clock is displayed in the top-center of the screen
 */
export async function detectGameTimeFromFrame(
    frameBase64: string,
    userApiKey?: string
): Promise<{ success: boolean; gameTimeSeconds?: number; gameTimeStr?: string; error?: string }> {
    const apiKey = userApiKey || GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return { success: false, error: "API Key not found" };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0
            }
        });

        const prompt = `この画像はLeague of Legendsのゲーム画面です。
画面上部中央に表示されているゲーム内時間（タイマー）を読み取ってください。

時間は通常「mm:ss」形式で表示されています（例: 15:30, 8:45, 23:12など）。

【出力形式 (JSON)】
{
    "detected": true または false,
    "timeStr": "mm:ss形式の時間文字列",
    "minutes": 分の数値,
    "seconds": 秒の数値
}

時間が読み取れない場合は detected: false としてください。`;

        // Parse base64 data
        const matches = frameBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return { success: false, error: "Invalid base64 format" };
        }

        const parts = [
            prompt,
            { inlineData: { data: matches[2], mimeType: matches[1] } }
        ];

        const result = await model.generateContent(parts);
        const text = result.response.text()
            .replace(/^```json\s*/, "")
            .replace(/^```\s*/, "")
            .replace(/\s*```$/, "");

        const data = JSON.parse(text);

        if (data.detected && typeof data.minutes === 'number' && typeof data.seconds === 'number') {
            const totalSeconds = data.minutes * 60 + data.seconds;
            return {
                success: true,
                gameTimeSeconds: totalSeconds,
                gameTimeStr: data.timeStr || `${data.minutes}:${data.seconds.toString().padStart(2, '0')}`
            };
        } else {
            return { success: false, error: "ゲーム内時間を検出できませんでした" };
        }
    } catch (error: any) {
        console.error("[detectGameTimeFromFrame] Error:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// SEGMENT SELECTION LOGIC
// ============================================================

/**
 * Select 5 key segments from match events for macro analysis
 * Priority: Dragon/Baron > Deaths near objectives > Other deaths
 */
export async function selectAnalysisSegments(
    matchId: string,
    puuid: string
): Promise<{ success: boolean; segments?: VideoMacroSegment[]; error?: string }> {
    try {
        const [matchRes, timelineRes] = await Promise.all([
            fetchMatchDetail(matchId),
            fetchMatchTimeline(matchId)
        ]);

        if (!matchRes.success || !matchRes.data) {
            return { success: false, error: "Failed to fetch match data" };
        }
        if (!timelineRes.success || !timelineRes.data) {
            return { success: false, error: "Failed to fetch timeline" };
        }

        // Extract events
        const events = await extractMatchEvents(timelineRes.data, puuid);

        // Categorize events
        const objectiveEvents = events.filter(e =>
            e.type === 'OBJECTIVE' && e.context?.isAllyObjective === false
        );
        const deathEvents = events.filter(e => e.type === 'DEATH');

        // Find turning point (biggest gold swing)
        let turningPoint: TruthEvent | null = null;
        let maxGoldSwing = 0;
        for (const event of events) {
            const goldDiff = Math.abs(event.context?.goldDiff || 0);
            if (goldDiff > maxGoldSwing && event.type !== 'WARD') {
                maxGoldSwing = goldDiff;
                turningPoint = event;
            }
        }

        // Build segments (max 5)
        const segments: VideoMacroSegment[] = [];
        let segmentId = 0;

        // 1. First objective lost (if any)
        if (objectiveEvents.length > 0) {
            const firstObj = objectiveEvents[0];
            segments.push({
                segmentId: segmentId++,
                type: 'OBJECTIVE',
                targetTimestamp: firstObj.timestamp,
                targetTimestampStr: firstObj.timestampStr,
                analysisStartTime: Math.max(0, firstObj.timestamp - 30000),
                analysisEndTime: firstObj.timestamp,
                eventDescription: `敵チームが${firstObj.context?.objectiveType || 'オブジェクト'}を獲得`
            });
        }

        // 2. First death
        if (deathEvents.length > 0 && segments.length < 5) {
            const firstDeath = deathEvents[0];
            segments.push({
                segmentId: segmentId++,
                type: 'DEATH',
                targetTimestamp: firstDeath.timestamp,
                targetTimestampStr: firstDeath.timestampStr,
                analysisStartTime: Math.max(0, firstDeath.timestamp - 30000),
                analysisEndTime: firstDeath.timestamp,
                eventDescription: `${firstDeath.detail}`
            });
        }

        // 3. Second objective or death near objective
        const secondObj = objectiveEvents[1];
        if (secondObj && segments.length < 5) {
            segments.push({
                segmentId: segmentId++,
                type: 'OBJECTIVE',
                targetTimestamp: secondObj.timestamp,
                targetTimestampStr: secondObj.timestampStr,
                analysisStartTime: Math.max(0, secondObj.timestamp - 30000),
                analysisEndTime: secondObj.timestamp,
                eventDescription: `敵チームが${secondObj.context?.objectiveType || 'オブジェクト'}を獲得`
            });
        }

        // 4. Turning point
        if (turningPoint && segments.length < 5) {
            // Check if not already included
            const isDuplicate = segments.some(s =>
                Math.abs(s.targetTimestamp - turningPoint!.timestamp) < 60000
            );
            if (!isDuplicate) {
                segments.push({
                    segmentId: segmentId++,
                    type: 'TURNING_POINT',
                    targetTimestamp: turningPoint.timestamp,
                    targetTimestampStr: turningPoint.timestampStr,
                    analysisStartTime: Math.max(0, turningPoint.timestamp - 30000),
                    analysisEndTime: turningPoint.timestamp,
                    eventDescription: `ターニングポイント: ${turningPoint.detail}`
                });
            }
        }

        // 5. Fill remaining with deaths
        for (const death of deathEvents) {
            if (segments.length >= 5) break;
            const isDuplicate = segments.some(s =>
                Math.abs(s.targetTimestamp - death.timestamp) < 60000
            );
            if (!isDuplicate) {
                segments.push({
                    segmentId: segmentId++,
                    type: 'DEATH',
                    targetTimestamp: death.timestamp,
                    targetTimestampStr: death.timestampStr,
                    analysisStartTime: Math.max(0, death.timestamp - 30000),
                    analysisEndTime: death.timestamp,
                    eventDescription: death.detail
                });
            }
        }

        // Sort by timestamp
        segments.sort((a, b) => a.targetTimestamp - b.targetTimestamp);

        // Re-assign segment IDs after sorting
        segments.forEach((s, idx) => s.segmentId = idx);

        return { success: true, segments };
    } catch (error: any) {
        console.error("[selectAnalysisSegments] Error:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// VIDEO MACRO ANALYSIS PROMPT
// ============================================================

function generateVideoMacroPrompt(
    segment: VideoMacroSegment,
    matchContext: {
        myChampion: string;
        myRole: string;
        myRoleJp: string;
        allies: string[];
        enemies: string[];
        goldDiff: number;
    }
): string {
    // Get relevant macro knowledge
    const gamePhase = segment.targetTimestamp < 14 * 60 * 1000 ? 'early_game' :
                      segment.targetTimestamp < 25 * 60 * 1000 ? 'mid_game' : 'late_game';

    const phaseKnowledge = macroKnowledge.time_phase_priorities[gamePhase as keyof typeof macroKnowledge.time_phase_priorities];
    const gameStateKey = matchContext.goldDiff <= -5000 ? 'losing_hard' :
                         matchContext.goldDiff <= -3000 ? 'losing_slightly' :
                         matchContext.goldDiff >= 5000 ? 'winning_hard' :
                         matchContext.goldDiff >= 3000 ? 'winning_slightly' : 'even';
    const stateKnowledge = macroKnowledge.game_state_strategy[gameStateKey as keyof typeof macroKnowledge.game_state_strategy];

    return `
あなたはLeague of Legendsの「マクロ戦術（マップ全体の動き・ローテーション・オブジェクトコントロール）」に特化した専門コーチです。

【重要：分析の焦点】
- **マクロのみ**: ミクロ（操作、スキル精度）には一切言及しないでください
- **ミニマップを見る**: 全チャンピオンの位置、ウェーブの位置を確認
- **「勝ちパターン」を提示**: この状況で何をすべきだったかを具体的に

【ミニマップの読み方 - 非常に重要】
ミニマップは画面右下に表示されています。レーンの位置は以下の通りです：
- **トップレーン**: ミニマップの**左上〜上部**のライン（マップの北西側）
- **ミッドレーン**: ミニマップの**中央を斜めに**走るライン（左下から右上への対角線）
- **ボットレーン**: ミニマップの**右下〜下部**のライン（マップの南東側）

プレイヤーの位置を判断する際は、必ずミニマップ上のアイコン位置を確認してください。
画面中央の見た目だけで判断しないでください。

【最重要：ユーザー情報と位置の判断方法】
- **ユーザーのチャンピオン: ${matchContext.myChampion}**
- **ユーザーの担当レーン: ${matchContext.myRoleJp}**

【位置判断のルール - 絶対に守ってください】
※このルールに違反すると分析が無効になります

1. **「（画面中央で確認）」という表現は絶対に使わないでください** - これを使うと分析エラーになります
2. **ユーザーの位置は基本的に「${matchContext.myRoleJp}」です** - これがデフォルトです
3. **担当レーン以外を記載する条件**: ミニマップ（画面右下）で${matchContext.myChampion}のアイコンが明らかに別のレーンにある場合のみ
4. **判断できない場合**: 必ず担当レーン（${matchContext.myRoleJp}）と記載してください

【userPositionの正しい書き方】
✅ 正しい例: "${matchContext.myChampion}（${matchContext.myRoleJp}）が${matchContext.myRoleJp}でファーム中"
✅ 正しい例: "${matchContext.myChampion}（${matchContext.myRoleJp}）が${matchContext.myRoleJp}でサポートと行動中"
❌ 間違い: "ミッドレーンで行動中（画面中央で確認）" ← 画面中央で判断してはいけません
❌ 間違い: "${matchContext.myChampion}がミッドレーンにいる" ← 担当レーンと異なる場合はミニマップで明確に確認が必要

【プレイヤー情報】
- ユーザーのチャンピオン: ${matchContext.myChampion}（画面中央に表示）
- ユーザーの担当レーン: **${matchContext.myRoleJp}**
- 味方チーム: ${matchContext.allies.join(', ')}
- 敵チーム: ${matchContext.enemies.join(', ')}
- ゴールド差: ${matchContext.goldDiff}G

【分析対象のシーン】
- タイプ: ${segment.type}
- タイムスタンプ: ${segment.targetTimestampStr}
- 何が起きたか: ${segment.eventDescription}
- 分析範囲: この瞬間の30秒前から

【現在のゲームフェーズ: ${phaseKnowledge?.description || gamePhase}】
${phaseKnowledge?.role_focus?.[matchContext.myRole.toUpperCase() as keyof typeof phaseKnowledge.role_focus] || ''}

【ゴールド状況に基づく戦略】
${stateKnowledge?.general_strategy || ''}
${stateKnowledge?.priorities?.slice(0, 3).join(', ') || ''}

【マクロの基本概念（これらを使って説明してください）】
- Push and Rotate: ウェーブを敵タワーに押してからローテーション
- クロスマッピング: 敵がいる場所の反対側でリソースを取る
- 2ウェーブサイクル: スロープッシュ→クラッシュ→中央受けの繰り返し
- Hit-and-Run: タワーを少し削って離脱、防御バフが切れたら戻る
- オブジェクト準備: スポーン1分前からウェーブを押してポジショニング

【分析してほしいこと】
1. **観察**:
   - **ユーザー(${matchContext.myChampion}/${matchContext.myRoleJp})の現在位置**:
     → 「${matchContext.myChampion}（${matchContext.myRoleJp}）が${matchContext.myRoleJp}で〇〇中」の形式で記載
     → 〇〇には「ファーム」「プッシュ」「ロームor移動」「戦闘」などを入れる
     → 担当レーン（${matchContext.myRoleJp}）以外を記載するのはミニマップで明確に確認できた場合のみ
   - **味方チャンピオンの位置**: ミニマップで確認できる味方4人の位置
   - **見える敵チャンピオンの位置**: ミニマップで確認できる敵の位置（見えない敵は「位置不明」と記載）
   - **ウェーブの位置**: 各レーンのミニオンがどちら側に押されているか

2. **勝ちパターン**: このシーンで取るべきだった動き
   - タイトル（例: "ドラゴン準備の正しい動き"）
   - ステップバイステップの行動（3-4ステップ）
   - 使用したマクロ概念名

3. **ギャップ**: 実際の動きと勝ちパターンの差
   - 何が違ったか
   - どの瞬間に判断を変えるべきだったか
   - 具体的に何をすべきだったか

【出力形式 (JSON)】
※ userPositionは必ず担当レーン（${matchContext.myRoleJp}）を基準に記載してください
※ 「（画面中央で確認）」は絶対に使用禁止です
{
    "observation": {
        "userPosition": "${matchContext.myChampion}（${matchContext.myRoleJp}）が${matchContext.myRoleJp}でファーム中",
        "allyPositions": "味方トップがサイドプッシュ、味方JGがボット側ジャングル",
        "enemyPositions": "敵ミッドとJGの位置不明、敵ADCがボットレーン",
        "waveState": "トップが味方側にプッシュ中、ミッドは中央、ボットは敵側に押している",
        "objectiveState": "ドラゴン残り45秒"
    },
    "winningPattern": {
        "title": "ドラゴン獲得のための準備",
        "steps": [
            "1. ミッドウェーブを敵タワーに押し切る",
            "2. ボットリバーに移動してワード設置",
            "3. ADCとサポートと合流",
            "4. JGのドラゴン開始をサポート"
        ],
        "macroConceptUsed": "Push and Rotate"
    },
    "gap": {
        "description": "ウェーブを押さずにミッドに留まっていた",
        "criticalMoment": "ドラゴン1分前（4:00）の時点でウェーブを押す判断をすべきだった",
        "whatShouldHaveDone": "4:00の時点でウェーブをハードプッシュし、4:20にはリバーに移動開始すべきだった"
    }
}
`;
}

// ============================================================
// MAIN ANALYSIS FUNCTION
// ============================================================

export async function analyzeVideoMacro(
    request: VideoMacroAnalysisRequest,
    userApiKey?: string
): Promise<VideoMacroAnalysisResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "Not authenticated" };
    }

    // Check limits
    const status = await getAnalysisStatus();
    if (!status) {
        return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "User profile not found" };
    }

    let useEnvKey = false;
    if (status.is_premium) {
        if ((status.weekly_analysis_count || 0) >= WEEKLY_ANALYSIS_LIMIT) {
            return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: `週間制限に達しました (${status.weekly_analysis_count}/${WEEKLY_ANALYSIS_LIMIT})` };
        }
        useEnvKey = true;
    } else {
        if (userApiKey) {
            useEnvKey = false;
        } else if (status.analysis_credits > 0) {
            useEnvKey = true;
        } else {
            return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "クレジットが不足しています" };
        }
    }

    const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
    if (!apiKeyToUse) {
        return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "API Key not found" };
    }

    try {
        // Fetch match context
        const matchRes = await fetchMatchDetail(request.matchId);
        if (!matchRes.success || !matchRes.data) {
            return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "Failed to fetch match data" };
        }

        const participants = matchRes.data.info.participants;
        const me = participants.find((p: any) => p.puuid === request.puuid);
        if (!me) {
            return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: "Player not found in match" };
        }

        const myTeamId = me.teamId;
        const allies = participants.filter((p: any) => p.teamId === myTeamId && p.puuid !== request.puuid)
            .map((p: any) => `${p.championName}(${p.teamPosition})`);
        const enemies = participants.filter((p: any) => p.teamId !== myTeamId)
            .map((p: any) => `${p.championName}(${p.teamPosition})`);

        // Convert role to more descriptive Japanese
        const roleMap: Record<string, string> = {
            'TOP': 'トップレーン',
            'JUNGLE': 'ジャングル',
            'MIDDLE': 'ミッドレーン',
            'BOTTOM': 'ボットレーン(ADC)',
            'UTILITY': 'ボットレーン(サポート)'
        };
        const myRoleJp = roleMap[me.teamPosition] || me.teamPosition;

        const matchContext = {
            myChampion: me.championName,
            myRole: me.teamPosition,
            myRoleJp: myRoleJp,
            allies,
            enemies,
            goldDiff: 0  // Will be updated per segment if frame data available
        };

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });

        // Start build recommendation generation in parallel (non-blocking)
        console.log('[VideoMacro] Starting build recommendation generation in parallel...');
        const buildPromise = generateBuildRecommendation(matchRes.data, request.puuid, model);

        // Analyze each segment with rate limit handling
        const segmentResults: SegmentAnalysis[] = [];
        const segmentErrors: string[] = [];

        console.log(`[VideoMacro] Starting analysis of ${request.segments.length} segments`);

        // Helper function for delay
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Helper function to call Gemini with retry logic
        const callGeminiWithRetry = async (parts: any[], maxRetries: number = 3): Promise<string> => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await model.generateContent(parts);
                    return result.response.text();
                } catch (error: any) {
                    const is429 = error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('Resource exhausted');

                    if (is429 && attempt < maxRetries) {
                        // Exponential backoff: 2s, 4s, 8s
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`[VideoMacro] Rate limited, waiting ${waitTime}ms before retry (attempt ${attempt}/${maxRetries})`);
                        await delay(waitTime);
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries exceeded');
        };

        for (let i = 0; i < request.segments.length; i++) {
            const segment = request.segments[i];
            console.log(`[VideoMacro] Processing segment ${segment.segmentId} (${segment.type}) [${i + 1}/${request.segments.length}]`);

            // Add delay between segments to avoid rate limiting (except for first segment)
            if (i > 0) {
                console.log(`[VideoMacro] Waiting 1.5s before next segment to avoid rate limiting...`);
                await delay(1500);
            }

            // Get frames for this segment
            const segmentFrames = request.frames.filter(f => f.segmentId === segment.segmentId);

            if (segmentFrames.length === 0) {
                const errorMsg = `Segment ${segment.segmentId}: No frames available`;
                console.warn(`[VideoMacro] ${errorMsg}`);
                segmentErrors.push(errorMsg);
                continue;
            }

            console.log(`[VideoMacro] Segment ${segment.segmentId} has ${segmentFrames.length} frames`);

            // Build prompt
            const prompt = generateVideoMacroPrompt(segment, matchContext);

            // Build parts array with images
            const parts: any[] = [prompt];
            for (const frame of segmentFrames) {
                const matches = frame.base64Data.match(/^data:(.+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    parts.push({
                        inlineData: { data: matches[2], mimeType: matches[1] }
                    });
                }
            }

            try {
                console.log(`[VideoMacro] Calling Gemini for segment ${segment.segmentId}...`);
                const text = await callGeminiWithRetry(parts);
                const cleanedText = text
                    .replace(/^```json\s*/, "")
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");

                console.log(`[VideoMacro] Segment ${segment.segmentId} response received, parsing JSON...`);
                const analysisData = JSON.parse(cleanedText);

                segmentResults.push({
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    gap: analysisData.gap
                });
                console.log(`[VideoMacro] Segment ${segment.segmentId} analysis complete`);
            } catch (segmentError: any) {
                const errorMsg = `Segment ${segment.segmentId}: ${segmentError.message || 'Unknown error'}`;
                console.error(`[VideoMacro] ${errorMsg}`, segmentError);
                segmentErrors.push(errorMsg);
                // Continue with other segments
            }
        }

        console.log(`[VideoMacro] Analysis complete: ${segmentResults.length}/${request.segments.length} segments successful`);
        if (segmentErrors.length > 0) {
            console.warn(`[VideoMacro] Segment errors: ${segmentErrors.join(', ')}`);
        }

        // Generate overall summary from segment results
        const overallSummary = generateOverallSummary(segmentResults);

        // Wait for build recommendation to complete (was running in parallel)
        console.log('[VideoMacro] Waiting for build recommendation to complete...');
        const buildRecommendation = await buildPromise;
        if (buildRecommendation) {
            console.log('[VideoMacro] Build recommendation completed successfully');
        } else {
            console.log('[VideoMacro] Build recommendation returned null (may have failed)');
        }

        // Update usage count
        if (status.is_premium) {
            await supabase.from("profiles").update({
                weekly_analysis_count: (status.weekly_analysis_count || 0) + 1
            }).eq("id", user.id);
        } else if (!userApiKey && useEnvKey) {
            await supabase.from("profiles").update({
                analysis_credits: status.analysis_credits - 1
            }).eq("id", user.id);
        }

        return {
            success: true,
            matchId: request.matchId,
            analyzedAt: new Date().toISOString(),
            segments: segmentResults,
            overallSummary,
            buildRecommendation: buildRecommendation || undefined,
            warnings: segmentErrors.length > 0 ? segmentErrors : undefined,
            requestedSegments: request.segments.length,
            completedSegments: segmentResults.length
        };

    } catch (error: any) {
        console.error("[analyzeVideoMacro] Error:", error);
        return {
            success: false,
            matchId: request.matchId,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } },
            error: error.message
        };
    }
}

function generateOverallSummary(segments: SegmentAnalysis[]): {
    mainIssue: string;
    homework: {
        title: string;
        description: string;
        howToCheck: string;
        relatedTimestamps: string[];
    };
} {
    if (segments.length === 0) {
        return {
            mainIssue: '分析データがありません',
            homework: {
                title: '再度分析を実行してください',
                description: '',
                howToCheck: '',
                relatedTimestamps: []
            }
        };
    }

    // Count macro concepts mentioned
    const conceptCounts: Record<string, number> = {};
    for (const seg of segments) {
        const concept = seg.winningPattern?.macroConceptUsed || '';
        if (concept) {
            conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
        }
    }

    // Find most common issue
    const mostCommonConcept = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Push and Rotate';

    // Generate summary based on segment types
    const hasObjectiveIssues = segments.some(s => s.type === 'OBJECTIVE');
    const hasDeathIssues = segments.some(s => s.type === 'DEATH');

    let mainIssue = '';
    if (hasObjectiveIssues && hasDeathIssues) {
        mainIssue = 'オブジェクト前の準備不足とポジショニングミスが連動して負けパターンを作っています';
    } else if (hasObjectiveIssues) {
        mainIssue = 'オブジェクトタイマーを意識した事前準備（ウェーブプッシュ、ポジショニング）が不足しています';
    } else if (hasDeathIssues) {
        mainIssue = 'マップ全体の状況を見ずに単独行動してデスするパターンが見られます';
    } else {
        mainIssue = 'マクロの意思決定タイミングを改善する必要があります';
    }

    // Extract related timestamps from segments that use the most common concept
    const relatedTimestamps = segments
        .filter(seg => seg.winningPattern?.macroConceptUsed === mostCommonConcept)
        .map(seg => seg.timestamp)
        .slice(0, 5); // Max 5 timestamps

    return {
        mainIssue,
        homework: {
            title: mostCommonConcept,
            description: getHomeworkDescription(mostCommonConcept),
            howToCheck: getHomeworkCheckCriteria(mostCommonConcept),
            relatedTimestamps
        }
    };
}

function getHomeworkDescription(concept: string): string {
    const descriptions: Record<string, string> = {
        'Push and Rotate': 'ローテーションする前に必ずウェーブを敵タワーに押し切る。これにより敵にジレンマを与え、自分は安全に移動できる。',
        'クロスマッピング': '敵が5人でプッシュしている時は、同じ場所に行かず反対サイドでタワーやファームを取る。',
        '2ウェーブサイクル': '第1ウェーブでスロープッシュ→第2ウェーブでクラッシュ→次は中央で受ける、を繰り返す。',
        'Hit-and-Run': 'タワーを一気に取ろうとせず、少し削って離脱→防御バフが切れたら戻る、を繰り返す。',
        'オブジェクト準備': 'ドラゴン/バロンスポーン1分前にはウェーブを押し、30秒前にはオブジェクト周辺にいる。'
    };
    return descriptions[concept] || 'マクロの基本概念を意識してプレイする';
}

function getHomeworkCheckCriteria(concept: string): string {
    const criteria: Record<string, string> = {
        'Push and Rotate': '次の試合で、ローテーション前にウェーブを押せた回数を数える（目標: 5回以上）',
        'クロスマッピング': 'ビハインド時に敵と同じ場所でファイトした回数を0にする',
        '2ウェーブサイクル': 'レーン戦でスロープッシュ→クラッシュのサイクルを3回以上成功させる',
        'Hit-and-Run': 'タワーダイブで死んだ回数を0にする',
        'オブジェクト準備': 'オブジェクトスポーン時にピット周辺にいた割合を50%以上にする'
    };
    return criteria[concept] || '次の試合で意識してプレイする';
}

// ============================================================
// BUILD RECOMMENDATION GENERATION
// ============================================================

async function generateBuildRecommendation(
    matchData: any,
    puuid: string,
    model: any
): Promise<BuildRecommendation | null> {
    try {
        console.log('[VideoMacro] Generating build recommendation...');

        // Fetch item data from Data Dragon for name resolution
        const itemData = await fetchDDItemData();
        const getItemName = (itemId: number): string => {
            if (!itemData?.idMap) return `Item #${itemId}`;
            const item = itemData.idMap[String(itemId)];
            return item?.name || `Item #${itemId}`;
        };

        // Find user and opponent
        const participants = matchData.info.participants;
        const me = participants.find((p: any) => p.puuid === puuid);
        if (!me) return null;

        // Find lane opponent (same lane, different team)
        const myTeam = me.teamId;
        const myPosition = me.teamPosition;
        const opponent = participants.find((p: any) =>
            p.teamId !== myTeam && p.teamPosition === myPosition
        );

        // Extract items (items 0-5 are the 6 item slots)
        const extractItems = (participant: any): BuildItem[] => {
            const items: BuildItem[] = [];
            for (let i = 0; i <= 5; i++) {
                const itemId = participant[`item${i}`];
                if (itemId && itemId > 0) {
                    items.push({ id: itemId, itemName: getItemName(itemId) });
                }
            }
            return items;
        };

        const userItems = extractItems(me);
        const opponentItems = opponent ? extractItems(opponent) : [];

        // Generate AI advice
        const prompt = `
あなたはLoLのビルドコーチです。以下の情報を基に、ビルドアドバイスを日本語で提供してください。

【試合情報】
- ユーザーチャンピオン: ${me.championName}
- ユーザーのロール: ${myPosition}
- ユーザーのビルド（アイテムID）: ${userItems.map(i => i.id).join(', ') || 'なし'}
- 対面チャンピオン: ${opponent?.championName || '不明'}
- 対面のビルド（アイテムID）: ${opponentItems.map(i => i.id).join(', ') || '不明'}
- 試合結果: ${me.win ? '勝利' : '敗北'}
- KDA: ${me.kills}/${me.deaths}/${me.assists}

【分析してほしいこと】
1. ユーザーのビルドの良かった点
2. 改善すべき点（対面や敵チーム構成を考慮）
3. 推奨ビルド（コアアイテム3つ程度）

【出力形式 (JSON)】
{
    "analysis": "ビルドの分析とアドバイス（3-4文）",
    "recommendedItemIds": [アイテムID, アイテムID, アイテムID]
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text()
            .replace(/^```json\s*/, "")
            .replace(/^```\s*/, "")
            .replace(/\s*```$/, "");

        const aiResponse = JSON.parse(text);

        const recommendedItems: BuildItem[] = (aiResponse.recommendedItemIds || []).map((id: number) => ({
            id,
            itemName: getItemName(id)
        }));

        console.log('[VideoMacro] Build recommendation generated');

        return {
            userItems,
            userChampionName: me.championName,
            opponentItems,
            opponentChampionName: opponent?.championName || '不明',
            recommendedItems,
            analysis: aiResponse.analysis || 'ビルドアドバイスを生成できませんでした'
        };
    } catch (error: any) {
        console.error('[VideoMacro] Build recommendation error:', error.message);
        return null;
    }
}
