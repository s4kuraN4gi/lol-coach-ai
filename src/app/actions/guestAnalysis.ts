"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getGuestCreditStatus, useGuestCredit, isGuestUser } from "./guestCredits";
import { getAnalysisStatus } from "./analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "./constants";
import { GUEST_FIXED_SEGMENTS, type GuestSegment } from "./guestConstants";
import { fetchLatestVersion, fetchMatchDetail, fetchMatchTimeline, extractMatchEvents, getChampionAttributes } from "./riot";
import type { VisionAnalysisResult } from "./vision";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

// Segment info type for free member mode (from VideoMacroAnalysis)
export type FreeSegmentInfo = {
    segmentId: number;
    targetTimestamp: number;
    targetTimestampStr: string;
    eventDescription: string;
    type: string;
    analysisStartTime: number;
    analysisEndTime: number;
};

export type GuestAnalysisRequest = {
    frames: {
        segmentId: number;
        frameIndex: number;
        gameTime: number;
        base64Data: string;
    }[];
    language?: 'ja' | 'en' | 'ko';
    timeOffset?: number;
    // Free member mode: match context
    matchId?: string;
    segments?: FreeSegmentInfo[];
};

export type GuestSegmentAnalysis = {
    segmentId: number;
    type: string;
    timestamp: string;
    observation: {
        userPosition: string;
        allyPositions: string;
        enemyPositions: string;
        waveState: string;
        objectiveState: string;
    };
    winningPattern: {
        title: string;
        steps: string[];
        macroConceptUsed: string;
    };
    improvement: {
        description: string;
        actionableAdvice: string;
    };
};

export type GuestAnalysisResult = {
    success: boolean;
    analyzedAt: string;
    segments: GuestSegmentAnalysis[];
    overallSummary: {
        mainIssue: string;
        homework: {
            title: string;
            description: string;
            howToCheck: string;
        };
    };
    error?: string;
    warnings?: string[];
    requestedSegments?: number;
    completedSegments?: number;
    timeOffset?: number;
    // Upsell info
    isGuest: boolean;
    remainingCredits: number;
};

// Check if user can perform analysis (guest or free member)
export async function canPerformGuestAnalysis(): Promise<{
    canAnalyze: boolean;
    isGuest: boolean;
    credits: number;
    maxCredits: number;
    nextCreditAt: Date | null;
    upgradeMessage?: string;
    isPremium?: boolean;
}> {
    const isGuest = await isGuestUser();

    if (isGuest) {
        const guestStatus = await getGuestCreditStatus();
        return {
            canAnalyze: guestStatus.canUse,
            isGuest: true,
            credits: guestStatus.credits,
            maxCredits: 3,
            nextCreditAt: guestStatus.nextCreditAt,
            upgradeMessage: guestStatus.credits <= 0
                ? "ゲストのクレジットが不足しています。アカウント登録で週3回まで分析できます！"
                : undefined,
            isPremium: false
        };
    } else {
        // Logged in user - check their analysis status
        const status = await getAnalysisStatus();
        if (!status) {
            return {
                canAnalyze: false,
                isGuest: false,
                credits: 0,
                maxCredits: 0,
                nextCreditAt: null,
                upgradeMessage: "プロフィールが見つかりません",
                isPremium: false
            };
        }

        // Premium users should be redirected to /dashboard/coach
        if (status.is_premium) {
            return {
                canAnalyze: true,
                isGuest: false,
                credits: PREMIUM_WEEKLY_ANALYSIS_LIMIT,
                maxCredits: PREMIUM_WEEKLY_ANALYSIS_LIMIT,
                nextCreditAt: null,
                isPremium: true
            };
        }

        const weeklyCount = status.weekly_analysis_count || 0;
        const limit = FREE_WEEKLY_ANALYSIS_LIMIT;
        const remaining = Math.max(0, limit - weeklyCount);

        return {
            canAnalyze: remaining > 0,
            isGuest: false,
            credits: remaining,
            maxCredits: limit,
            nextCreditAt: null, // Resets on Monday
            upgradeMessage: remaining <= 0
                ? "無料プランの週間制限に達しました。プレミアムプランで週20回まで分析できます！"
                : undefined,
            isPremium: false
        };
    }
}

