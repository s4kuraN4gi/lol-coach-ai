'use server';

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchMatchDetail, fetchMatchTimeline, fetchLatestVersion, extractMatchEvents, TruthEvent, fetchDDItemData } from "./riot";
import { getAnalysisStatus } from "./analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "./constants";
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
    language?: 'ja' | 'en' | 'ko';  // Output language
    timeOffset?: number;  // Video time offset (videoTime = gameTime + timeOffset)
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
    timeOffset?: number;  // Video time offset for seek (videoTime = gameTime + timeOffset)
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

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
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
            const is429 = error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('Resource exhausted');

            if (is429 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 2000;
                console.log(`[detectGameTimeFromFrame] Rate limited, waiting ${waitTime}ms before retry (attempt ${attempt}/${maxRetries})`);
                await delay(waitTime);
                continue;
            }

            console.error("[detectGameTimeFromFrame] Error:", error);
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: "Max retries exceeded" };
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
    puuid: string,
    language: 'ja' | 'en' | 'ko' = 'ja',
    maxSegments: number = 5  // Free: 2, Premium: 5
): Promise<{ success: boolean; segments?: VideoMacroSegment[]; error?: string }> {
    // Translation templates for event descriptions
    const eventDescriptions = {
        ja: {
            objectiveSecured: (type: string) => `敵チームが${type || 'オブジェクト'}を獲得`,
            turningPoint: (detail: string) => `ターニングポイント: ${detail}`,
            objectiveFallback: 'オブジェクト'
        },
        en: {
            objectiveSecured: (type: string) => `Enemy team secured ${type || 'Objective'}`,
            turningPoint: (detail: string) => `Turning Point: ${detail}`,
            objectiveFallback: 'Objective'
        },
        ko: {
            objectiveSecured: (type: string) => `적 팀이 ${type || '오브젝트'}를 획득`,
            turningPoint: (detail: string) => `터닝 포인트: ${detail}`,
            objectiveFallback: '오브젝트'
        }
    };
    const desc = eventDescriptions[language];
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

        // Extract events (pass language for i18n)
        const events = await extractMatchEvents(timelineRes.data, puuid, undefined, undefined, undefined, language);

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

        // Build segments (max based on plan)
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
                eventDescription: desc.objectiveSecured(firstObj.context?.objectiveType || desc.objectiveFallback)
            });
        }

        // 2. First death
        if (deathEvents.length > 0 && segments.length < maxSegments) {
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
        if (secondObj && segments.length < maxSegments) {
            segments.push({
                segmentId: segmentId++,
                type: 'OBJECTIVE',
                targetTimestamp: secondObj.timestamp,
                targetTimestampStr: secondObj.timestampStr,
                analysisStartTime: Math.max(0, secondObj.timestamp - 30000),
                analysisEndTime: secondObj.timestamp,
                eventDescription: desc.objectiveSecured(secondObj.context?.objectiveType || desc.objectiveFallback)
            });
        }

        // 4. Turning point
        if (turningPoint && segments.length < maxSegments) {
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
                    eventDescription: desc.turningPoint(turningPoint.detail)
                });
            }
        }

        // 5. Fill remaining with deaths
        for (const death of deathEvents) {
            if (segments.length >= maxSegments) break;
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
        myRoleLocalized: string;
        allies: string[];
        enemies: string[];
        goldDiff: number;
    },
    language: 'ja' | 'en' | 'ko' = 'ja'
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

    const roleLabel = matchContext.myRoleLocalized;

    // Full prompt templates for each language
    const prompts = {
        ja: `あなたはLeague of Legendsの「マクロ戦術（マップ全体の動き・ローテーション・オブジェクトコントロール）」に特化した専門コーチです。

**全ての分析テキストを日本語で出力してください。**

【重要：分析の焦点】
- **マクロのみ**: ミクロ（操作、スキル精度）には一切言及しないでください
- **ミニマップを見る**: 全チャンピオンの位置、ウェーブの位置を確認
- **「勝ちパターン」を提示**: この状況で何をすべきだったかを具体的に

【ミニマップの読み方 - 非常に重要】
ミニマップは画面右下に表示されています。レーンの位置は以下の通りです：
- **トップレーン**: ミニマップの**左上〜上部**のライン（マップの北西側）
- **ミッドレーン**: ミニマップの**中央を斜めに**走るライン（左下から右上への対角線）
- **ボットレーン**: ミニマップの**右下〜下部**のライン（マップの南東側）

【プレイヤー情報】
- ユーザーのチャンピオン: ${matchContext.myChampion}
- ユーザーの担当レーン: **${roleLabel}**
- 味方チーム: ${matchContext.allies.join(', ')}
- 敵チーム: ${matchContext.enemies.join(', ')}
- ゴールド差: ${matchContext.goldDiff}G

【分析対象のシーン】
- タイプ: ${segment.type}
- タイムスタンプ: ${segment.targetTimestampStr}
- 何が起きたか: ${segment.eventDescription}

【マクロの基本概念（これらを使って説明してください）】
- Push and Rotate: ウェーブを敵タワーに押してからローテーション
- Cross-mapping: 敵がいる場所の反対側でリソースを取る
- Slow Push: スロープッシュ→クラッシュ→中央受けの繰り返し
- Split Push: サイドレーンでプレッシャーをかける
- Objective Setup: オブジェクトスポーン前にウェーブを押してポジショニング

【出力形式 (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion}が${roleLabel}でファーム中",
        "allyPositions": "味方の位置を記載",
        "enemyPositions": "見える敵の位置（見えない場合は位置不明）",
        "waveState": "各レーンのウェーブ状況",
        "objectiveState": "オブジェクトの状況"
    },
    "winningPattern": {
        "title": "勝ちパターンのタイトル",
        "steps": ["ステップ1", "ステップ2", "ステップ3"],
        "macroConceptUsed": "使用したマクロ概念名（英語）"
    },
    "gap": {
        "description": "実際との差",
        "criticalMoment": "判断を変えるべきだったタイミング",
        "whatShouldHaveDone": "具体的にすべきだったこと"
    }
}`,

        en: `You are an expert League of Legends macro strategy coach specializing in map-wide movement, rotations, and objective control.

**Output ALL analysis text in English.**

【IMPORTANT: Analysis Focus】
- **MACRO ONLY**: Do NOT mention micro (mechanics, skill accuracy)
- **Check Minimap**: Verify all champion positions and wave positions
- **Show "Winning Pattern"**: Be specific about what should have been done

【How to Read the Minimap - Very Important】
The minimap is displayed in the bottom-right corner. Lane positions are:
- **Top Lane**: Upper-left area of the minimap (northwest side)
- **Mid Lane**: Diagonal line through the center (bottom-left to top-right)
- **Bot Lane**: Lower-right area of the minimap (southeast side)

【Player Information】
- User's Champion: ${matchContext.myChampion}
- User's Assigned Lane: **${roleLabel}**
- Allied Team: ${matchContext.allies.join(', ')}
- Enemy Team: ${matchContext.enemies.join(', ')}
- Gold Difference: ${matchContext.goldDiff}G

【Scene to Analyze】
- Type: ${segment.type}
- Timestamp: ${segment.targetTimestampStr}
- What happened: ${segment.eventDescription}

【Basic Macro Concepts (use these to explain)】
- Push and Rotate: Push wave to enemy tower before rotating
- Cross-mapping: Take resources on the opposite side of where enemies are
- Slow Push: Slow push → Crash → Catch in middle → Repeat
- Split Push: Apply pressure in a side lane
- Objective Setup: Push waves before objective spawns to position

【Output Format (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion} farming in ${roleLabel}",
        "allyPositions": "Describe ally positions",
        "enemyPositions": "Visible enemy positions (mark unknown if not visible)",
        "waveState": "Wave state for each lane",
        "objectiveState": "Objective status"
    },
    "winningPattern": {
        "title": "Title of the winning pattern",
        "steps": ["Step 1", "Step 2", "Step 3"],
        "macroConceptUsed": "Macro concept name used"
    },
    "gap": {
        "description": "Gap between actual play and winning pattern",
        "criticalMoment": "When the decision should have been different",
        "whatShouldHaveDone": "Specifically what should have been done"
    }
}`,

        ko: `당신은 League of Legends의 매크로 전략(맵 전체의 움직임, 로테이션, 오브젝트 컨트롤)에 특화된 전문 코치입니다.

**모든 분석 텍스트를 한국어로 출력하세요.**

【중요: 분석 포커스】
- **매크로만**: 마이크로(조작, 스킬 정확도)에 대해 언급하지 마세요
- **미니맵 확인**: 모든 챔피언 위치와 웨이브 위치를 확인
- **"승리 패턴" 제시**: 이 상황에서 무엇을 해야 했는지 구체적으로

【미니맵 읽는 법 - 매우 중요】
미니맵은 화면 오른쪽 하단에 표시됩니다. 라인 위치는 다음과 같습니다:
- **탑 라인**: 미니맵의 **왼쪽 상단** 영역(북서쪽)
- **미드 라인**: 미니맵 **중앙을 대각선**으로 가로지르는 라인
- **봇 라인**: 미니맵의 **오른쪽 하단** 영역(남동쪽)

【플레이어 정보】
- 유저의 챔피언: ${matchContext.myChampion}
- 유저의 담당 라인: **${roleLabel}**
- 아군 팀: ${matchContext.allies.join(', ')}
- 적 팀: ${matchContext.enemies.join(', ')}
- 골드 차이: ${matchContext.goldDiff}G

【분석 대상 장면】
- 타입: ${segment.type}
- 타임스탬프: ${segment.targetTimestampStr}
- 발생한 일: ${segment.eventDescription}

【매크로 기본 개념 (이것들을 사용하여 설명하세요)】
- Push and Rotate: 웨이브를 적 타워로 밀고 로테이션
- Cross-mapping: 적이 있는 곳의 반대편에서 자원 획득
- Slow Push: 슬로우 푸시 → 크래시 → 중앙에서 받기 → 반복
- Split Push: 사이드 라인에서 압박
- Objective Setup: 오브젝트 스폰 전에 웨이브를 밀어 포지셔닝

【출력 형식 (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion}이(가) ${roleLabel}에서 파밍 중",
        "allyPositions": "아군 위치 설명",
        "enemyPositions": "보이는 적 위치(안 보이면 위치 불명)",
        "waveState": "각 라인의 웨이브 상태",
        "objectiveState": "오브젝트 상태"
    },
    "winningPattern": {
        "title": "승리 패턴의 제목",
        "steps": ["스텝 1", "스텝 2", "스텝 3"],
        "macroConceptUsed": "사용한 매크로 개념명 (영어로)"
    },
    "gap": {
        "description": "실제 플레이와의 차이",
        "criticalMoment": "판단을 바꿔야 했던 타이밍",
        "whatShouldHaveDone": "구체적으로 해야 했던 것"
    }
}`
    };

    return prompts[language];
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
    let shouldIncrementCount = false;
    const weeklyCount = status.weekly_analysis_count || 0;

    if (status.is_premium) {
        // Premium user: 20 analyses per week
        if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
            return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: `週間制限に達しました (${weeklyCount}/${PREMIUM_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。` };
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        // Free user: 3 analyses per week (unless using own API key)
        if (userApiKey) {
            useEnvKey = false;
        } else {
            if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
                return { success: false, matchId: request.matchId, analyzedAt: '', segments: [], overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } }, error: `無料プランの週間制限に達しました (${weeklyCount}/${FREE_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。プレミアムプランへのアップグレードで週20回まで分析できます。` };
            }
            useEnvKey = true;
            shouldIncrementCount = true;
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

        // Convert role to more descriptive names in each language
        const roleMapJa: Record<string, string> = {
            'TOP': 'トップレーン',
            'JUNGLE': 'ジャングル',
            'MIDDLE': 'ミッドレーン',
            'BOTTOM': 'ボットレーン(ADC)',
            'UTILITY': 'ボットレーン(サポート)'
        };
        const roleMapEn: Record<string, string> = {
            'TOP': 'Top Lane',
            'JUNGLE': 'Jungle',
            'MIDDLE': 'Mid Lane',
            'BOTTOM': 'Bot Lane (ADC)',
            'UTILITY': 'Bot Lane (Support)'
        };
        const roleMapKo: Record<string, string> = {
            'TOP': '탑 라인',
            'JUNGLE': '정글',
            'MIDDLE': '미드 라인',
            'BOTTOM': '봇 라인(ADC)',
            'UTILITY': '봇 라인(서포터)'
        };

        const lang = request.language || 'ja';
        const roleMap = lang === 'en' ? roleMapEn : lang === 'ko' ? roleMapKo : roleMapJa;
        const myRoleJp = roleMapJa[me.teamPosition] || me.teamPosition;
        const myRoleLocalized = roleMap[me.teamPosition] || me.teamPosition;

        const matchContext = {
            myChampion: me.championName,
            myRole: me.teamPosition,
            myRoleJp: myRoleJp,
            myRoleLocalized: myRoleLocalized,
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
        const buildPromise = generateBuildRecommendation(matchRes.data, request.puuid, model, lang);

        // Analyze each segment with rate limit handling
        const segmentResults: SegmentAnalysis[] = [];
        const segmentErrors: string[] = [];

        const isPremium = status.is_premium;
        console.log(`[VideoMacro] Starting analysis of ${request.segments.length} segments (${isPremium ? 'PARALLEL - Premium' : 'SEQUENTIAL - Free'})`);

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

        // Function to analyze a single segment
        const analyzeSegment = async (segment: VideoMacroSegment, segmentIndex: number): Promise<SegmentAnalysis | null> => {
            console.log(`[VideoMacro] Processing segment ${segment.segmentId} (${segment.type}) [${segmentIndex + 1}/${request.segments.length}]`);

            // Get frames for this segment
            const segmentFrames = request.frames.filter(f => f.segmentId === segment.segmentId);

            if (segmentFrames.length === 0) {
                const errorMsg = `Segment ${segment.segmentId}: No frames available`;
                console.warn(`[VideoMacro] ${errorMsg}`);
                segmentErrors.push(errorMsg);
                return null;
            }

            console.log(`[VideoMacro] Segment ${segment.segmentId} has ${segmentFrames.length} frames`);

            // Build prompt
            const prompt = generateVideoMacroPrompt(segment, matchContext, lang);

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

                console.log(`[VideoMacro] Segment ${segment.segmentId} analysis complete`);
                return {
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    gap: analysisData.gap
                };
            } catch (segmentError: any) {
                const errorMsg = `Segment ${segment.segmentId}: ${segmentError.message || 'Unknown error'}`;
                console.error(`[VideoMacro] ${errorMsg}`, segmentError);
                segmentErrors.push(errorMsg);
                return null;
            }
        };

        // Process segments: Parallel for Premium, Sequential for Free
        if (isPremium) {
            // PREMIUM: Process all segments in parallel for faster analysis
            console.log('[VideoMacro] Premium user - using parallel processing for faster analysis');
            const results = await Promise.all(
                request.segments.map((segment, index) => analyzeSegment(segment, index))
            );
            // Filter out null results and add to segmentResults
            results.forEach(result => {
                if (result) segmentResults.push(result);
            });
        } else {
            // FREE: Process segments sequentially with delay to avoid rate limiting
            console.log('[VideoMacro] Free user - using sequential processing with rate limiting');
            for (let i = 0; i < request.segments.length; i++) {
                // Add delay between segments to avoid rate limiting (except for first segment)
                if (i > 0) {
                    console.log(`[VideoMacro] Waiting 1.5s before next segment to avoid rate limiting...`);
                    await delay(1500);
                }
                const result = await analyzeSegment(request.segments[i], i);
                if (result) segmentResults.push(result);
            }
        }

        console.log(`[VideoMacro] Analysis complete: ${segmentResults.length}/${request.segments.length} segments successful`);
        if (segmentErrors.length > 0) {
            console.warn(`[VideoMacro] Segment errors: ${segmentErrors.join(', ')}`);
        }

        // Generate overall summary from segment results
        const overallSummary = generateOverallSummary(segmentResults, lang);

        // Wait for build recommendation to complete (was running in parallel)
        console.log('[VideoMacro] Waiting for build recommendation to complete...');
        const buildRecommendation = await buildPromise;
        if (buildRecommendation) {
            console.log('[VideoMacro] Build recommendation completed successfully');
        } else {
            console.log('[VideoMacro] Build recommendation returned null (may have failed)');
        }

        // Update usage count (both premium and free users increment weekly count)
        if (shouldIncrementCount) {
            await supabase.from("profiles").update({
                weekly_analysis_count: (status.weekly_analysis_count || 0) + 1
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

function generateOverallSummary(segments: SegmentAnalysis[], language: 'ja' | 'en' | 'ko' = 'ja'): {
    mainIssue: string;
    homework: {
        title: string;
        description: string;
        howToCheck: string;
        relatedTimestamps: string[];
    };
} {
    const noDataMessages = {
        ja: { mainIssue: '分析データがありません', title: '再度分析を実行してください' },
        en: { mainIssue: 'No analysis data available', title: 'Please run the analysis again' },
        ko: { mainIssue: '분석 데이터가 없습니다', title: '다시 분석을 실행해주세요' }
    };

    if (segments.length === 0) {
        return {
            mainIssue: noDataMessages[language].mainIssue,
            homework: {
                title: noDataMessages[language].title,
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

    const mainIssueMessages = {
        ja: {
            both: 'オブジェクト前の準備不足とポジショニングミスが連動して負けパターンを作っています',
            objective: 'オブジェクトタイマーを意識した事前準備（ウェーブプッシュ、ポジショニング）が不足しています',
            death: 'マップ全体の状況を見ずに単独行動してデスするパターンが見られます',
            other: 'マクロの意思決定タイミングを改善する必要があります'
        },
        en: {
            both: 'Lack of objective preparation and positioning mistakes are creating a losing pattern',
            objective: 'Need better preparation before objectives (wave push, positioning)',
            death: 'Getting caught alone without checking the full map situation',
            other: 'Macro decision timing needs improvement'
        },
        ko: {
            both: '오브젝트 사전 준비 부족과 포지셔닝 실수가 연결되어 패배 패턴을 만들고 있습니다',
            objective: '오브젝트 타이머를 의식한 사전 준비(웨이브 푸시, 포지셔닝)가 부족합니다',
            death: '맵 전체 상황을 확인하지 않고 단독 행동하여 죽는 패턴이 보입니다',
            other: '매크로 의사결정 타이밍을 개선할 필요가 있습니다'
        }
    };

    let mainIssue = '';
    if (hasObjectiveIssues && hasDeathIssues) {
        mainIssue = mainIssueMessages[language].both;
    } else if (hasObjectiveIssues) {
        mainIssue = mainIssueMessages[language].objective;
    } else if (hasDeathIssues) {
        mainIssue = mainIssueMessages[language].death;
    } else {
        mainIssue = mainIssueMessages[language].other;
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
            description: getHomeworkDescription(mostCommonConcept, language),
            howToCheck: getHomeworkCheckCriteria(mostCommonConcept, language),
            relatedTimestamps
        }
    };
}

function getHomeworkDescription(concept: string, language: 'ja' | 'en' | 'ko' = 'ja'): string {
    const descriptions: Record<string, Record<string, string>> = {
        'Push and Rotate': {
            ja: 'ローテーションする前に必ずウェーブを敵タワーに押し切る。これにより敵にジレンマを与え、自分は安全に移動できる。',
            en: 'Always push the wave to the enemy tower before rotating. This creates a dilemma for the enemy and allows safe movement.',
            ko: '로테이션 전에 반드시 웨이브를 적 타워까지 밀어야 합니다. 이렇게 하면 적에게 딜레마를 주고 안전하게 이동할 수 있습니다.'
        },
        'クロスマッピング': {
            ja: '敵が5人でプッシュしている時は、同じ場所に行かず反対サイドでタワーやファームを取る。',
            en: 'When 5 enemies are pushing together, take resources on the opposite side instead of meeting them.',
            ko: '적 5명이 함께 푸시할 때는 같은 곳으로 가지 말고 반대편에서 타워나 파밍을 합니다.'
        },
        '2ウェーブサイクル': {
            ja: '第1ウェーブでスロープッシュ→第2ウェーブでクラッシュ→次は中央で受ける、を繰り返す。',
            en: 'Slow push wave 1 → crash wave 2 → catch in the middle → repeat cycle.',
            ko: '1웨이브 슬로우 푸시 → 2웨이브 크래시 → 다음은 중앙에서 받기 → 반복'
        },
        'Hit-and-Run': {
            ja: 'タワーを一気に取ろうとせず、少し削って離脱→防御バフが切れたら戻る、を繰り返す。',
            en: 'Don\'t try to take tower at once. Chip damage → back off → return when plates drop.',
            ko: '타워를 한 번에 부수려 하지 말고, 조금 깎고 후퇴 → 방어 버프가 사라지면 돌아가기를 반복합니다.'
        },
        'オブジェクト準備': {
            ja: 'ドラゴン/バロンスポーン1分前にはウェーブを押し、30秒前にはオブジェクト周辺にいる。',
            en: 'Push waves 1 minute before Dragon/Baron spawn, be at objective 30 seconds before.',
            ko: '드래곤/바론 스폰 1분 전에 웨이브를 밀고, 30초 전에는 오브젝트 주변에 있어야 합니다.'
        }
    };

    const defaultMsg = {
        ja: 'マクロの基本概念を意識してプレイする',
        en: 'Focus on basic macro concepts',
        ko: '매크로의 기본 개념을 의식하며 플레이하세요'
    };

    return descriptions[concept]?.[language] || defaultMsg[language];
}

function getHomeworkCheckCriteria(concept: string, language: 'ja' | 'en' | 'ko' = 'ja'): string {
    const criteria: Record<string, Record<string, string>> = {
        'Push and Rotate': {
            ja: '次の試合で、ローテーション前にウェーブを押せた回数を数える（目標: 5回以上）',
            en: 'Count how many times you pushed wave before rotating (Goal: 5+ times)',
            ko: '다음 게임에서 로테이션 전에 웨이브를 밀은 횟수를 세세요 (목표: 5회 이상)'
        },
        'クロスマッピング': {
            ja: 'ビハインド時に敵と同じ場所でファイトした回数を0にする',
            en: 'Avoid fighting where enemies are grouped when behind (Goal: 0 times)',
            ko: '뒤처졌을 때 적과 같은 곳에서 싸운 횟수를 0으로 만드세요'
        },
        '2ウェーブサイクル': {
            ja: 'レーン戦でスロープッシュ→クラッシュのサイクルを3回以上成功させる',
            en: 'Complete slow push → crash cycle 3+ times in laning phase',
            ko: '라인전에서 슬로우 푸시 → 크래시 사이클을 3회 이상 성공시키세요'
        },
        'Hit-and-Run': {
            ja: 'タワーダイブで死んだ回数を0にする',
            en: 'Zero deaths from tower dives',
            ko: '타워 다이브로 죽은 횟수를 0으로 만드세요'
        },
        'オブジェクト準備': {
            ja: 'オブジェクトスポーン時にピット周辺にいた割合を50%以上にする',
            en: 'Be at objective pit 50%+ of the time when objectives spawn',
            ko: '오브젝트 스폰 시 피트 주변에 있는 비율을 50% 이상으로 만드세요'
        }
    };

    const defaultMsg = {
        ja: '次の試合で意識してプレイする',
        en: 'Focus on this in your next game',
        ko: '다음 게임에서 이것을 의식하며 플레이하세요'
    };

    return criteria[concept]?.[language] || defaultMsg[language];
}

// ============================================================
// BUILD RECOMMENDATION GENERATION
// ============================================================

async function generateBuildRecommendation(
    matchData: any,
    puuid: string,
    model: any,
    language: 'ja' | 'en' | 'ko' = 'ja'
): Promise<BuildRecommendation | null> {
    try {
        console.log('[VideoMacro] Generating build recommendation...');

        // Fetch item data from Data Dragon for name resolution
        const itemData = await fetchDDItemData(language);
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

        // Language-specific prompt parts
        const langPrompts = {
            ja: {
                intro: 'あなたはLoLのビルドコーチです。以下の情報を基に、ビルドアドバイスを日本語で提供してください。',
                matchInfo: '【試合情報】',
                userChamp: 'ユーザーチャンピオン',
                userRole: 'ユーザーのロール',
                userBuild: 'ユーザーのビルド（アイテムID）',
                opponentChamp: '対面チャンピオン',
                opponentBuild: '対面のビルド（アイテムID）',
                result: '試合結果',
                win: '勝利',
                loss: '敗北',
                none: 'なし',
                unknown: '不明',
                analysisRequest: '【分析してほしいこと】',
                point1: '1. ユーザーのビルドの良かった点',
                point2: '2. 改善すべき点（対面や敵チーム構成を考慮）',
                point3: '3. 推奨ビルド（コアアイテム3つ程度）',
                outputFormat: '【出力形式 (JSON)】',
                analysisDesc: 'ビルドの分析とアドバイス（3-4文）',
                fallback: 'ビルドアドバイスを生成できませんでした'
            },
            en: {
                intro: 'You are a LoL build coach. Provide build advice in English based on the following information.',
                matchInfo: '【Match Information】',
                userChamp: 'User Champion',
                userRole: 'User Role',
                userBuild: 'User Build (Item IDs)',
                opponentChamp: 'Opponent Champion',
                opponentBuild: 'Opponent Build (Item IDs)',
                result: 'Match Result',
                win: 'Victory',
                loss: 'Defeat',
                none: 'None',
                unknown: 'Unknown',
                analysisRequest: '【Analysis Request】',
                point1: '1. Good points about user\'s build',
                point2: '2. Areas for improvement (considering opponent and enemy team comp)',
                point3: '3. Recommended build (3 core items)',
                outputFormat: '【Output Format (JSON)】',
                analysisDesc: 'Build analysis and advice (3-4 sentences)',
                fallback: 'Could not generate build advice'
            },
            ko: {
                intro: '당신은 LoL 빌드 코치입니다. 다음 정보를 바탕으로 한국어로 빌드 조언을 제공하세요.',
                matchInfo: '【경기 정보】',
                userChamp: '유저 챔피언',
                userRole: '유저의 역할',
                userBuild: '유저의 빌드(아이템 ID)',
                opponentChamp: '상대 챔피언',
                opponentBuild: '상대의 빌드(아이템 ID)',
                result: '경기 결과',
                win: '승리',
                loss: '패배',
                none: '없음',
                unknown: '알 수 없음',
                analysisRequest: '【분석 요청】',
                point1: '1. 유저 빌드의 좋았던 점',
                point2: '2. 개선할 점(상대와 적 팀 구성 고려)',
                point3: '3. 추천 빌드(코어 아이템 3개 정도)',
                outputFormat: '【출력 형식(JSON)】',
                analysisDesc: '빌드 분석 및 조언(3-4문장)',
                fallback: '빌드 조언을 생성할 수 없습니다'
            }
        };

        const lp = langPrompts[language];

        // Generate AI advice
        const prompt = `
${lp.intro}

${lp.matchInfo}
- ${lp.userChamp}: ${me.championName}
- ${lp.userRole}: ${myPosition}
- ${lp.userBuild}: ${userItems.map(i => i.id).join(', ') || lp.none}
- ${lp.opponentChamp}: ${opponent?.championName || lp.unknown}
- ${lp.opponentBuild}: ${opponentItems.map(i => i.id).join(', ') || lp.unknown}
- ${lp.result}: ${me.win ? lp.win : lp.loss}
- KDA: ${me.kills}/${me.deaths}/${me.assists}

${lp.analysisRequest}
${lp.point1}
${lp.point2}
${lp.point3}

${lp.outputFormat}
{
    "analysis": "${lp.analysisDesc}",
    "recommendedItemIds": [ItemID, ItemID, ItemID]
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
            opponentChampionName: opponent?.championName || lp.unknown,
            recommendedItems,
            analysis: aiResponse.analysis || lp.fallback
        };
    } catch (error: any) {
        console.error('[VideoMacro] Build recommendation error:', error.message);
        return null;
    }
}

// ============================================================
// ASYNC JOB-BASED ANALYSIS (For Background Processing)
// ============================================================

/**
 * Start a macro analysis job that runs in the background.
 * Returns immediately with a job ID that can be polled for progress.
 */
export async function startVideoMacroAnalysis(
    request: VideoMacroAnalysisRequest,
    userApiKey?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Check limits before starting
    const status = await getAnalysisStatus();
    if (!status) {
        return { success: false, error: "User profile not found" };
    }

    let useEnvKey = false;
    let shouldIncrementCount = false;
    const weeklyCount = status.weekly_analysis_count || 0;

    if (status.is_premium) {
        if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
            return { success: false, error: `週間制限に達しました (${weeklyCount}/${PREMIUM_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。` };
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        if (userApiKey) {
            useEnvKey = false;
        } else if (weeklyCount < FREE_WEEKLY_ANALYSIS_LIMIT) {
            useEnvKey = true;
            shouldIncrementCount = true;
        } else {
            return { success: false, error: `無料プランの週間制限に達しました (${weeklyCount}/${FREE_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。プレミアムプランへのアップグレードで週20回まで分析できます。` };
        }
    }

    const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
    if (!apiKeyToUse) {
        return { success: false, error: "API Key not found" };
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
        .from("video_analyses")
        .insert({
            user_id: user.id,
            match_id: request.matchId,
            status: "processing",
            analysis_type: "macro",  // Required for result restoration
            result: null,
            inputs: {
                mode: "MACRO",
                puuid: request.puuid,
                segmentCount: request.segments.length,
                language: request.language || 'ja',
                timestamp: new Date().toISOString()
            }
        })
        .select()
        .single();

    if (jobError || !job) {
        console.error("[startVideoMacroAnalysis] Failed to create job:", jobError);
        return { success: false, error: "Database error: Could not start analysis job" };
    }

    console.log(`[startVideoMacroAnalysis] Created job: ${job.id}`);

    // Fire-and-forget: Run analysis in background
    (async () => {
        try {
            await performVideoMacroAnalysisInBackground(
                job.id,
                request,
                user.id,
                status,
                useEnvKey,
                apiKeyToUse,
                shouldIncrementCount
            );
        } catch (e) {
            console.error(`[VideoMacro Job ${job.id}] Uncaught error:`, e);
            // Update job status to failed
            await supabase
                .from("video_analyses")
                .update({
                    status: "failed",
                    error: (e as Error).message
                })
                .eq("id", job.id);
        }
    })();

    return { success: true, jobId: job.id };
}

/**
 * Internal background worker for macro analysis.
 * Updates job record with progress and final results.
 */
async function performVideoMacroAnalysisInBackground(
    jobId: string,
    request: VideoMacroAnalysisRequest,
    userId: string,
    status: any,
    useEnvKey: boolean,
    apiKey: string,
    shouldIncrementCount: boolean
): Promise<void> {
    const supabase = await createClient();

    try {
        console.log(`[VideoMacro Job ${jobId}] Starting background analysis...`);

        // Fetch match context
        const matchRes = await fetchMatchDetail(request.matchId);
        if (!matchRes.success || !matchRes.data) {
            throw new Error("Failed to fetch match data");
        }

        const participants = matchRes.data.info.participants;
        const me = participants.find((p: any) => p.puuid === request.puuid);
        if (!me) {
            throw new Error("Player not found in match");
        }

        const myTeamId = me.teamId;
        const allies = participants.filter((p: any) => p.teamId === myTeamId && p.puuid !== request.puuid)
            .map((p: any) => `${p.championName}(${p.teamPosition})`);
        const enemies = participants.filter((p: any) => p.teamId !== myTeamId)
            .map((p: any) => `${p.championName}(${p.teamPosition})`);

        const lang = request.language || 'ja';
        const roleMapJa: Record<string, string> = {
            'TOP': 'トップレーン', 'JUNGLE': 'ジャングル', 'MIDDLE': 'ミッドレーン',
            'BOTTOM': 'ボットレーン(ADC)', 'UTILITY': 'ボットレーン(サポート)'
        };
        const roleMapEn: Record<string, string> = {
            'TOP': 'Top Lane', 'JUNGLE': 'Jungle', 'MIDDLE': 'Mid Lane',
            'BOTTOM': 'Bot Lane (ADC)', 'UTILITY': 'Bot Lane (Support)'
        };
        const roleMapKo: Record<string, string> = {
            'TOP': '탑 라인', 'JUNGLE': '정글', 'MIDDLE': '미드 라인',
            'BOTTOM': '봇 라인(ADC)', 'UTILITY': '봇 라인(서포터)'
        };
        const roleMap = lang === 'en' ? roleMapEn : lang === 'ko' ? roleMapKo : roleMapJa;
        const myRoleJp = roleMapJa[me.teamPosition] || me.teamPosition;
        const myRoleLocalized = roleMap[me.teamPosition] || me.teamPosition;

        const matchContext = {
            myChampion: me.championName,
            myRole: me.teamPosition,
            myRoleJp: myRoleJp,
            myRoleLocalized: myRoleLocalized,
            allies,
            enemies,
            goldDiff: 0
        };

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.4
            }
        });

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
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`[VideoMacro Job ${jobId}] Rate limited, waiting ${waitTime}ms before retry (attempt ${attempt}/${maxRetries})`);
                        await delay(waitTime);
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries exceeded');
        };

        // Analyze each segment
        const segmentResults: SegmentAnalysis[] = [];
        const segmentErrors: string[] = [];
        const isPremium = status.is_premium;

        console.log(`[VideoMacro Job ${jobId}] Analyzing ${request.segments.length} segments (${isPremium ? 'PARALLEL - Premium' : 'SEQUENTIAL - Free'})`);

        // Function to analyze a single segment
        const analyzeSegment = async (segment: VideoMacroSegment, segmentIndex: number): Promise<SegmentAnalysis | null> => {
            console.log(`[VideoMacro Job ${jobId}] Analyzing segment ${segmentIndex + 1}/${request.segments.length}`);

            try {
                const segmentFrames = request.frames
                    .filter(f => f.segmentId === segment.segmentId)
                    .sort((a, b) => a.gameTime - b.gameTime);

                if (segmentFrames.length === 0) {
                    segmentErrors.push(`Segment ${segment.segmentId}: No frames`);
                    return null;
                }

                // Build prompt
                const prompt = generateVideoMacroPrompt(segment, matchContext, lang);

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

                console.log(`[VideoMacro Job ${jobId}] Calling Gemini for segment ${segment.segmentId}...`);
                const text = await callGeminiWithRetry(parts);
                const cleanedText = text
                    .replace(/^```json\s*/, "")
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");

                const analysisData = JSON.parse(cleanedText);

                console.log(`[VideoMacro Job ${jobId}] Segment ${segment.segmentId} analysis complete`);
                return {
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    gap: analysisData.gap
                };
            } catch (segError: any) {
                console.error(`[VideoMacro Job ${jobId}] Segment ${segmentIndex + 1} error:`, segError.message);
                segmentErrors.push(`Segment ${segment.segmentId}: ${segError.message}`);
                return null;
            }
        };

        // Process segments: Parallel for Premium, Sequential for Free
        if (isPremium) {
            // PREMIUM: Process all segments in parallel for faster analysis
            console.log(`[VideoMacro Job ${jobId}] Premium user - using parallel processing`);
            const results = await Promise.all(
                request.segments.map((segment, index) => analyzeSegment(segment, index))
            );
            results.forEach(result => {
                if (result) segmentResults.push(result);
            });
        } else {
            // FREE: Process segments sequentially with delay to avoid rate limiting
            console.log(`[VideoMacro Job ${jobId}] Free user - using sequential processing`);
            for (let i = 0; i < request.segments.length; i++) {
                if (i > 0) {
                    await delay(1500);
                }
                const result = await analyzeSegment(request.segments[i], i);
                if (result) segmentResults.push(result);
            }
        }

        // Generate overall summary
        const overallSummary = generateOverallSummary(segmentResults, lang);

        // Generate build recommendation (parallel to segment analysis in original)
        let buildRecommendation = null;
        try {
            buildRecommendation = await generateBuildRecommendation(matchRes.data, request.puuid, model, lang);
        } catch (e) {
            console.error(`[VideoMacro Job ${jobId}] Build recommendation error:`, e);
        }

        // Update usage count (both premium and free users increment weekly count)
        if (shouldIncrementCount) {
            await supabase.from("profiles").update({
                weekly_analysis_count: (status.weekly_analysis_count || 0) + 1
            }).eq("id", userId);
        }

        // Build result
        const result: VideoMacroAnalysisResult = {
            success: true,
            matchId: request.matchId,
            analyzedAt: new Date().toISOString(),
            segments: segmentResults,
            overallSummary,
            buildRecommendation: buildRecommendation || undefined,
            warnings: segmentErrors.length > 0 ? segmentErrors : undefined,
            requestedSegments: request.segments.length,
            completedSegments: segmentResults.length,
            timeOffset: request.timeOffset
        };

        // Update job with result
        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: result
            })
            .eq("id", jobId);

        console.log(`[VideoMacro Job ${jobId}] Completed successfully`);

    } catch (error: any) {
        console.error(`[VideoMacro Job ${jobId}] Failed:`, error);

        // Update job as failed
        await supabase
            .from("video_analyses")
            .update({
                status: "failed",
                error: error.message,
                result: {
                    success: false,
                    matchId: request.matchId,
                    analyzedAt: '',
                    segments: [],
                    overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } },
                    error: error.message
                }
            })
            .eq("id", jobId);
    }
}

/**
 * Get the status of a macro analysis job.
 * Used for polling from the client.
 */
export async function getVideoMacroJobStatus(jobId: string): Promise<{
    status: 'processing' | 'completed' | 'failed' | 'not_found';
    result?: VideoMacroAnalysisResult;
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { status: 'not_found', error: 'Not authenticated' };
    }

    const { data, error } = await supabase
        .from("video_analyses")
        .select("*")
        .eq("id", jobId)
        .single();

    if (error || !data) {
        return { status: 'not_found' };
    }

    // Verify ownership
    if (data.user_id !== user.id) {
        return { status: 'not_found' };
    }

    return {
        status: data.status as 'processing' | 'completed' | 'failed',
        result: data.result as VideoMacroAnalysisResult | undefined,
        error: data.error || undefined
    };
}

/**
 * Get the latest completed MACRO analysis for a match
 * Used to restore analysis results when user navigates back to the page
 */
export async function getLatestMacroAnalysisForMatch(matchId: string): Promise<{
    found: boolean;
    result?: VideoMacroAnalysisResult;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { found: false };
    }

    // Fetch the latest completed MACRO analysis for this match
    // Check for analysis_type = 'macro' OR (analysis_type IS NULL AND inputs->mode = 'MACRO')
    const { data, error } = await supabase
        .from("video_analyses")
        .select("result, analysis_type, inputs")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10); // Get a few records to filter

    if (error || !data || data.length === 0) {
        return { found: false };
    }

    // Find the first MACRO result (either by analysis_type or inputs.mode)
    const macroRecord = data.find(record =>
        record.analysis_type === 'macro' ||
        (record.inputs && (record.inputs as any).mode === 'MACRO')
    );

    if (!macroRecord || !macroRecord.result) {
        return { found: false };
    }

    return {
        found: true,
        result: macroRecord.result as VideoMacroAnalysisResult
    };
}
