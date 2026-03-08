'use server';

import { after } from "next/server";
import { createClient, getUser } from "@/utils/supabase/server";
import { getGeminiClient, isValidGeminiApiKey, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { geminiRetry } from "@/lib/retry";
import { refreshAnalysisStatus } from "../analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT, EXTRA_WEEKLY_ANALYSIS_LIMIT } from "../constants";
import { fetchMatchDetail, fetchLatestVersion, fetchMatchTimeline, extractMatchEvents, getChampionAttributes } from "../riot";
import { logger } from "@/lib/logger";
import type { VisionAnalysisRequest, VisionAnalysisResult } from "./types";
import type { MatchV5Participant, TruthEvent } from "../riot/types";
import { buildVisionPrompt, LANG_INSTRUCTIONS } from "./prompt";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export async function startVisionAnalysis(
    request: VisionAnalysisRequest,
    userApiKey?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    if (userApiKey && !isValidGeminiApiKey(userApiKey)) {
        return { success: false, error: "Invalid API key format." };
    }

    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const status = await refreshAnalysisStatus(user.id);
    if (!status) return { success: false, error: "User profile not found." };

    if (!status.is_premium) {
        return { success: false, error: "PREMIUM_ONLY" };
    }

    const weeklyCount = status.weekly_analysis_count || 0;
    if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
        return { success: false, error: "WEEKLY_LIMIT_REACHED" };
    }

    const { data: job, error: jobError } = await supabase
        .from("video_analyses")
        .insert({
            user_id: user.id,
            match_id: request.matchId || "unknown",
            status: "processing",
            analysis_type: "micro",
            result: null,
            inputs: {
                mode: "MICRO",
                description: request.description,
                question: request.question,
                timestamp: new Date().toISOString()
            }
        })
        .select()
        .single();

    if (jobError || !job) {
        logger.error("Failed to create vision job:", jobError);
        return { success: false, error: "Database Error: Could not start analysis job." };
    }

    after(async () => {
        try {
            await performVisionAnalysis(job.id, request, user.id, userApiKey);
        } catch (e) {
            logger.error(`[Vision Job ${job.id}] Uncaught error in background analysis`);
        }
    });

    return { success: true, jobId: job.id };
}

