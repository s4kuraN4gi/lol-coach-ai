"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { matchIdSchema, puuidSchema, summonerNameSchema, championNameSchema } from "@/lib/validation";
import { isValidGeminiApiKey, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { refreshAnalysisStatus } from "./status";
import { generateContentWithRetry } from "./helpers";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "../constants";

// 既存の解析結果を取得
export async function getMatchAnalysis(matchId: string) {
  if (!matchIdSchema.safeParse(matchId).success) return null;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("match_analyses")
    .select("analysis_text")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  return data ? data.analysis_text : null;
}

// NEW: Get Analyzed Match IDs (Bulk for UI Labels)
export async function getAnalyzedMatchIds() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  // Limit to last 100 to prevent overload
  const { data, error } = await supabase
    .from("video_analyses")
    .select("match_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  // Return unique IDs (in case of multiple analyses for same match)
  const ids = data.map(d => d.match_id);
  return Array.from(new Set(ids));
}

// 試合の解析を実行 (Match Analysis - Quick Verdict V2)
export async function analyzeMatchQuick(
  matchId: string,
  summonerName: string,
  puuid: string,
  userApiKey?: string
) {
  if (!matchIdSchema.safeParse(matchId).success) return { error: "Invalid match ID" };
  if (!puuidSchema.safeParse(puuid).success) return { error: "Invalid PUUID" };
  if (!summonerNameSchema.safeParse(summonerName).success) return { error: "Invalid summoner name" };
  if (userApiKey && !isValidGeminiApiKey(userApiKey)) return { error: "Invalid API key format." };
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // 1. Check Previous Analysis
  const { data: existing } = await supabase
    .from("match_analyses")
    .select("analysis_text")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
      try {
          // If existing analysis is JSON, return it
          if (existing.analysis_text.trim().startsWith("{")) {
               return { success: true, data: JSON.parse(existing.analysis_text), cached: true };
          }
      } catch (e) {
          // Ignore parse error, proceed to analysis
      }
  }

  // 2. Check Limits - pass userId to skip redundant getUser()
  const status = await refreshAnalysisStatus(user.id);
  if (!status) return { error: "User profile not found." };

  let useEnvKey = false;
  let shouldIncrementCount = false;

  const weeklyCount = status.weekly_analysis_count || 0;

  if (status.is_premium) {
      if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) return { error: "WEEKLY_LIMIT_REACHED" };
      useEnvKey = true;
      shouldIncrementCount = true;
  } else {
      // Free User — BYOK is Premium-only
      if (userApiKey) {
          return { error: "CUSTOM_KEY_PREMIUM_ONLY" };
      }
      if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
          return { error: "FREE_WEEKLY_LIMIT_REACHED" };
      }
      useEnvKey = true;
      shouldIncrementCount = true;
  }

  const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
  if (!apiKey) return { error: "API Key missing." };

  // 2.5 DEBIT-FIRST: consume credit before AI call
  let debited = false;
  if (shouldIncrementCount) {
    const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
    await supabase.rpc('increment_weekly_count', { p_user_id: user.id, p_limit: limit });
    debited = true;
  }

  // 3. Fetch Data (Match V5 Only)
  const { fetchMatchDetail, fetchDDItemData, fetchLatestVersion } =await import("../riot"); // Lazy import
  const matchRes = await fetchMatchDetail(matchId);
  if (!matchRes.success || !matchRes.data) return { error: "Failed to fetch match data." };

  const match = matchRes.data;
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return { error: "Participant not found." };

    // Find Opponent for Lane Verdict
  const opponent = match.info.participants.find((p) =>
      p.teamId !== participant.teamId &&
      p.teamPosition === participant.teamPosition &&
      p.teamPosition !== ''
  );

  // 4. Generate Prompt with Multi-Model Fallback
  let finalJson = "";

  try {
      const { getGeminiClient } = await import("@/lib/gemini");
      const genAI = getGeminiClient(apiKey);

      const version = await fetchLatestVersion();

      const prompt = `
      League of Legendsの試合結果から、プレイヤーの「即時評価」をJSONで出力してください。

      **現在のLoLバージョン: ${version} (最新メタを前提)**

      プレイヤー: ${participant.championName} (${participant.teamPosition}), KDA: ${participant.kills}/${participant.deaths}/${participant.assists}, 勝敗: ${participant.win ? "WIN" : "LOSS"}
      対面: ${opponent ? opponent.championName : "Unknown"}, KDA: ${opponent ? `${opponent.kills}/${opponent.deaths}/${opponent.assists}` : "?"}

      出力JSON形式:
      {
          "grade": "S/A/B/C/D",
          "badge": { "label": "称号(5文字以内)", "icon": "絵文字", "color": "text-yellow-400" },
          "laneVerdict": { "result": "WIN/LOSS/EVEN", "reason": "一言理由" },
          "keyFeedback": "一言アドバイス"
      }
      `;

      for (const modelName of GEMINI_MODELS_TO_TRY) {
          try {
              const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
              const result = await generateContentWithRetry(model, prompt);
              finalJson = result.response.text();

              if (finalJson) {
                  break;
              }
          } catch (currentError) {
              logger.warn(`[Analysis] Failed with ${modelName}: ${currentError instanceof Error ? currentError.message : String(currentError)}`);
              // Continue to next model
          }
      }

      if (!finalJson) {
           throw new Error("All AI models failed to respond for Match Diagnosis.");
      }

      // Sanitize Markdown
      finalJson = finalJson.replace(/```json/g, '').replace(/```/g, '').trim();

      // 5. Save result
      await supabase.from("match_analyses").upsert({
          user_id: user.id,
          match_id: matchId,
          summoner_name: summonerName,
          champion_name: participant.championName,
          analysis_text: finalJson // Store JSON string
      });

       revalidatePath(`/dashboard/match/${matchId}`);

      return { success: true, data: JSON.parse(finalJson) };

  } catch (e) {
      logger.error("Analyze Quick Error:", e);
      // Refund credit on failure (DEBIT-FIRST pattern)
      if (debited && shouldIncrementCount) {
        try {
          await supabase.rpc('decrement_weekly_count', { p_user_id: user.id });
        } catch (refundErr) {
          logger.error("Refund failed:", refundErr);
        }
      }
      return { error: "ANALYSIS_FAILED" };
  }
}

