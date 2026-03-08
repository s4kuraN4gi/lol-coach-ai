"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { matchIdSchema, jobIdSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

// NEW: Get Specific Job Status (For Micro Analysis)
export async function getAnalysisJobStatus(jobId: string) {
  if (!jobIdSchema.safeParse(jobId).success) return { error: "Invalid job ID" };
  const supabase = await createClient();

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("video_analyses")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return { status: "not_found" };

  // Safety check: Ensure result is not corrupted or too large
  let safeResult = data.result;
  if (safeResult) {
    try {
      const resultStr = JSON.stringify(safeResult);
      if (resultStr.length > 500 * 1024) { // 500KB max
        logger.error(`[getAnalysisJobStatus] Result too large (${Math.round(resultStr.length / 1024)}KB), truncating`);
        safeResult = {
          error: "Analysis result was corrupted. Please re-analyze.",
          summary: "データが破損していました。再分析してください。",
          observed_champions: [],
          mistakes: [],
          finalAdvice: ""
        };
      }
    } catch (e) {
      logger.error(`[getAnalysisJobStatus] Failed to serialize result:`, e);
      safeResult = {
        error: "Failed to load analysis result",
        summary: "分析結果の読み込みに失敗しました。",
        observed_champions: [],
        mistakes: [],
        finalAdvice: ""
      };
    }
  }

  return {
      status: data.status,
      result: safeResult,
      error: data.error,
      id: data.id,
      created_at: data.created_at
  };
}

/**
 * Get the latest completed MICRO analysis for a match
 * Used to restore analysis results when user navigates back to the page
 */
export async function getLatestMicroAnalysisForMatch(matchId: string): Promise<{
    found: boolean;
    result?: Record<string, unknown>;
}> {
    if (!matchIdSchema.safeParse(matchId).success) return { found: false };
    const supabase = await createClient();

    const user = await getUser();
    if (!user) {
        return { found: false };
    }

    // Fetch the latest completed MICRO analysis for this match
    // analysis_type is NULL or 'micro' for MICRO analyses (legacy data may not have type)
    const { data, error } = await supabase
        .from("video_analyses")
        .select("result")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .or("analysis_type.is.null,analysis_type.eq.micro")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data || !data.result) {
        return { found: false };
    }

    return {
        found: true,
        result: data.result
    };
}
