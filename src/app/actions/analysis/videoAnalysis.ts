"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidGeminiApiKey } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { type AnalysisMode } from "../promptUtils";
import { getActiveSummoner } from "../profile";
import { fetchRank } from "../riot";
import { analyzeMatchTimeline } from "../coach";
import { refreshAnalysisStatus } from "./status";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "../constants";

// 動画解析を実行 (Gemini Vision)
// 動画解析を実行 (Mock: Riot API based)
export async function analyzeVideo(formData: FormData, userApiKey?: string, mode: AnalysisMode = 'MACRO', locale: string = 'ja') {
  if (userApiKey && !isValidGeminiApiKey(userApiKey)) {
    return { error: "Invalid API key format." };
  }
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // 1. Inputs
  const description = (formData.get("description") as string) || "";
  const matchId = formData.get("matchId") as string | null;

  // New Inputs for Persistence
  const videoSourceType = formData.get("videoSourceType");
  const videoUrl = formData.get("videoUrl");
  const focusTime = formData.get("focusTime");
  const specificQuestion = formData.get("specificQuestion");

  const inputs = {
      videoSourceType,
      videoUrl,
      focusTime,
      specificQuestion,
      mode
  };

  if (!matchId) return { error: "Match ID is missing. Please select a match first." };

  // 2. Create 'Pending' Record immediately
  const { data: job, error: jobError } = await supabase
      .from("video_analyses")
      .insert({
          user_id: user.id,
          match_id: matchId,
          status: "processing",
          result: null,
          inputs: inputs
      })
      .select()
      .single();

  if (jobError) {
      logger.error("Failed to create analysis job", jobError);
      return { error: "Failed to start analysis job" };
  }

  try {
    // Current Status Check (for Limits/Credits) - pass userId to skip redundant getUser()
    const status = await refreshAnalysisStatus(user.id);
    if (!status) throw new Error("User not found");

    // Fetch Summoner Rank for Persona
    let rankTier = "UNRANKED";
    try {
        const summoner = await getActiveSummoner();
        if (summoner?.id) {
            const ranks = await fetchRank(summoner.id);
            const soloDuo = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");
            if (soloDuo) rankTier = soloDuo.tier;
        }
    } catch (e) {
        logger.warn("Rank fetch failed for video analysis", e);
    }

    let useEnvKey = false;
    let shouldIncrementCount = false;

    // Plan & Limit Check (Weekly Limits)
    const weeklyCount = status.weekly_analysis_count || 0;

    if (status.is_premium) {
        if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
             throw new Error("WEEKLY_LIMIT_REACHED");
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    } else {
        // Free User Logic — BYOK is Premium-only
        if (userApiKey) {
            throw new Error("CUSTOM_KEY_PREMIUM_ONLY");
        }
        if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
            throw new Error("FREE_WEEKLY_LIMIT_REACHED");
        }
        useEnvKey = true;
        shouldIncrementCount = true;
    }

    const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
    if (!apiKey) {
      throw new Error("Configuration Error: API Key is missing.");
    }

    const summoner = await getActiveSummoner();
    if (!summoner?.puuid) {
         throw new Error("Summoner not found.");
    }

    // 4. Update Consumption Stats (DEBIT FIRST - Weekly)
    let debited = false;
    if (shouldIncrementCount) {
        const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
        await supabase.rpc('increment_weekly_count', { p_user_id: user.id, p_limit: limit });
        debited = true;
    }

    revalidatePath("/dashboard", "layout");

    // Call Internal Analysis Logic
    const focus = {
        mode: mode,
        focusArea: mode,
        specificQuestion: description
    };

    try {
        // Assume analyzeMatchTimeline is robust
        const res = await analyzeMatchTimeline(matchId, summoner.puuid, useEnvKey ? undefined : apiKey, focus, locale, true);

        if (!res.success || !res.data) {
            throw new Error(res.error || "Timeline analysis failed.");
        }

        // 5. Analysis Success -> Update Job
        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: res.data,
                error: null
            })
            .eq("id", job.id);

        return { success: true, data: res.data };

    } catch (e) {
        // [REFUND] If already debited, refund atomically
        if (debited && shouldIncrementCount) {
            await supabase.rpc('decrement_weekly_count', { p_user_id: user.id });
        }
        throw e;
    }

  } catch (e) {
    logger.error("Video Analysis Error:", e);
    const internalMessage = e instanceof Error ? e.message : "Unknown error";
    const isUserFacing = internalMessage.startsWith("⚠️") || internalMessage.includes("API Key") || internalMessage.includes("Credits");
    const userMessage = isUserFacing ? internalMessage : "Analysis failed. Please try again later.";

    // Update Job to Failed (generic message only — internal details in logger only)
    await supabase
        .from("video_analyses")
        .update({
            status: "failed",
            error: "ANALYSIS_FAILED"
        })
        .eq("id", job.id);

    return { error: userMessage };
  }
}
