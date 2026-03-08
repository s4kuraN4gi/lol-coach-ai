'use server';

import { createClient, getUser } from "@/utils/supabase/server";
import { getGeminiClient, isValidGeminiApiKey, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { fetchMatchDetail } from "../riot";
import { refreshAnalysisStatus } from "../analysis";
import { getWeeklyLimit, FREE_INTER_SEGMENT_DELAY_MS } from "../constants";
import type {
    VideoMacroAnalysisRequest,
    VideoMacroAnalysisResult,
    SegmentAnalysis,
    VideoMacroSegment,
    MatchContext,
} from "./types";
import { generateVideoMacroPrompt, generateOverallSummary } from "./prompt";
import { generateBuildRecommendation } from "./buildRecommendation";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/retry";
import { processWithConcurrency } from "@/lib/concurrency";
import { buildMatchContext, emptyResult, ROLE_MAPS } from "./helpers";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeVideoMacro(
    request: VideoMacroAnalysisRequest,
    userApiKey?: string
): Promise<VideoMacroAnalysisResult> {
    if (userApiKey && !isValidGeminiApiKey(userApiKey)) {
        return emptyResult(request.matchId, "Invalid API key format.");
    }
    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
        return emptyResult(request.matchId, "Not authenticated");
    }

    // Check limits
    const status = await refreshAnalysisStatus(user.id);
    if (!status) {
        return emptyResult(request.matchId, "User profile not found");
    }

    let useEnvKey = false;
    let shouldIncrementCount = false;
    const weeklyCount = status.weekly_analysis_count || 0;
    const weeklyLimit = getWeeklyLimit(status);

    if (status.is_premium) {
        if (weeklyCount >= weeklyLimit) {
            return emptyResult(request.matchId, `週間制限に達しました (${weeklyCount}/${weeklyLimit})。月曜日にリセットされます。`);
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        if (userApiKey) {
            return emptyResult(request.matchId, "自前APIキーの利用はPremiumプラン限定です。");
        }
        if (weeklyCount >= weeklyLimit) {
            return emptyResult(request.matchId, `無料プランの週間制限に達しました (${weeklyCount}/${weeklyLimit})。月曜日にリセットされます。プレミアムプランへのアップグレードで週20回まで分析できます。`);
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    }

    const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
    if (!apiKeyToUse) {
        return emptyResult(request.matchId, "API Key not found");
    }

    // --- DEBIT-FIRST: Consume count BEFORE AI call ---
    let debited = false;
    if (shouldIncrementCount) {
        const limit = getWeeklyLimit(status);
        await supabase.rpc('increment_weekly_count', { p_user_id: user.id, p_limit: limit });
        debited = true;
    }

    try {
        const matchRes = await fetchMatchDetail(request.matchId);
        if (!matchRes.success || !matchRes.data) {
            logger.error("[MacroAnalysis] fetchMatchDetail failed:", matchRes.error);
            return emptyResult(request.matchId, `Failed to fetch match data: ${matchRes.error || 'unknown'}`);
        }

        const participants = matchRes.data.info.participants;
        const me = participants.find((p) => p.puuid === request.puuid);
        if (!me) {
            return emptyResult(request.matchId, "Player not found in match");
        }

        const lang = request.language || 'ja';
        const matchContext = buildMatchContext(me, participants, request.puuid, lang);

        // Initialize Gemini
        const genAI = getGeminiClient(apiKeyToUse);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODELS_TO_TRY[1],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });

        // Start build recommendation generation in parallel (non-blocking)
        const buildPromise = generateBuildRecommendation(matchRes.data, request.puuid, model, lang);

        // Analyze each segment with rate limit handling
        const segmentResults: SegmentAnalysis[] = [];
        const segmentErrors: string[] = [];
        const isPremium = status.is_premium;

        const analyzeSegment = async (segment: VideoMacroSegment): Promise<SegmentAnalysis | null> => {
            const segmentFrames = request.frames.filter(f => f.segmentId === segment.segmentId);

            if (segmentFrames.length === 0) {
                const errorMsg = `Segment ${segment.segmentId}: No frames available`;
                logger.warn(`[VideoMacro] ${errorMsg}`);
                segmentErrors.push(errorMsg);
                return null;
            }

            const prompt = generateVideoMacroPrompt(segment, matchContext, lang);
            const parts: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];
            for (const frame of segmentFrames) {
                const matches = frame.base64Data.match(/^data:(.+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    parts.push({ inlineData: { data: matches[2], mimeType: matches[1] } });
                }
            }

            try {
                const text = await geminiRetry(
                    () => model.generateContent(parts).then((r) => r.response.text()),
                    { maxRetries: 5, label: 'VideoMacro' }
                );
                const cleanedText = text
                    .replace(/^```json\s*/, "")
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");

                const analysisData = JSON.parse(cleanedText);
                return {
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    gap: analysisData.gap
                };
            } catch (segmentError) {
                const errorMsg = `Segment ${segment.segmentId}: ${segmentError instanceof Error ? segmentError.message : 'Unknown error'}`;
                logger.error(`[VideoMacro] ${errorMsg}`, segmentError);
                segmentErrors.push(errorMsg);
                return null;
            }
        };

        if (isPremium) {
            const concurrency = 3;
            const tasks = request.segments.map((segment) => () => analyzeSegment(segment));
            const results = await processWithConcurrency(tasks, concurrency);
            results.forEach(result => { if (result) segmentResults.push(result); });
        } else {
            for (let i = 0; i < request.segments.length; i++) {
                if (i > 0) await delay(FREE_INTER_SEGMENT_DELAY_MS);
                const result = await analyzeSegment(request.segments[i]);
                if (result) segmentResults.push(result);
            }
        }

        if (segmentErrors.length > 0) {
            logger.warn(`[VideoMacro] Segment errors: ${segmentErrors.join(', ')}`);
        }

        const overallSummary = generateOverallSummary(segmentResults, lang);
        const buildRecommendation = await buildPromise;

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

    } catch (error) {
        logger.error("[analyzeVideoMacro] Error:", error);
        // Refund credit on failure (DEBIT-FIRST pattern)
        if (debited) {
            try {
                await supabase.rpc('decrement_weekly_count', { p_user_id: user.id });
            } catch (refundErr) {
                logger.error("[analyzeVideoMacro] Weekly count refund failed:", refundErr);
            }
        }
        return emptyResult(request.matchId, error instanceof Error ? error.message : String(error));
    }
}
