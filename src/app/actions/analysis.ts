"use server";

import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT, type AnalysisStatus, getWeeklyLimit } from "./constants";

// Weekly limit constant is imported from ./constants

// ユーザーのクレジット情報などを取得
export async function getAnalysisStatus(): Promise<AnalysisStatus | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Note: We select last_credit_update. If it doesn't exist in DB yet, it might be ignored or return null depending on Supabase leniency.
  // The migration SQL provided should be run by the user to add this column.
  const { data } = await supabase
    .from("profiles")
    .select("is_premium, analysis_credits, subscription_tier, daily_analysis_count, last_analysis_date, subscription_end_date, auto_renew, last_credit_update, last_reward_ad_date, weekly_analysis_count, weekly_reset_date")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  // Self-Healing for Legacy Premium Users (Schema Update前にUpgradeしたユーザー対応)
  if (data.is_premium && !data.subscription_end_date) {
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      // Update DB to have valid subscription data
      await supabase.from("profiles").update({ 
          subscription_end_date: nextMonth.toISOString(),
          auto_renew: true 
      }).eq("id", user.id);

      // Update local data object
      data.subscription_end_date = nextMonth.toISOString();
      data.auto_renew = true;
  }

  // --- WEEKLY CREDIT REPLENISHMENT LOGIC ---
  if (!data.is_premium) {
      const now = new Date();
      // default to now if null (for new migration) so we don't grant immediately on first load unless intended.
      const lastUpdate = data.last_credit_update ? new Date(data.last_credit_update) : now; 
      
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const timeDiff = now.getTime() - lastUpdate.getTime();

      // If last_credit_update is missing (null), we set it to NOW to start the timer.
      // If it exists, we check if 1 week has passed.
      if (!data.last_credit_update) {
          await supabase.from("profiles").update({ last_credit_update: now.toISOString() }).eq("id", user.id);
          data.last_credit_update = now.toISOString();
      } else if (timeDiff >= oneWeekMs) {
          // Calculate how many weeks passed (e.g. 2 weeks = 2 credits)
          const weeksPassed = Math.floor(timeDiff / oneWeekMs);
          const currentCredits = data.analysis_credits || 0;
          
          if (currentCredits < 3) {
             const newCredits = Math.min(currentCredits + weeksPassed, 3);
             
             // Update Date: Move forward by EXACT weeks to keep cycle consistent
             const newLastUpdate = new Date(lastUpdate.getTime() + (weeksPassed * oneWeekMs));

             await supabase.from("profiles").update({
                 analysis_credits: newCredits,
                 last_credit_update: newLastUpdate.toISOString()
             }).eq("id", user.id);

             data.analysis_credits = newCredits;
             data.last_credit_update = newLastUpdate.toISOString();
          } else {
             // Already at max, update timestamp to now to reset 'idle' timer or keep it? 
             // Logic: If user uses credit tomorrow, they should wait 1 week from tomorrow? 
             // OR 1 week from 'last schedule'? 
             // Typically in these systems, if you are full, the timer stops.
             // When you use a credit, the timer starts.
             // So if full, we set last_credit_update to NOW.
             await supabase.from("profiles").update({
                 last_credit_update: now.toISOString()
             }).eq("id", user.id);
             data.last_credit_update = now.toISOString();
          }
      }
  }

  // --- WEEKLY ANALYSIS LIMIT RESET LOGIC (for Premium users) ---
  {
      const now = new Date();
      const resetDate = data.weekly_reset_date ? new Date(data.weekly_reset_date) : null;

      // If no reset date set, or if we've passed the reset date, reset the counter
      if (!resetDate || now >= resetDate) {
          // Calculate next Monday 00:00 JST
          const nextMonday = getNextMonday(now);

          await supabase.from("profiles").update({
              weekly_analysis_count: 0,
              weekly_reset_date: nextMonday.toISOString()
          }).eq("id", user.id);

          data.weekly_analysis_count = 0;
          data.weekly_reset_date = nextMonday.toISOString();
      }

      // Ensure defaults if null
      if (data.weekly_analysis_count === null || data.weekly_analysis_count === undefined) {
          data.weekly_analysis_count = 0;
      }
  }

  // Lazy Expiry Check (有効期限切れチェック)
  if (data.is_premium && data.subscription_end_date) {
      const now = new Date();
      const end = new Date(data.subscription_end_date);
      if (end < now) {
          // 有効期限切れ: ステータスを更新してリターン
          await supabase.from("profiles").update({ is_premium: false, auto_renew: false }).eq("id", user.id);
          data.is_premium = false;
          data.auto_renew = false;
      }
  }

  return data as AnalysisStatus;
}