// Simplified prompt for guest/free member analysis
function generateGuestAnalysisPrompt(
    segment: GuestSegment | FreeSegmentInfo,
    language: 'ja' | 'en' | 'ko' = 'ja'
): string {
    const prompts = {
        ja: `あなたはLeague of Legendsのマクロ戦術コーチです。

**全てのテキストを日本語で出力してください。**

【重要】
- マクロのみを分析（ミクロには言及しない）
- ミニマップから状況を読み取る
- 具体的な改善点を提示

【分析対象】
- タイムスタンプ: ${segment.targetTimestampStr}
- シーン: ${segment.eventDescription}

【ミニマップの読み方】
- トップレーン: 左上〜上部
- ミッドレーン: 中央の対角線
- ボットレーン: 右下〜下部

【出力形式 (JSON)】
{
    "observation": {
        "userPosition": "プレイヤーの位置",
        "allyPositions": "味方の位置",
        "enemyPositions": "敵の位置（見えない場合は位置不明）",
        "waveState": "各レーンのウェーブ状況",
        "objectiveState": "オブジェクトの状況"
    },
    "winningPattern": {
        "title": "この状況での勝ちパターン",
        "steps": ["ステップ1", "ステップ2", "ステップ3"],
        "macroConceptUsed": "使用したマクロ概念（英語）"
    },
    "improvement": {
        "description": "改善できる点",
        "actionableAdvice": "次回試すべきこと"
    }
}`,

        en: `You are a League of Legends macro strategy coach.

**Output ALL text in English.**

【Important】
- Analyze MACRO only (no micro mechanics)
- Read situation from minimap
- Provide specific improvements

【Analysis Target】
- Timestamp: ${segment.targetTimestampStr}
- Scene: ${segment.eventDescription}

【Minimap Reading】
- Top Lane: Upper-left area
- Mid Lane: Diagonal center
- Bot Lane: Lower-right area

【Output Format (JSON)】
{
    "observation": {
        "userPosition": "Player position",
        "allyPositions": "Allied positions",
        "enemyPositions": "Enemy positions (mark unknown if not visible)",
        "waveState": "Wave state for each lane",
        "objectiveState": "Objective status"
    },
    "winningPattern": {
        "title": "Winning pattern for this situation",
        "steps": ["Step 1", "Step 2", "Step 3"],
        "macroConceptUsed": "Macro concept name"
    },
    "improvement": {
        "description": "What can be improved",
        "actionableAdvice": "What to try next time"
    }
}`,

        ko: `당신은 League of Legends 매크로 전략 코치입니다.

**모든 텍스트를 한국어로 출력하세요.**

【중요】
- 매크로만 분석 (마이크로 언급 금지)
- 미니맵에서 상황 파악
- 구체적인 개선점 제시

【분석 대상】
- 타임스탬프: ${segment.targetTimestampStr}
- 장면: ${segment.eventDescription}

【미니맵 읽기】
- 탑 라인: 왼쪽 상단
- 미드 라인: 중앙 대각선
- 봇 라인: 오른쪽 하단

【출력 형식 (JSON)】
{
    "observation": {
        "userPosition": "플레이어 위치",
        "allyPositions": "아군 위치",
        "enemyPositions": "적 위치(안 보이면 위치 불명)",
        "waveState": "각 라인의 웨이브 상태",
        "objectiveState": "오브젝트 상태"
    },
    "winningPattern": {
        "title": "이 상황에서의 승리 패턴",
        "steps": ["스텝 1", "스텝 2", "스텝 3"],
        "macroConceptUsed": "매크로 개념명 (영어)"
    },
    "improvement": {
        "description": "개선할 수 있는 점",
        "actionableAdvice": "다음에 시도할 것"
    }
}`
    };

    return prompts[language];
}