// 試合の解析を実行 (Match Analysis - Old/Generic)
export async function analyzeMatch(
  matchId: string,
  summonerName: string,
  championName: string,
  kda: string,
  win: boolean,
  userApiKey?: string // [NEW] BYOK Support
) {
  if (!matchIdSchema.safeParse(matchId).success) return { error: "Invalid match ID" };
  if (!summonerNameSchema.safeParse(summonerName).success) return { error: "Invalid summoner name" };
  if (!championNameSchema.safeParse(championName).success) return { error: "Invalid champion name" };
  if (userApiKey && !isValidGeminiApiKey(userApiKey)) return { error: "Invalid API key format." };
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // まずDBに既存の解析があるか確認
  const { data: existing } = await supabase
    .from("match_analyses")
    .select("analysis_text")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return { success: true, advice: existing.analysis_text, cached: true };
  }

  // --- Logic for Limits & Keys --- pass userId to skip redundant getUser()
  const status = await refreshAnalysisStatus(user.id);
  if (!status) return { error: "User profile not found." };

  let useEnvKey = false;
  let shouldIncrementCount = false;

  const weeklyCount = status.weekly_analysis_count || 0;

  if (status.is_premium) {
      if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) return { error: "WEEKLY_LIMIT_REACHED" };
      useEnvKey = true;
      shouldIncrementCount = true;
  } else {
      // Free User — BYOK is Premium-only
      if (userApiKey) {
          return { error: "CUSTOM_KEY_PREMIUM_ONLY" };
      }
      if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
          return { error: "FREE_WEEKLY_LIMIT_REACHED" };
      }
      useEnvKey = true;
      shouldIncrementCount = true;
  }

  const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
  let resultAdvice = "";

  // --- DEBIT-FIRST: Consume credit/count BEFORE AI call ---
  let debited = false;
  if (shouldIncrementCount) {
      const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
      await supabase.rpc('increment_weekly_count', { p_user_id: user.id, p_limit: limit });
      debited = true;
  }

  try {
    if (!apiKey) {
        if (!useEnvKey && !userApiKey) return { error: "Configuration Error: API Key missing." };
         logger.warn("GEMINI_API_KEY is missing via Env. Using Mock.");
         await new Promise((resolve) => setTimeout(resolve, 1500));
         resultAdvice = `【Mock】${championName}での${kda}は見事ですが、APIキーが設定されていません。`;
    } else {
        // Call Gemini with Multi-Model Fallback
        const { getGeminiClient } = await import("@/lib/gemini");
        const genAI = getGeminiClient(apiKey);

        const prompt = `
あなたはLeague of Legendsのプロコーチです。
以下の試合結果を元に、プレイヤーへの具体的かつ簡潔な改善アドバイス（ダメ出し含む）を日本語で作成してください。
300文字以内で、箇条書きや絵文字を使って読みやすくしてください。

プレイヤー名: ${summonerName}
使用チャンピオン: ${championName}
結果: ${win ? "Win" : "Loss"}
KDA: ${kda}

アドバイスの構成案:
1. 良かった点（さらっと）
2. 改善点（具体的に）
3. 次へのアクション
`;
        for (const modelName of GEMINI_MODELS_TO_TRY) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await generateContentWithRetry(model, prompt);
                resultAdvice = result.response.text();

                if (resultAdvice) {
                    break;
                }
            } catch (e) {
                logger.warn(`[AnalysisLegacy] Failed with ${modelName}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (!resultAdvice) {
            throw new Error("All AI models failed to respond.");
        }
    }

    // --- Post-Process: Save to DB ---
    const { error } = await supabase.from("match_analyses").insert({
      user_id: user.id,
      match_id: matchId,
      summoner_name: summonerName,
      champion_name: championName,
      analysis_text: resultAdvice,
    });
    if (error) logger.error("Failed to save analysis:", error);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/match/${matchId}`);

    return { success: true, advice: resultAdvice };

  } catch (e) {
      logger.error("Gemini Match Analysis Error:", e);
      // Refund credit on failure (DEBIT-FIRST pattern)
      if (debited && shouldIncrementCount) {
        try {
          await supabase.rpc('decrement_weekly_count', { p_user_id: user.id });
        } catch (refundErr) {
          logger.error("Refund failed:", refundErr);
        }
      }
      return { error: "ANALYSIS_FAILED" };
  }
}
