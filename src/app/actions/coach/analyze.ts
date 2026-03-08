'use server';

import { isValidGeminiApiKey } from "@/lib/gemini";
import { matchIdSchema, puuidSchema, localeSchema } from '@/lib/validation';
import { logger } from "@/lib/logger";

import type { AnalysisResult, AnalysisFocus } from "./types";
import { generateSystemPrompt } from "./prompt";
import { checkAndDebitCredit, refundCredit } from "./credit";
import { buildAnalysisContext } from "./context";
import { callGeminiWithFallback } from "./ai";
import { postprocessAnalysisResult } from "./postprocess";

export async function analyzeMatchTimeline(
    matchId: string,
    puuid: string,
    userApiKey?: string,
    focus?: AnalysisFocus,
    locale: string = "ja",
    skipCreditCheck: boolean = false
): Promise<{ success: boolean, data?: AnalysisResult, error?: string }> {
    // 1. Input validation
    if (!matchIdSchema.safeParse(matchId).success) return { success: false, error: "Invalid match ID" };
    if (!puuidSchema.safeParse(puuid).success) return { success: false, error: "Invalid PUUID" };
    if (!localeSchema.safeParse(locale).success) locale = "ja";
    if (userApiKey && !isValidGeminiApiKey(userApiKey)) return { success: false, error: "Invalid API key format." };

    // 2. Auth + Credit check/debit
    const creditResult = await checkAndDebitCredit(userApiKey, skipCreditCheck);
    if (!creditResult.success) return { success: false, error: creditResult.error };

    const { userId, apiKeyToUse, debited, supabase } = creditResult;

    try {
        // 3. Build match context (data fetch + event extraction + macro advice)
        const contextResult = await buildAnalysisContext(matchId, puuid, focus);
        if (!contextResult.success) return { success: false, error: contextResult.error };

        const ctx = contextResult.context;

        // 4. Generate system prompt
        const systemPrompt = generateSystemPrompt(
            ctx.rankTier,
            ctx.userItems,
            ctx.opponentItemsStr,
            ctx.events,
            ctx.userPart,
            ctx.opponentPart,
            ctx.champAttrs,
            focus,
            ctx.latestVersion,
            locale,
            ctx.keyFrameStats,
            ctx.roleMap,
            ctx.combinedMacroAdvice
        );

        // 5. Call AI with model fallback
        const aiResult = await callGeminiWithFallback(apiKeyToUse, systemPrompt);
        if (!aiResult.success) return { success: false, error: aiResult.error };

        // 6. Post-process: item mapping + insight validation
        const postResult = postprocessAnalysisResult(
            aiResult.result,
            ctx.userItems,
            ctx.opponentItems,
            ctx.opponentPart?.championName || "Unknown",
            ctx.itemMap,
            ctx.events
        );

        return postResult;

    } catch (e) {
        logger.error("[Coach] Analysis failed");
        // Refund credit on failure (DEBIT-FIRST pattern)
        if (debited) {
            await refundCredit(supabase, userId);
        }
        const msg = e instanceof Error ? e.message : String(e);
        const isUserFacing = msg.startsWith("⚠️") || msg.includes("API Key") || msg.includes("Not authenticated");
        return { success: false, error: isUserFacing ? msg : "Coaching analysis failed. Please try again later." };
    }
}