// Generate overall summary for guest analysis
function generateGuestOverallSummary(
    segments: GuestSegmentAnalysis[],
    language: 'ja' | 'en' | 'ko' = 'ja'
): GuestAnalysisResult['overallSummary'] {
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
                howToCheck: ''
            }
        };
    }

    // Count macro concepts
    const conceptCounts: Record<string, number> = {};
    for (const seg of segments) {
        const concept = seg.winningPattern?.macroConceptUsed || '';
        if (concept) {
            conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
        }
    }

    const mostCommonConcept = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Push and Rotate';

    const summaryTemplates = {
        ja: {
            mainIssue: '分析した3つのシーンで共通して見られる課題があります。',
            title: mostCommonConcept,
            description: `${mostCommonConcept}の概念を意識してプレイすることで改善できます。`,
            howToCheck: '次の試合で意識してプレイし、改善を確認しましょう。'
        },
        en: {
            mainIssue: 'Common issues found across the 3 analyzed scenes.',
            title: mostCommonConcept,
            description: `Focus on the ${mostCommonConcept} concept to improve.`,
            howToCheck: 'Be conscious of this in your next game and verify improvement.'
        },
        ko: {
            mainIssue: '분석한 3개의 장면에서 공통적으로 보이는 과제가 있습니다.',
            title: mostCommonConcept,
            description: `${mostCommonConcept} 개념을 의식하며 플레이하면 개선할 수 있습니다.`,
            howToCheck: '다음 게임에서 이것을 의식하며 플레이하고 개선을 확인하세요.'
        }
    };

    return {
        mainIssue: summaryTemplates[language].mainIssue,
        homework: {
            title: summaryTemplates[language].title,
            description: summaryTemplates[language].description,
            howToCheck: summaryTemplates[language].howToCheck
        }
    };
}

