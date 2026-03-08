'use server';

import { after } from "next/server";
import { createClient, getUser } from "@/utils/supabase/server";
import { getGeminiClient, isValidGeminiApiKey, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { fetchMatchDetail } from "../riot";
import { refreshAnalysisStatus } from "../analysis";
import { getWeeklyLimit, FREE_INTER_SEGMENT_DELAY_MS, type AnalysisStatus } from "../constants";
import { matchIdSchema, puuidSchema, jobIdSchema } from "@/lib/validation";
import type {
    VideoMacroAnalysisRequest,
    VideoMacroAnalysisResult,
    SegmentAnalysis,
    VideoMacroSegment,
} from "./types";
import { generateVideoMacroPrompt, generateOverallSummary } from "./prompt";
import { generateBuildRecommendation } from "./buildRecommendation";
import { buildMatchContext } from "./helpers";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/retry";
import { processWithConcurrency } from "@/lib/concurrency";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Start a macro analysis job that runs in the background.
 * Returns immediately with a job ID that can be polled for progress.
 */
export async function startVideoMacroAnalysis(
    request: VideoMacroAnalysisRequest,
    userApiKey?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    if (!matchIdSchema.safeParse(request.matchId).success) return { success: false, error: "Invalid match ID" };
    if (!puuidSchema.safeParse(request.puuid).success) return { success: false, error: "Invalid PUUID" };
    if (request.frames && request.frames.length > 30) return { success: false, error: "Too many frames (max 30)" };
    if (userApiKey && !isValidGeminiApiKey(userApiKey)) return { success: false, error: "Invalid API key format." };
    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Check limits before starting
    const status = await refreshAnalysisStatus(user.id);
    if (!status) {
        return { success: false, error: "User profile not found" };
    }

    let useEnvKey = false;
    let shouldIncrementCount = false;
    const weeklyCount = status.weekly_analysis_count || 0;
    const weeklyLimit = getWeeklyLimit(status);

    if (status.is_premium) {
        if (weeklyCount >= weeklyLimit) {
            return { success: false, error: "WEEKLY_LIMIT_REACHED" };
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        // Free User — BYOK is Premium-only
        if (userApiKey) {
            return { success: false, error: "CUSTOM_KEY_PREMIUM_ONLY" };
        }
        if (weeklyCount < weeklyLimit) {
            useEnvKey = true;
            shouldIncrementCount = true;
        } else {
            return { success: false, error: "FREE_WEEKLY_LIMIT_REACHED" };
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
        logger.error("[startVideoMacroAnalysis] Failed to create job:", jobError);
        return { success: false, error: "Database error: Could not start analysis job" };
    }

    // Run analysis in background using Next.js after() to prevent job loss in serverless
    after(async () => {
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
            logger.error(`[VideoMacro Job ${job.id}] Uncaught error:`, e);
            // Update job status to failed
            const adminClient = await createClient();
            await adminClient
                .from("video_analyses")
                .update({
                    status: "failed",
                    error: (e as Error).message
                })
                .eq("id", job.id);
        }
    });

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
    status: AnalysisStatus,
    useEnvKey: boolean,
    apiKey: string,
    shouldIncrementCount: boolean
): Promise<void> {
    const supabase = await createClient();

    // --- DEBIT-FIRST: Consume count BEFORE AI call ---
    let debited = false;
    if (shouldIncrementCount) {
        const limit = getWeeklyLimit(status);
        await supabase.rpc('increment_weekly_count', { p_user_id: userId, p_limit: limit });
        debited = true;
    }

    try {
        // Fetch match context
        const matchRes = await fetchMatchDetail(request.matchId);
        if (!matchRes.success || !matchRes.data) {
            throw new Error("Failed to fetch match data");
        }

        const participants = matchRes.data.info.participants;
        const me = participants.find((p) => p.puuid === request.puuid);
        if (!me) {
            throw new Error("Player not found in match");
        }

        const lang = request.language || 'ja';
        const matchContext = buildMatchContext(me, participants, request.puuid, lang);

        // Initialize Gemini
        const genAI = getGeminiClient(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODELS_TO_TRY[1],
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.4
            }
        });

        // Analyze each segment
        const segmentResults: SegmentAnalysis[] = [];
        const segmentErrors: string[] = [];
        const isPremium = status.is_premium;

        const analyzeSegment = async (segment: VideoMacroSegment, segmentIndex: number): Promise<SegmentAnalysis | null> => {
            try {
                const segmentFrames = request.frames
                    .filter(f => f.segmentId === segment.segmentId)
                    .sort((a, b) => a.gameTime - b.gameTime);

                if (segmentFrames.length === 0) {
                    segmentErrors.push(`Segment ${segment.segmentId}: No frames`);
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
            } catch (segError) {
                const segMsg = segError instanceof Error ? segError.message : String(segError);
                logger.error(`[VideoMacro Job ${jobId}] Segment ${segmentIndex + 1} error:`, segMsg);
                segmentErrors.push(`Segment ${segment.segmentId}: ${segMsg}`);
                return null;
            }
        };

        // Process segments: Limited parallel for Premium, Sequential for Free
        if (isPremium) {
            const concurrency = 3;
            const tasks = request.segments.map((segment, index) => () => analyzeSegment(segment, index));
            const results = await processWithConcurrency(tasks, concurrency);
            results.forEach(result => { if (result) segmentResults.push(result); });
        } else {
            for (let i = 0; i < request.segments.length; i++) {
                if (i > 0) await delay(FREE_INTER_SEGMENT_DELAY_MS);
                const result = await analyzeSegment(request.segments[i], i);
                if (result) segmentResults.push(result);
            }
        }

        // Generate overall summary
        const overallSummary = generateOverallSummary(segmentResults, lang);

        // Generate build recommendation
        let buildRecommendation = null;
        try {
            buildRecommendation = await generateBuildRecommendation(matchRes.data, request.puuid, model, lang);
        } catch (e) {
            logger.error(`[VideoMacro Job ${jobId}] Build recommendation error:`, e);
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
            .update({ status: "completed", result })
            .eq("id", jobId);

    } catch (error) {
        logger.error(`[VideoMacro Job ${jobId}] Failed:`, error);
        // Refund credit on failure (DEBIT-FIRST pattern)
        if (debited) {
            try {
                await supabase.rpc('decrement_weekly_count', { p_user_id: userId });
            } catch (refundErr) {
                logger.error(`[VideoMacro Job ${jobId}] Weekly count refund failed:`, refundErr);
            }
        }

        await supabase
            .from("video_analyses")
            .update({
                status: "failed",
                error: "ANALYSIS_FAILED",
                result: {
                    success: false,
                    matchId: request.matchId,
                    analyzedAt: '',
                    segments: [],
                    overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } },
                    error: "ANALYSIS_FAILED"
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
    if (!jobIdSchema.safeParse(jobId).success) return { status: 'not_found', error: 'Invalid job ID' };
    const supabase = await createClient();

    const user = await getUser();
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
    if (!matchIdSchema.safeParse(matchId).success) return { found: false };
    const supabase = await createClient();

    const user = await getUser();
    if (!user) {
        return { found: false };
    }

    const { data, error } = await supabase
        .from("video_analyses")
        .select("result, analysis_type, inputs")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error || !data || data.length === 0) {
        return { found: false };
    }

    const macroRecord = data.find(record =>
        record.analysis_type === 'macro' ||
        (record.inputs && (record.inputs as { mode?: string }).mode === 'MACRO')
    );

    if (!macroRecord || !macroRecord.result) {
        return { found: false };
    }

    return {
        found: true,
        result: macroRecord.result as VideoMacroAnalysisResult
    };
}