async function performVisionAnalysis(
    jobId: string,
    request: VisionAnalysisRequest,
    userId: string,
    userApiKey?: string
) {
    const supabase = await createClient();
    let debited = false;
    let shouldIncrementCount = false;
    let useEnvKey = false;

    try {
        const status = await refreshAnalysisStatus(userId);
        if (!status) throw new Error("User profile missing during processing.");

        const weeklyCount = status.weekly_analysis_count || 0;
        if (status.is_premium) {
            useEnvKey = true;
            shouldIncrementCount = true;
            if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
                throw new Error("WEEKLY_LIMIT_REACHED");
            }
        } else {
            throw new Error("PREMIUM_ONLY");
        }

        const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
        if (!apiKeyToUse) throw new Error("API Key Not Found");

        // [DEBIT FIRST]
        if (shouldIncrementCount) {
            const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_weekly_count', {
                p_user_id: userId,
                p_limit: EXTRA_WEEKLY_ANALYSIS_LIMIT
            });
            if (rpcError || rpcResult === -1) {
                throw new Error("Failed to increment weekly count");
            }
            debited = true;
        }

        const version = await fetchLatestVersion();

        // Match context & truth events
        let matchContextStr = "";
        let myChampName = "Unknown";
        let truthEvents: TruthEvent[] = [];
        let champAttrs: Awaited<ReturnType<typeof getChampionAttributes>> = null;

        if (request.matchId && request.puuid) {
            const [matchRes, timelineRes] = await Promise.all([
                fetchMatchDetail(request.matchId),
                fetchMatchTimeline(request.matchId)
            ]);

            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: MatchV5Participant) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) {
                    myChampName = me.championName;
                    champAttrs = await getChampionAttributes(me.championName);
                }
                const allies = parts.filter((p: MatchV5Participant) => p.teamId === myTeamId).map((p: MatchV5Participant) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: MatchV5Participant) => p.teamId !== myTeamId).map((p: MatchV5Participant) => `${p.championName} (${p.teamPosition})`);

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

            if (timelineRes.success && timelineRes.data) {
                const allEvents = await extractMatchEvents(timelineRes.data, request.puuid);
                truthEvents = allEvents.filter(e => e.type === 'KILL' || e.type === 'OBJECTIVE');
            }
        }

        const errors: string[] = [];
        let analysisData: VisionAnalysisResult | null = null;
        let success = false;

        for (const modelName of GEMINI_MODELS_TO_TRY) {
            try {
                const genAI = getGeminiClient(apiKeyToUse);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.0,
                        maxOutputTokens: 8192
                    }
                });

                const lang = request.language || 'ja';

                let relevantTruthEvents = truthEvents;
                if (request.analysisStartGameTime !== undefined && request.analysisEndGameTime !== undefined) {
                    const startMs = request.analysisStartGameTime * 1000;
                    const endMs = request.analysisEndGameTime * 1000;
                    relevantTruthEvents = truthEvents.filter((e) =>
                        e.timestamp >= startMs && e.timestamp <= endMs
                    );
                }

                const promptText = buildVisionPrompt(
                    lang, LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.ja,
                    matchContextStr, relevantTruthEvents,
                    myChampName, champAttrs, version, request.question
                );

                const promptParts: (string | { inlineData: { data: string; mimeType: string } })[] = [promptText];

                const MAX_FRAMES = 30;
                const framesToProcess = request.frames.slice(0, MAX_FRAMES);

                framesToProcess.forEach((frame) => {
                    const matches = frame.match(/^data:(.+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        promptParts.push({
                            inlineData: { data: matches[2], mimeType: matches[1] }
                        });
                    }
                });

                if (promptParts.length <= 1) throw new Error("No frames provided");

                const result = await geminiRetry(
                    () => model.generateContent(promptParts),
                    { maxRetries: 3, label: `Vision Job ${jobId}` }
                );
                const rawText = result.response.text();
                const text = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

                const MAX_RESPONSE_SIZE = 100 * 1024;
                if (text.length > MAX_RESPONSE_SIZE) {
                    throw new Error(`Response too large (${Math.round(text.length / 1024)}KB). Model returned unexpected data.`);
                }

                const trimmedText = text.trim();
                if (!trimmedText.endsWith('}')) {
                    throw new Error(`Response truncated (${text.length} chars). Try reducing frame count.`);
                }

                analysisData = JSON.parse(text) as VisionAnalysisResult;

                // Time sync: extract initialGameTime → timeOffset
                const parsed = analysisData as VisionAnalysisResult & { initialGameTime?: string };
                if (parsed.initialGameTime) {
                    const initTimeStr = parsed.initialGameTime;
                    const [m, s] = initTimeStr.split(':').map(Number);
                    if (!isNaN(m) && !isNaN(s)) {
                        const gameTimeSec = m * 60 + s;
                        analysisData.timeOffset = -gameTimeSec;
                    }
                }

                success = true;
                break;

            } catch (e) {
                logger.warn(`[Vision Job ${jobId}] Error ${modelName}: model call failed`);
                errors.push(modelName);
                continue;
            }
        }

        if (!success || !analysisData) {
            throw new Error("All models failed for vision analysis");
        }

        // Champion validation (log-only)
        if (analysisData.observed_champions && myChampName !== "Unknown") {
            const validChampions = new Set([myChampName.toLowerCase()]);
            analysisData.observed_champions.forEach((obs) => {
                if (!validChampions.has(obs.name?.toLowerCase()) && obs.name) {
                    logger.warn(`[Vision Validation] Detected champion not in match context - marking as unverified`);
                }
            });
        }

        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: analysisData,
                time_offset: analysisData.timeOffset || 0,
                error: null
            })
            .eq("id", jobId);

    } catch (e) {
        logger.error(`[Vision Job ${jobId}] FAILED: Analysis could not be completed`);

        if (debited && shouldIncrementCount) {
            try {
                await supabase.rpc('decrement_weekly_count', { p_user_id: userId });
            } catch (refundError) {
                logger.error("[Vision] Refund of weekly count failed");
            }
        }

        await supabase
            .from("video_analyses")
            .update({
                status: "failed",
                error: "ANALYSIS_FAILED"
            })
            .eq("id", jobId);
    }
}

