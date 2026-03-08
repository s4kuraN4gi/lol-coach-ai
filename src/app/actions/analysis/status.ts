"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { matchIdSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";
import type { AnalysisStatus } from "../constants";

// ユーザーのクレジット情報を取得（純粋なREAD - 副作用なし）
// callerUserIdを渡すと内部のgetUser()呼び出しをスキップし、認証ラウンドトリップを削減
export async function getAnalysisStatus(callerUserId?: string): Promise<AnalysisStatus | null> {
  const supabase = await createClient();
  let userId = callerUserId;
  if (!userId) {
    const user = await getUser();
    if (!user) return null;
    userId = user.id;
  }

  const { data } = await supabase
    .from("profiles")
    .select("is_premium, analysis_credits, subscription_tier, daily_analysis_count, last_analysis_date, subscription_end_date, auto_renew, last_credit_update, last_reward_ad_date, weekly_analysis_count, weekly_reset_date")
    .eq("id", userId)
    .single();

  if (!data) return null;

  // Ensure defaults if null
  if (data.weekly_analysis_count === null || data.weekly_analysis_count === undefined) {
      data.weekly_analysis_count = 0;
  }

  return data as AnalysisStatus;
}

// クレジット補充・期限チェック等のWRITE処理を実行してから最新ステータスを返す
// callerUserIdを渡すと内部のgetUser()呼び出しをスキップ
export async function refreshAnalysisStatus(callerUserId?: string): Promise<AnalysisStatus | null> {
  const supabase = await createClient();
  let userId = callerUserId;
  if (!userId) {
    const user = await getUser();
    if (!user) return null;
    userId = user.id;
  }

  // Single RPC call replaces 6 separate adminDb writes
  const { data, error } = await supabase.rpc('refresh_analysis_status', {
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    is_premium: row.is_premium,
    analysis_credits: row.analysis_credits,
    subscription_tier: row.subscription_tier,
    daily_analysis_count: row.daily_analysis_count,
    last_analysis_date: row.last_analysis_date,
    subscription_end_date: row.subscription_end_date,
    auto_renew: row.auto_renew,
    last_credit_update: row.last_credit_update,
    last_reward_ad_date: row.last_reward_ad_date,
    weekly_analysis_count: row.weekly_analysis_count ?? 0,
    weekly_reset_date: row.weekly_reset_date,
  } as AnalysisStatus;
}

// NEW: Get Analysis Status
export async function getVideoAnalysisStatus(matchId: string) {
  if (!matchIdSchema.safeParse(matchId).success) return { error: "Invalid match ID" };
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("video_analyses")
    .select("*")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return { status: "idle" }; // No record found

  // Safety check: Ensure result is not corrupted or too large
  let safeResult = data.result;
  if (safeResult) {
    try {
      const resultStr = JSON.stringify(safeResult);
      if (resultStr.length > 500 * 1024) { // 500KB max
        logger.error(`[getVideoAnalysisStatus] Result too large (${Math.round(resultStr.length / 1024)}KB), returning error`);
        safeResult = null;
        return {
          status: "failed",
          result: null,
          error: "ANALYSIS_CORRUPTED",
          id: data.id,
          created_at: data.created_at,
          inputs: data.inputs
        };
      }
    } catch (e) {
      logger.error(`[getVideoAnalysisStatus] Failed to serialize result:`, e);
      safeResult = null;
    }
  }

  return {
      status: data.status,
      result: safeResult,
      error: data.error,
      id: data.id,
      created_at: data.created_at,
      inputs: data.inputs
  };
}

// NEW: Get Latest Active Analysis (for Auto-Resume)
// Note: We intentionally exclude 'result' field to prevent loading large/corrupted data
export async function getLatestActiveAnalysis() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  // Only select fields needed for auto-resume (exclude large 'result' field)
  const { data, error } = await supabase
    .from("video_analyses")
    .select("id, match_id, status, error, inputs, created_at, analysis_type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Optional: Only return if it's recent? (e.g. within 1 hour)
  // For now, return the latest one.
  return {
    id: data.id,
    matchId: data.match_id,
    status: data.status,
    error: data.error,
    inputs: data.inputs,
    analysis_type: data.analysis_type as 'micro' | 'macro' | null
  };
}