// Main analysis function for guests and free members
export async function performGuestAnalysis(
    request: GuestAnalysisRequest
): Promise<GuestAnalysisResult> {
    const apiKey = GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return {
            success: false,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
            error: "API Key not found",
            isGuest: true,
            remainingCredits: 0
        };
    }

    const isGuest = await isGuestUser();
    let remainingCredits = 0;

    // Check and consume credits
    if (isGuest) {
        const creditResult = await useGuestCredit();
        if (!creditResult.success) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "クレジットが不足しています。アカウント登録で週3回まで分析できます！",
                isGuest: true,
                remainingCredits: creditResult.remainingCredits
            };
        }
        remainingCredits = creditResult.remainingCredits;
    } else {
        // Free/Premium member - use existing system
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "認証が必要です",
                isGuest: false,
                remainingCredits: 0
            };
        }

        const status = await getAnalysisStatus();
        if (!status) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "プロフィールが見つかりません",
                isGuest: false,
                remainingCredits: 0
            };
        }

        const weeklyCount = status.weekly_analysis_count || 0;
        const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;

        if (weeklyCount >= limit) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: status.is_premium
                    ? `週間制限に達しました (${weeklyCount}/${limit})。月曜日にリセットされます。`
                    : `無料プランの週間制限に達しました。プレミアムプランで週20回まで分析できます！`,
                isGuest: false,
                remainingCredits: 0
            };
        }

        // Increment usage for free/premium members
        await supabase.from("profiles").update({
            weekly_analysis_count: weeklyCount + 1
        }).eq("id", user.id);

        remainingCredits = limit - weeklyCount - 1;
    }

    const lang = request.language || 'ja';

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const callGeminiWithRetry = async (parts: any[], maxRetries: number = 3): Promise<string> => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await model.generateContent(parts);
                    return result.response.text();
                } catch (error: any) {
                    const is429 = error.message?.includes('429') ||
                                  error.message?.includes('Too Many Requests') ||
                                  error.message?.includes('Resource exhausted');

                    if (is429 && attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`[GuestAnalysis] Rate limited, waiting ${waitTime}ms (attempt ${attempt})`);
                        await delay(waitTime);
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries exceeded');
        };

        const segmentResults: GuestSegmentAnalysis[] = [];
        const segmentErrors: string[] = [];

        // Use provided segments (free member) or fixed segments (guest)
        const segmentsToProcess: (GuestSegment | FreeSegmentInfo)[] =
            request.segments && request.segments.length > 0
                ? request.segments
                : [...GUEST_FIXED_SEGMENTS];

        // Process segments sequentially (rate limiting)
        for (let i = 0; i < segmentsToProcess.length; i++) {
            if (i > 0) {
                await delay(1500); // Rate limiting delay
            }

            const segment = segmentsToProcess[i];
            const segmentFrames = request.frames.filter(f => f.segmentId === segment.segmentId);

            if (segmentFrames.length === 0) {
                segmentErrors.push(`Segment ${segment.segmentId}: No frames`);
                continue;
            }

            try {
                const prompt = generateGuestAnalysisPrompt(segment, lang);
                const parts: any[] = [prompt];

                for (const frame of segmentFrames) {
                    const matches = frame.base64Data.match(/^data:(.+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        parts.push({
                            inlineData: { data: matches[2], mimeType: matches[1] }
                        });
                    }
                }

                const text = await callGeminiWithRetry(parts);
                const cleanedText = text
                    .replace(/^```json\s*/, "")
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");

                const analysisData = JSON.parse(cleanedText);

                segmentResults.push({
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    improvement: analysisData.improvement
                });
            } catch (segError: any) {
                console.error(`[GuestAnalysis] Segment ${i} error:`, segError.message);
                segmentErrors.push(`Segment ${segment.segmentId}: ${segError.message}`);
            }
        }

        const overallSummary = generateGuestOverallSummary(segmentResults, lang);

        return {
            success: true,
            analyzedAt: new Date().toISOString(),
            segments: segmentResults,
            overallSummary,
            warnings: segmentErrors.length > 0 ? segmentErrors : undefined,
            requestedSegments: segmentsToProcess.length,
            completedSegments: segmentResults.length,
            timeOffset: request.timeOffset,
            isGuest,
            remainingCredits
        };

    } catch (error: any) {
        console.error("[performGuestAnalysis] Error:", error);
        return {
            success: false,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
            error: error.message,
            isGuest,
            remainingCredits
        };
    }
}

// ============================================================
// Guest Micro Analysis
// ============================================================

export type GuestMicroAnalysisRequest = {
    frames: string[]; // Base64 Data URLs
    language?: 'ja' | 'en' | 'ko';
    matchId?: string;
    puuid?: string;
    analysisStartGameTime?: number;
    analysisEndGameTime?: number;
};

export type GuestMicroAnalysisResult = {
    success: boolean;
    result?: VisionAnalysisResult;
    error?: string;
    isGuest: boolean;
    remainingCredits: number;
};

export async function performGuestMicroAnalysis(
    request: GuestMicroAnalysisRequest
): Promise<GuestMicroAnalysisResult> {
    const apiKey = GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return { success: false, error: "API Key not found", isGuest: true, remainingCredits: 0 };
    }

    const isGuest = await isGuestUser();
    let remainingCredits = 0;

    // Check and consume credits (same logic as performGuestAnalysis)
    if (isGuest) {
        const creditResult = await useGuestCredit();
        if (!creditResult.success) {
            return {
                success: false,
                error: "クレジットが不足しています。アカウント登録で週3回まで分析できます！",
                isGuest: true,
                remainingCredits: creditResult.remainingCredits
            };
        }
        remainingCredits = creditResult.remainingCredits;
    } else {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "認証が必要です", isGuest: false, remainingCredits: 0 };
        }

        const status = await getAnalysisStatus();
        if (!status) {
            return { success: false, error: "プロフィールが見つかりません", isGuest: false, remainingCredits: 0 };
        }

        const weeklyCount = status.weekly_analysis_count || 0;
        const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;

        if (weeklyCount >= limit) {
            return {
                success: false,
                error: status.is_premium
                    ? `週間制限に達しました (${weeklyCount}/${limit})。月曜日にリセットされます。`
                    : `無料プランの週間制限に達しました。プレミアムプランで週20回まで分析できます！`,
                isGuest: false,
                remainingCredits: 0
            };
        }

        await supabase.from("profiles").update({
            weekly_analysis_count: weeklyCount + 1
        }).eq("id", user.id);

        remainingCredits = limit - weeklyCount - 1;
    }

    const lang = request.language || 'ja';

    try {
        // Fetch match context if available
        const version = await fetchLatestVersion();
        let matchContextStr = "";
        let myChampName = "Unknown";
        let truthEvents: any[] = [];
        let champAttrs: any = null;

        if (request.matchId && request.puuid) {
            console.log(`[GuestMicro] Fetching match context for ${request.matchId}...`);
            const [matchRes, timelineRes] = await Promise.all([
                fetchMatchDetail(request.matchId),
                fetchMatchTimeline(request.matchId)
            ]);

            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: any) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) {
                    myChampName = me.championName;
                    champAttrs = await getChampionAttributes(me.championName);
                }
                const allies = parts.filter((p: any) => p.teamId === myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: any) => p.teamId !== myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);

                matchContextStr = `
                【コンテキスト (Identity)】
                視点主（あなた）: ${myChampName}
                ・役割: ${champAttrs?.identity || "不明"} (クラス: ${champAttrs?.class || "不明"})
                ・特性ノート: ${champAttrs?.notes || "なし"}

                味方チーム: ${allies.join(", ")}
                敵チーム: ${enemies.join(", ")}
                ※ 画像認識で迷った場合は、**必ずこのリストの中から**選んでください。
                `;
            }

            if (timelineRes.success) {
                const allEvents = await extractMatchEvents(timelineRes.data, request.puuid);
                truthEvents = allEvents.filter(e => e.type === 'KILL' || e.type === 'OBJECTIVE');
            }
        }

        // Build micro analysis prompt
        const langInstructions: Record<string, string> = {
            ja: '**重要**: 以下のJSONフィールドは全て日本語で出力してください: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment内の説明文。\nenumの値(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOODなど)は英語のままにしてください。',
            en: '**IMPORTANT**: Output ALL text fields in English: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment descriptions.\nKeep enum values (WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD, etc.) in English.',
            ko: '**중요**: 다음 JSON 필드는 모두 한국어로 출력하세요: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment 설명문.\nenum 값(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD 등)은 영어로 유지하세요.'
        };

        let relevantTruthEvents = truthEvents;
        if (request.analysisStartGameTime !== undefined && request.analysisEndGameTime !== undefined) {
            const startMs = request.analysisStartGameTime * 1000;
            const endMs = request.analysisEndGameTime * 1000;
            relevantTruthEvents = truthEvents.filter((e: any) =>
                e.timestamp >= startMs && e.timestamp <= endMs
            );
        }

        const champClass = champAttrs?.class || 'Unknown';
        let classSpecificPrompt = '';
        if (champClass === 'Assassin') classSpecificPrompt = '- Did they look for opportunities to burst squishies?\n- Did they manage their escape/engage cooldowns?';
        else if (champClass === 'Marksman' || champClass === 'ADC') classSpecificPrompt = '- Are they kiting properly (attack-move)?\n- Are they maintaining safe distance while dealing damage?';
        else if (champClass === 'Mage') classSpecificPrompt = '- Are they spacing correctly for their range?\n- Are they using abilities at optimal range?';
        else if (champClass === 'Fighter' || champClass === 'Bruiser') classSpecificPrompt = '- Are they managing their sustained damage correctly?\n- Are they using defensive abilities at the right time?';
        else if (champClass === 'Tank') classSpecificPrompt = '- Are they absorbing damage for carries?\n- Are they using CC at optimal times?';
        else if (champClass === 'Support') classSpecificPrompt = '- Are they protecting their carry?\n- Are they landing key CC abilities?';

        const promptText = `
You are an elite League of Legends micro-mechanics coach specializing in mechanical skill analysis, combat execution, and in-the-moment decision making.

${langInstructions[lang] || langInstructions.ja}

**【CONTEXT】**
${matchContextStr}

**【IMPORTANT RULES】**
- **MICRO ONLY**: Do NOT mention macro strategy (dragon control, lane rotation, map movements). Focus ONLY on mechanical execution.
- **NO BLAME**: Do not criticize teammates or external factors.
- **EVIDENCE-BASED**: Only reference kills/deaths from the Truth Events below. Do not hallucinate events.

**【TRUTH EVENTS (from Riot API)】**
${JSON.stringify(relevantTruthEvents.slice(0, 20))}

**【ANALYSIS FRAMEWORK】**

1. **SITUATION SNAPSHOT**: Read the screen to determine:
   - HP%, Mana%, Level of BOTH players (estimate from health bars)
   - Which abilities appear to be on cooldown (grey icons)
   - Minion count advantage (count the minions!)
   - Wave position relative to towers

2. **TRADE ANALYSIS**: If any damage exchange occurred:
   - Who won the trade and by how much HP?
   - WHY did they win/lose? (cooldowns, minion aggro, positioning)
   - Was it the right time to trade based on resources?

3. **MECHANICS EVALUATION**:
   - **Skill Usage**: Did they hit skillshots? Good timing?
   - **Skill Dodging**: Did they dodge enemy abilities? How?
   - **Auto-Attack Weaving**: Are they weaving AAs between abilities?
   - **Positioning**: Are they in a safe position relative to enemy threat range?

4. **CHAMPION-SPECIFIC ANALYSIS**:
   - Champion: ${myChampName}
   - Class: ${champClass}
   - Identity: ${champAttrs?.identity || 'Unknown'}
   - For ${champClass}, evaluate their role-specific execution:
     ${classSpecificPrompt}

5. **SKILL LEVEL ASSESSMENT**: Based on the observed mechanics, estimate if the player is:
   - BEGINNER: Missing basic mechanics, needs fundamentals
   - INTERMEDIATE: Has basics but inconsistent execution
   - ADVANCED: Good mechanics but needs optimization

**Current LoL Version: ${version}**

**【OUTPUT FORMAT (JSON)】**
{
    "observed_champions": [{ "name": "ChampionName", "evidence": "How you identified them" }],
    "summary": "Brief factual summary of what happened in the clip",
    "mistakes": [
        { "timestamp": "mm:ss", "title": "Short title", "severity": "CRITICAL" | "MINOR", "advice": "Specific fix" }
    ],
    "finalAdvice": "Overall micro advice summary",
    "initialGameTime": "mm:ss",
    "enhanced": {
        "situationSnapshot": {
            "gameTime": "mm:ss",
            "myStatus": {
                "hpPercent": 0-100,
                "manaPercent": 0-100,
                "level": 1-18,
                "ultimateReady": true/false/"unknown",
                "summonerSpells": "Flash ✓ / Ignite ✓",
                "keyAbilitiesReady": "Q✓ W✓ E✗"
            },
            "enemyStatus": {
                "hpPercent": 0-100,
                "manaPercent": 0-100,
                "level": 1-18,
                "ultimateReady": true/false/"unknown",
                "summonerSpells": "Flash ? / Teleport ?",
                "keyAbilitiesReady": "Q? W✓ E?"
            },
            "environment": {
                "minionAdvantage": "6 vs 3 (advantage)",
                "wavePosition": "center" | "pushing" | "pulling" | "frozen",
                "junglerThreat": "unknown" | "visible top" | "likely bot",
                "visionControl": "river warded" | "no vision"
            }
        },
        "tradeAnalysis": {
            "tradeOccurred": true/false,
            "outcome": "WIN" | "LOSE" | "EVEN" | "NO_TRADE",
            "hpExchanged": { "damageGiven": "~30%", "damageTaken": "~50%" },
            "reason": "Why the trade was won/lost",
            "shouldHaveTraded": true/false,
            "optimalAction": "What should have been done instead",
            "cooldownContext": "Enemy Q was on ~6s cooldown"
        },
        "mechanicsEvaluation": {
            "skillsUsed": [
                { "skill": "Q", "used": true, "hit": true, "timing": "GOOD", "note": "Hit enemy during their animation" }
            ],
            "skillsDodged": [
                { "enemySkill": "Ahri E", "dodged": true, "method": "sidestep", "difficulty": "MEDIUM" }
            ],
            "autoAttackWeaving": "GOOD" | "NEEDS_WORK" | "POOR",
            "comboExecution": "Description of combo performance",
            "positioningScore": "GOOD" | "RISKY" | "POOR",
            "positioningNote": "Why positioning was good/bad"
        },
        "improvements": [
            {
                "priority": "HIGH" | "MEDIUM" | "LOW",
                "category": "TRADING" | "DODGING" | "COOLDOWN_TRACKING" | "POSITIONING" | "COMBO" | "RESOURCE_MANAGEMENT",
                "title": "Short improvement title",
                "currentBehavior": "What player is doing now",
                "idealBehavior": "What they should do",
                "practice": "How to practice this",
                "championSpecific": true/false
            }
        ],
        "championContext": {
            "championName": "${myChampName}",
            "role": "${champClass}",
            "playstyleAdvice": "General advice for this champion/role",
            "keyCombo": "The key combo to master for this champion"
        },
        "skillLevel": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        "overallGrade": "S" | "A" | "B" | "C" | "D"
    }
}
`;

        // Multi-model fallback
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite"
        ];
        const errors: string[] = [];
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        let analysisData: VisionAnalysisResult | null = null;

        for (const modelName of modelsToTry) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    console.log(`[GuestMicro] Attempting ${modelName} (Try ${retryCount + 1})`);
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.0,
                            maxOutputTokens: 8192
                        }
                    });

                    const parts: any[] = [promptText];
                    const MAX_FRAMES = 30;
                    const framesToProcess = request.frames.slice(0, MAX_FRAMES);

                    framesToProcess.forEach((frame) => {
                        const matches = frame.match(/^data:(.+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            parts.push({
                                inlineData: { data: matches[2], mimeType: matches[1] }
                            });
                        }
                    });

                    if (parts.length <= 1) throw new Error("No frames provided");
                    console.log(`[GuestMicro] Sending ${parts.length - 1} frames to ${modelName}`);

                    const result = await model.generateContent(parts);
                    const rawText = result.response.text();
                    const text = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

                    if (text.length > 100 * 1024) {
                        throw new Error(`Response too large (${Math.round(text.length / 1024)}KB)`);
                    }

                    const trimmedText = text.trim();
                    if (!trimmedText.endsWith('}')) {
                        throw new Error(`Response truncated (${text.length} chars)`);
                    }

                    analysisData = JSON.parse(text) as VisionAnalysisResult;

                    // Time sync
                    if ((analysisData as any).initialGameTime) {
                        const initTimeStr = (analysisData as any).initialGameTime;
                        const [m, s] = initTimeStr.split(':').map(Number);
                        if (!isNaN(m) && !isNaN(s)) {
                            analysisData.timeOffset = -(m * 60 + s);
                        }
                    }

                    break; // Success
                } catch (e: any) {
                    console.warn(`[GuestMicro] Error ${modelName}:`, e.message);
                    errors.push(`${modelName}: ${e.message}`);
                    if (e.message?.includes('429')) {
                        await sleep(5000);
                        retryCount++;
                        continue;
                    }
                    break; // Next model
                }
            }
            if (analysisData) break;
        }

        if (!analysisData) {
            throw new Error(`All models failed: ${errors.join(" | ")}`);
        }

        return {
            success: true,
            result: analysisData,
            isGuest,
            remainingCredits
        };

    } catch (error: any) {
        console.error("[performGuestMicroAnalysis] Error:", error);
        return {
            success: false,
            error: error.message,
            isGuest,
            remainingCredits
        };
    }
}
