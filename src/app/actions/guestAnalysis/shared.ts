import type { VisionAnalysisResult } from "../vision";
import type { GuestSegment } from "../guestConstants";
import { z } from "zod";

// ============================================================
// Types
// ============================================================

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
    // Cloudflare Turnstile token for bot protection
    turnstileToken?: string;
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

export type GuestMicroAnalysisRequest = {
    frames: string[]; // Base64 Data URLs
    language?: 'ja' | 'en' | 'ko';
    matchId?: string;
    puuid?: string;
    analysisStartGameTime?: number;
    analysisEndGameTime?: number;
    turnstileToken?: string;
};

export type GuestMicroAnalysisResult = {
    success: boolean;
    result?: VisionAnalysisResult;
    error?: string;
    isGuest: boolean;
    remainingCredits: number;
};

// ============================================================
// Zod schemas for input validation
// ============================================================

export const guestAnalysisRequestSchema = z.object({
    frames: z.array(z.object({
        segmentId: z.number().int().min(0).max(10),
        frameIndex: z.number().int().min(0).max(30),
        gameTime: z.number().min(0).max(7200),
        base64Data: z.string().max(2 * 1024 * 1024).regex(/^data:(image\/(png|jpeg|webp));base64,/, "Invalid image data URL"),
    })).min(1).max(50),
    language: z.enum(["ja", "en", "ko"]).optional(),
    timeOffset: z.number().optional(),
    matchId: z.string().max(30).optional(),
    segments: z.array(z.object({
        segmentId: z.number().int().min(0).max(10),
        targetTimestamp: z.number(),
        targetTimestampStr: z.string(),
        eventDescription: z.string(),
        type: z.string(),
        analysisStartTime: z.number(),
        analysisEndTime: z.number(),
    })).max(10).optional(),
    turnstileToken: z.string().max(4096).optional(),
});

export const microAnalysisRequestSchema = z.object({
    frames: z.array(z.string().max(2 * 1024 * 1024)).min(1).max(10),
    language: z.enum(["ja", "en", "ko"]).optional(),
    matchId: z.string().max(30).optional(),
    puuid: z.string().max(90).optional(),
    analysisStartGameTime: z.number().min(0).max(7200).optional(),
    analysisEndGameTime: z.number().min(0).max(7200).optional(),
    turnstileToken: z.string().max(4096).optional(),
});

// ============================================================
// Constants
// ============================================================

export const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

// ============================================================
// Prompt builders & helpers
// ============================================================

// Simplified prompt for guest/free member analysis
export function generateGuestAnalysisPrompt(
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
export function generateGuestOverallSummary(
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