// 既存の解析結果を取得
export async function getMatchAnalysis(matchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("match_analyses")
    .select("analysis_text")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  return data ? data.analysis_text : null;
}

// プレミアムへアップグレード（モック）
export async function upgradeToPremium() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1); // 1ヶ月後

  const { error } = await supabase
    .from("profiles")
    .update({
      is_premium: true,
      subscription_tier: "premium",
      analysis_credits: 999,
      subscription_end_date: nextMonth.toISOString(),
      auto_renew: true,
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to upgrade" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// プレミアムプランの自動更新停止（解約予約）
export async function downgradeToFree() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 即時解約ではなく、自動更新をOFFにするだけ
  const { error } = await supabase
    .from("profiles")
    .update({
      auto_renew: false,
      // is_premium は変更しない（有効期限まではPremium）
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to cancel subscription" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

import { getPersonaPrompt, getModePrompt, AnalysisMode } from './promptUtils';
import { fetchRank } from './riot';
import { getActiveSummoner } from './profile'; 
import { analyzeMatchTimeline } from './coach'; // Use the timeline analysis logic 

// Helper for Retry Logic (Retry Disabled for Verification)
async function generateContentWithRetry(model: any, content: any, retries = 0): Promise<any> {
    try {
        return await model.generateContent(content);
    } catch (e: any) {
        const isRateLimit = e.message?.includes('429') || e.status === 429 || e.message?.includes('Too Many Requests');
        if (isRateLimit && retries < 2) {
            console.warn(`Gemini Rate Limit (429) hit. Retrying in 2s... (Attempt ${retries + 1}/2)`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
            return generateContentWithRetry(model, content, retries + 1);
        }
        if (isRateLimit) {
             throw new Error("⚠️ AI Service is busy (High Load). Please try again in 30 seconds.");
        }
        throw e;
    }
} 

// NEW: Get Analysis Status
export async function getVideoAnalysisStatus(matchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      console.log(`[getVideoAnalysisStatus] Result size for ${matchId}: ${resultStr.length} chars`);
      if (resultStr.length > 500 * 1024) { // 500KB max
        console.error(`[getVideoAnalysisStatus] Result too large (${Math.round(resultStr.length / 1024)}KB), returning error`);
        safeResult = null;
        return {
          status: "failed",
          result: null,
          error: "分析結果が破損していました。再度分析してください。",
          id: data.id,
          created_at: data.created_at,
          inputs: data.inputs
        };
      }
    } catch (e) {
      console.error(`[getVideoAnalysisStatus] Failed to serialize result:`, e);
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

// NEW: Get Specific Job Status (For Micro Analysis)
export async function getAnalysisJobStatus(jobId: string) {
  const supabase = await createClient();

  // Note: We skip auth check inside query for speed, but RLS will handle it if enabled.
  // However, explicit check is better.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("video_analyses")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) return { status: "not_found" };

  // Safety check: Ensure result is not corrupted or too large
  let safeResult = data.result;
  if (safeResult) {
    try {
      const resultStr = JSON.stringify(safeResult);
      console.log(`[getAnalysisJobStatus] Result size: ${resultStr.length} chars`);
      if (resultStr.length > 500 * 1024) { // 500KB max
        console.error(`[getAnalysisJobStatus] Result too large (${Math.round(resultStr.length / 1024)}KB), truncating`);
        safeResult = {
          error: "Analysis result was corrupted. Please re-analyze.",
          summary: "データが破損していました。再分析してください。",
          observed_champions: [],
          mistakes: [],
          finalAdvice: ""
        };
      }
    } catch (e) {
      console.error(`[getAnalysisJobStatus] Failed to serialize result:`, e);
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
    result?: any;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

// NEW: Get Analyzed Match IDs (Bulk for UI Labels)
export async function getAnalyzedMatchIds() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

// NEW: Get Latest Active Analysis (for Auto-Resume)
// Note: We intentionally exclude 'result' field to prevent loading large/corrupted data
export async function getLatestActiveAnalysis() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

// 動画解析を実行 (Gemini Vision)
// 動画解析を実行 (Mock: Riot API based)
export async function analyzeVideo(formData: FormData, userApiKey?: string, mode: AnalysisMode = 'MACRO', locale: string = 'ja') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      console.error("Failed to create analysis job", jobError);
      return { error: "Failed to start analysis job" };
  }

  try {
    // Current Status Check (for Limits/Credits)
    const status = await getAnalysisStatus();
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
        console.warn("Rank fetch failed for video analysis", e);
    }

    let useEnvKey = false;
    let shouldIncrementCount = false;

    // Plan & Limit Check
    if (status.is_premium) {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
        let currentCount = status.daily_analysis_count;

        if (lastDate !== today) {
            currentCount = 0;
        }

        if (currentCount >= 50) {
             throw new Error("Daily limit reached (50/50). Please try again tomorrow.");
        }

        useEnvKey = true;
        shouldIncrementCount = true;

    } else {
        // Free User Logic
        if (userApiKey) {
            useEnvKey = false; 
        } else {
            if (status.analysis_credits > 0) {
                useEnvKey = true;
            } else {
                throw new Error("API Key required or Credits exhausted. Please upgrade to Premium.");
            }
        }
    }

    const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
    if (!apiKey) {
      throw new Error("Configuration Error: API Key is missing.");
    }

    const summoner = await getActiveSummoner();
    if (!summoner?.puuid) {
         throw new Error("Summoner not found.");
    }

    // 4. Update Consumption Stats (DEBIT FIRST)
    let debited = false;
    if (shouldIncrementCount) {
        const today = new Date().toISOString();
        const todayDateStr = today.split('T')[0];
        const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
        let newCount = status.daily_analysis_count + 1;
        if (lastDateStr !== todayDateStr) newCount = 1;

        await supabase.from("profiles").update({ daily_analysis_count: newCount, last_analysis_date: today }).eq("id", user.id);
        debited = true;
    } else if (!userApiKey && useEnvKey && !status.is_premium) {
        await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", user.id);
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
        const res = await analyzeMatchTimeline(matchId, summoner.puuid, useEnvKey ? undefined : apiKey, focus, locale);

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

    } catch (e: any) {
        // [REFUND] If already debited, increment back
        if (debited) {
            if (shouldIncrementCount) {
                // For daily count, we just decrement or ignore. Usually ignore is safer if it's just a count.
                // But credits are real currency.
            } else if (!userApiKey && useEnvKey && !status.is_premium) {
                const { data: currentProfile } = await supabase.from("profiles").select("analysis_credits").eq("id", user.id).single();
                if (currentProfile) {
                    await supabase.from("profiles").update({ analysis_credits: currentProfile.analysis_credits + 1 }).eq("id", user.id);
                }
            }
        }
        throw e;
    }

  } catch (e: any) {
    console.error("Video Analysis Error:", e);
    const errorMessage = e.message || "Unknown error";

    // Update Job to Failed
    await supabase
        .from("video_analyses")
        .update({
            status: "failed",
            error: errorMessage
        })
        .eq("id", job.id);

    return { error: errorMessage };
  }
}

// 試合の解析を実行 (Match Analysis - Quick Verdict V2)
export async function analyzeMatchQuick(
  matchId: string,
  summonerName: string,
  puuid: string,
  userApiKey?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // 2. Check Limits
  const status = await getAnalysisStatus();
  if (!status) return { error: "User profile not found." };

  let useEnvKey = false;
  let shouldIncrementCount = false;

  if (status.is_premium) {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
      let currentCount = status.daily_analysis_count;
      if (lastDate !== today) currentCount = 0;

      if (currentCount >= 50) return { error: "Daily limit reached (50/50)." };
      
      useEnvKey = true;
      shouldIncrementCount = true;
  } else {
      if (userApiKey) {
          useEnvKey = false;
      } else {
          if (status.analysis_credits > 0) {
              useEnvKey = true;
          } else {
              return { error: "API Key required or Credits exhausted." };
          }
      }
  }

  const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
  if (!apiKey) return { error: "API Key missing." };

  // 3. Fetch Data (Match V5 Only)
  const { fetchMatchDetail, fetchDDItemData, fetchLatestVersion } =await import("./riot"); // Lazy import
  const matchRes = await fetchMatchDetail(matchId);
  if (!matchRes.success || !matchRes.data) return { error: "Failed to fetch match data." };
  
  const match = matchRes.data;
  const participant = match.info.participants.find((p: any) => p.puuid === puuid);
  if (!participant) return { error: "Participant not found." };
  
    // Find Opponent for Lane Verdict
  const opponent = match.info.participants.find((p: any) => 
      p.teamId !== participant.teamId && 
      p.teamPosition === participant.teamPosition &&
      p.teamPosition !== '' 
  );

  // 4. Generate Prompt with Multi-Model Fallback
  // EXACT match with coach.ts/chat to ensure success
  const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let finalJson = "";

  try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);

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

      for (const modelName of MODELS_TO_TRY) {
          try {
              console.log(`[Analysis] Trying Model: ${modelName}`);
              const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
              const result = await generateContentWithRetry(model, prompt);
              finalJson = result.response.text();
              
              if (finalJson) {
                  console.log(`[Analysis] Success with ${modelName}`);
                  break;
              }
          } catch (currentError: any) {
              console.warn(`[Analysis] Failed with ${modelName}: ${currentError.message}`);
              // Continue to next model
          }
      }

      if (!finalJson) {
           throw new Error("All AI models failed to respond for Match Diagnosis.");
      }
      
      // Sanitize Markdown
      finalJson = finalJson.replace(/```json/g, '').replace(/```/g, '').trim();

      // 5. Save & Update
      await supabase.from("match_analyses").upsert({
          user_id: user.id,
          match_id: matchId,
          summoner_name: summonerName,
          champion_name: participant.championName,
          analysis_text: finalJson // Store JSON string
      });

      if (shouldIncrementCount) {
        const today = new Date().toISOString();
        const todayDateStr = today.split('T')[0];
        const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
        let newCount = status.daily_analysis_count + 1;
        if (lastDateStr !== todayDateStr) newCount = 1;

        await supabase.from("profiles").update({ daily_analysis_count: newCount, last_analysis_date: today }).eq("id", user.id);
      } else if (!userApiKey && useEnvKey && !status.is_premium) {
         await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", user.id);
      }
      
       revalidatePath(`/dashboard/match/${matchId}`); 

      return { success: true, data: JSON.parse(finalJson) };

  } catch (e: any) {
      console.error("Analyze Quick Error:", e);
      return { error: e.message };
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
  // Redirect to Quick Analysis logic if called? 
  // For now perform backward compatibility wrap or just keep as is
  // ... (Existing implementation below)
  const supabase = await createClient();
   // ... keep existing implementation ...
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // --- Logic for Limits & Keys ---
  const status = await getAnalysisStatus();
  if (!status) return { error: "User profile not found." };

  let useEnvKey = false;
  let shouldIncrementCount = false;

  if (status.is_premium) {
      // 1. Premium User
      const today = new Date().toISOString().split('T')[0];
      const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
      let currentCount = status.daily_analysis_count;
      if (lastDate !== today) currentCount = 0;

      if (currentCount >= 50) return { error: "Daily limit reached (50/50). Try again tomorrow." };
      
      useEnvKey = true;
      shouldIncrementCount = true;
  } else {
      // 2. Free User
      if (userApiKey) {
          useEnvKey = false; // Use provided key
      } else {
          // Check Credits
          if (status.analysis_credits > 0) {
              useEnvKey = true;
          } else {
              return { error: "API Key required or Credits exhausted." };
          }
      }
  }

  const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
  let resultAdvice = "";

  if (!apiKey) {
      if (!useEnvKey && !userApiKey) return { error: "Configuration Error: API Key missing." };
       console.warn("GEMINI_API_KEY is missing via Env. Using Mock.");
       await new Promise((resolve) => setTimeout(resolve, 1500));
       resultAdvice = `【Mock】${championName}での${kda}は見事ですが、APIキーが設定されていません。`;
  } else {
      // Call Gemini with Multi-Model Fallback
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
        
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
        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`[AnalysisLegacy] Trying Model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await generateContentWithRetry(model, prompt);
                resultAdvice = result.response.text();

                if (resultAdvice) {
                    console.log(`[AnalysisLegacy] Success with ${modelName}`);
                    break;
                }
            } catch (e: any) {
                console.warn(`[AnalysisLegacy] Failed with ${modelName}: ${e.message}`);
            }
        }

        if (!resultAdvice) {
            throw new Error("All AI models failed to respond.");
        }

      } catch (e: any) {
          console.error("Gemini Match Analysis Error:", e);
          return { error: `Gemini Error: ${e.message}` };
      }
  }

  // --- Post-Process: Update DB ---
  
  // 1. Save Result
  const { error } = await supabase.from("match_analyses").insert({
    user_id: user.id,
    match_id: matchId,
    summoner_name: summonerName,
    champion_name: championName,
    analysis_text: resultAdvice, // Saving TEXT here
  });
  if (error) console.error("Failed to save analysis:", error);

  // 2. Update Limits/Credits
  if (shouldIncrementCount) {
      const today = new Date().toISOString();
      const todayDateStr = today.split('T')[0];
      const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
      let newCount = status.daily_analysis_count + 1;
      if (lastDateStr !== todayDateStr) newCount = 1;

      await supabase.from("profiles").update({ daily_analysis_count: newCount, last_analysis_date: today }).eq("id", user.id);
  } else if (!userApiKey && useEnvKey && !status.is_premium) {
      // Consume Credit
      await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/match/${matchId}`); 

  return { success: true, advice: resultAdvice };
}

// 1日1回の広告リワード（クレジット付与）
export async function claimDailyReward() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("analysis_credits, last_reward_ad_date")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  const now = new Date();
  const lastRewardStr = profile.last_reward_ad_date;
  
  if (lastRewardStr) {
      const lastRewardDate = new Date(lastRewardStr);
      // 同じ日付なら拒否
      if (now.toDateString() === lastRewardDate.toDateString()) {
          return { error: "Already claimed today." };
      }
  }

  const currentCredits = profile.analysis_credits || 0;
  const newCredits = currentCredits + 1;

  const { error } = await supabase
    .from("profiles")
    .update({
        analysis_credits: newCredits,
        last_reward_ad_date: now.toISOString()
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to update credits" };

  revalidatePath("/dashboard", "layout");
  return { success: true, newCredits };
}

// 強制的にStripeの最新ステータスと同期する
// カスタマーの全アクティブサブスクリプションを確認し、最上位tierを適用
export async function syncSubscriptionStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id, subscription_tier")
    .eq("id", user.id)
    .single();

  try {
      const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;

      // If no customer ID in DB, search Stripe by email to find the customer
      let customerId = profile?.stripe_customer_id;
      if (!customerId && user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      if (!customerId && !profile?.stripe_subscription_id) {
        return { error: "No subscription info found" };
      }

      let bestSubscription: any = null;
      let bestTier: 'free' | 'premium' | 'extra' = 'free';

      // If customer ID exists, list all active subscriptions to find the best one
      const allActiveSubs: any[] = [];
      if (customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 10,
        });
        allActiveSubs.push(...subs.data);

        for (const sub of subs.data) {
          const priceId = sub.items.data[0]?.price?.id;
          const tier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

          // Pick the highest tier subscription (extra > premium)
          if (!bestSubscription || (tier === 'extra' && bestTier !== 'extra')) {
            bestSubscription = sub;
            bestTier = tier;
          }
        }

        // Also check trialing subscriptions
        if (!bestSubscription) {
          const trialingSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: 'trialing',
            limit: 10,
          });
          if (trialingSubs.data.length > 0) {
            allActiveSubs.push(...trialingSubs.data);
            bestSubscription = trialingSubs.data[0];
            const priceId = bestSubscription.items.data[0]?.price?.id;
            bestTier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';
          }
        }

        // Cancel duplicate subscriptions (keep only the best one)
        if (bestSubscription && allActiveSubs.length > 1) {
          for (const sub of allActiveSubs) {
            if (sub.id !== bestSubscription.id) {
              try {
                await stripe.subscriptions.cancel(sub.id);
              } catch (cancelErr: any) {
                console.error(`[Sync] Failed to cancel duplicate ${sub.id}: ${cancelErr.message}`);
              }
            }
          }
        }
      }

      // Fallback: use stored subscription ID directly
      if (!bestSubscription && profile?.stripe_subscription_id) {
        bestSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const priceId = bestSubscription.items.data[0]?.price?.id;
        bestTier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';
      }

      if (!bestSubscription) {
        return { error: "No active subscription found on Stripe" };
      }

      const periodEnd = (bestSubscription.items?.data?.[0] as any)?.current_period_end
        ?? (bestSubscription as any).current_period_end;
      let endDate = null;
      if (periodEnd) {
          try {
              endDate = new Date(periodEnd * 1000).toISOString();
          } catch (e) {
              console.warn("Invalid date in sync:", periodEnd);
          }
      }

      const isActive = bestSubscription.status === 'active' || bestSubscription.status === 'trialing';

      const updateData: Record<string, any> = {
        stripe_subscription_id: bestSubscription.id,
        subscription_status: bestSubscription.status,
        is_premium: isActive,
        subscription_tier: isActive ? bestTier : 'free',
        subscription_end_date: endDate,
        auto_renew: !bestSubscription.cancel_at_period_end,
      };

      // Also save stripe_customer_id if it was found by email but missing in DB
      if (customerId && !profile?.stripe_customer_id) {
        updateData.stripe_customer_id = customerId;
      }

      // Use service role client to bypass RLS for subscription_tier update
      const adminDb = createServiceRoleClient();
      const { error: updateError } = await adminDb
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (updateError) {
        console.error("[Sync] DB update failed:", updateError.message);
      }

      revalidatePath("/dashboard", "layout");

      return { success: !updateError, tier: updateData.subscription_tier };
  } catch (e: any) {
      console.error("Sync Error:", e);
      return { error: e.message };
  }
}

// ============================================================
// WEEKLY ANALYSIS LIMIT HELPERS
// ============================================================

/**
 * Get next Monday 00:00 JST from a given date
 */
function getNextMonday(from: Date): Date {
    const result = new Date(from);
    // Get current day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const currentDay = result.getDay();
    // Calculate days until next Monday
    const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
    result.setDate(result.getDate() + daysUntilMonday);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Check if user can perform analysis (within weekly limit)
 * Returns: { canAnalyze: boolean, remaining: number, resetDate: string }
 */
export async function checkWeeklyLimit(): Promise<{
    canAnalyze: boolean;
    remaining: number;
    used: number;
    limit: number;
    resetDate: string;
    isPremium: boolean;
}> {
    const status = await getAnalysisStatus();

    if (!status) {
        return {
            canAnalyze: false,
            remaining: 0,
            used: 0,
            limit: 0,
            resetDate: '',
            isPremium: false
        };
    }

    const limit = getWeeklyLimit(status);
    const remaining = limit - (status.weekly_analysis_count || 0);
    return {
        canAnalyze: remaining > 0,
        remaining: Math.max(0, remaining),
        used: status.weekly_analysis_count || 0,
        limit,
        resetDate: status.weekly_reset_date || '',
        isPremium: status.is_premium
    };
}

/**
 * Increment weekly analysis count for premium users
 * Or decrement credits for free users
 */
export async function incrementAnalysisCount(userId: string, isPremium: boolean): Promise<boolean> {
    const supabase = await createClient();

    if (isPremium) {
        // Premium user: increment weekly count
        const { error } = await supabase.rpc('increment_weekly_analysis', { user_id: userId });

        if (error) {
            // Fallback: direct update
            const { data: profile } = await supabase
                .from("profiles")
                .select("weekly_analysis_count")
                .eq("id", userId)
                .single();

            if (profile) {
                await supabase
                    .from("profiles")
                    .update({ weekly_analysis_count: (profile.weekly_analysis_count || 0) + 1 })
                    .eq("id", userId);
            }
        }
        return true;
    } else {
        // Free user: decrement credits
        const { data: profile } = await supabase
            .from("profiles")
            .select("analysis_credits")
            .eq("id", userId)
            .single();

        if (profile && profile.analysis_credits > 0) {
            await supabase
                .from("profiles")
                .update({ analysis_credits: profile.analysis_credits - 1 })
                .eq("id", userId);
            return true;
        }
        return false;
    }
}
