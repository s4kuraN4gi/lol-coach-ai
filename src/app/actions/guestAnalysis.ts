"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getGuestCreditStatus, useGuestCredit, isGuestUser } from "./guestCredits";
import { getAnalysisStatus } from "./analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "./constants";
import { GUEST_FIXED_SEGMENTS, type GuestSegment } from "./guestConstants";

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
