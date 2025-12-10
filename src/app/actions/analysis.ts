"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type AnalysisStatus = {
  is_premium: boolean;
  analysis_credits: number;
  subscription_tier: string;
  daily_analysis_count: number;
  last_analysis_date: string;
  subscription_end_date?: string | null;
  auto_renew?: boolean;
};

// ユーザーのクレジット情報などを取得
export async function getAnalysisStatus(): Promise<AnalysisStatus | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("is_premium, analysis_credits, subscription_tier, daily_analysis_count, last_analysis_date, subscription_end_date, auto_renew")
    .eq("id", user.id)
    .single();

  if (!data) return null;

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

// ... (analyzeVideo and analyzeMatch remain unchanged) ...

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

  revalidatePath("/dashboard/replay");
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

  revalidatePath("/dashboard/replay");
  return { success: true };
}

// 動画解析を実行 (Gemini Vision)
export async function analyzeVideo(formData: FormData, userApiKey?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 現状を取得
  const status = await getAnalysisStatus();
  if (!status) return { error: "User not found" };

  let useEnvKey = false;
  let shouldIncrementCount = false;

  // プラン判定と制限チェック
  if (status.is_premium) {
      // Premium Plan: Use Platform Key with Daily Limit
      const today = new Date().toISOString().split('T')[0];
      const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
      let currentCount = status.daily_analysis_count;

      if (lastDate !== today) {
          // 日付が変わっていればカウントリセット扱い (DB更新は後ほど)
          currentCount = 0;
      }

      if (currentCount >= 50) {
           return { error: "Daily limit reached (50/50). Please try again tomorrow." };
      }

      useEnvKey = true;
      shouldIncrementCount = true;

  } else {
      // Free Plan: Require User API Key (OR Credits? - Plan says BYOK for free)
      // If user provides Key, use it. If not, try credits? 
      // Current design: Free = BYOK.
      if (!userApiKey) {
          // Fallback legacy credit check? Or strict BYOK?
          // User said "Basic plan is not unlimited... (Google limits)".
          // Implies BYOK is the main way.
          if (status.analysis_credits > 0) {
              // Legacy credit system fallback
              useEnvKey = true; 
              // Credits will be consumed later if we go this route.
          } else {
              return { error: "API Key required. Please upgrade to Premium or enter your Gemini API Key." };
          }
      } else {
          useEnvKey = false;
      }
  }

  const apiKey = useEnvKey ? process.env.GEMINI_API_KEY : userApiKey;
  if (!apiKey) {
    return { error: "Configuration Error: API Key is missing." };
  }

  // 入力データの取得
  const description = (formData.get("description") as string) || "";
  const videoFile = formData.get("video") as File | null;

  let resultAdvice = "";

  try {
    // Dynamic import to avoid build-time resolution issues
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // 1. 動画ファイルがある場合の処理
    if (videoFile && videoFile.size > 0) {
      const { GoogleAIFileManager } = await import("@google/generative-ai/server");
      const { writeFile, unlink } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      // ファイルサイズチェック
      if (videoFile.size > 4.5 * 1024 * 1024) { 
           return { error: "File too large. Please upload video smaller than 4.5MB." };
      }

      console.log("Processing video upload:", videoFile.name, videoFile.size);

      // (1) 一時ファイルに保存
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      const tempFilePath = join(tmpdir(), `upload-${Date.now()}-${videoFile.name}`);
      await writeFile(tempFilePath, buffer);

      try {
        // (2) Gemini File APIへアップロード
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
          mimeType: videoFile.type,
          displayName: videoFile.name,
        });

        console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

        // (3) ファイル処理待ち (ACTIVEになるまで待機)
        let file = await fileManager.getFile(uploadResponse.file.name);
        while (file.state === "PROCESSING") {
          console.log("Waiting for video processing...");
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2秒待機
          file = await fileManager.getFile(uploadResponse.file.name);
        }

        if (file.state === "FAILED") {
          throw new Error("Video processing failed by Gemini.");
        }

        // (4) Generate Content
        const prompt = `
あなたはLeague of Legendsのプロコーチです。
アップロードされた動画はプレイヤーのプレイ映像です。
ユーザーからのメモ: "${description}"

以下の点について、辛口かつ具体的にアドバイスしてください：
1. 集団戦またはレーン戦でのポジショニング
2. スキル使用のタイミング
3. 改善すべき点

出力は日本語で、箇条書きを用いて読みやすくまとめてください。
`;
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResponse.file.mimeType,
              fileUri: uploadResponse.file.uri,
            },
          },
          { text: prompt },
        ]);

        resultAdvice = result.response.text();

        // 完了後、Gemini上のファイルを削除
        await fileManager.deleteFile(uploadResponse.file.name);

      } finally {
        // 一時ファイルの削除
        await unlink(tempFilePath).catch((err) => console.error("Failed to delete temp file:", err));
      }

    } else {
        // 2. テキストのみ (URL解析) の場合
        if(!description.trim()) {
            return { error: "Please provide a description or URL." };
        }
        
        const prompt = `
あなたはLeague of Legendsのプロコーチです。
ユーザーから以下の相談/URLが送られてきました。
内容: "${description}"

この情報から推測できる範囲で、プレイヤーへのアドバイスを300文字以内で作成してください。
URLが含まれている場合は、そのURLの内容（YouTubeであれば一般的なLoL動画の文脈）を考慮して回答してください。
`;
        const result = await model.generateContent(prompt);
        resultAdvice = result.response.text();
    }

  } catch (e: unknown) {
    console.error("Gemini API Error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return { error: `Gemini API Error: ${errorMessage}` };
  }

  // 利用状況の更新 (Premium: Count, Legacy Free: Credits)
  if (shouldIncrementCount) {
      // Reset logic handled by SQL or here? logic:
      // If today != last_date, new count is 1. Else count + 1.
      const today = new Date().toISOString(); // Full timestamp for last_analysis_date
      const todayDateStr = today.split('T')[0];
      const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
      
      let newCount = status.daily_analysis_count + 1;
      if (lastDateStr !== todayDateStr) {
          newCount = 1;
      }

      await supabase
        .from("profiles")
        .update({ 
            daily_analysis_count: newCount,
            last_analysis_date: today 
        })
        .eq("id", user.id);
  } else if (!userApiKey && useEnvKey && !status.is_premium) {
      // Legacy Credit Consumption (Only if using Env Key AND not premium)
      const { error } = await supabase
      .from("profiles")
      .update({ analysis_credits: status.analysis_credits - 1 })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard/replay");

  return {
    success: true,
    advice: resultAdvice,
    remainingCredits: status.is_premium ? 999 : status.analysis_credits - 1,
  };
}

// 試合の解析を実行 (Match Analysis)
export async function analyzeMatch(
  matchId: string,
  summonerName: string,
  championName: string,
  kda: string,
  win: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // まずDBに既存の解析があるか確認 (節約のため)
  const { data: existing } = await supabase
    .from("match_analyses")
    .select("analysis_text")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return { success: true, advice: existing.analysis_text, cached: true };
  }

  // Gemini API Key Check
  const apiKey = process.env.GEMINI_API_KEY;
  let resultAdvice = "";

  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. Using mock response.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const mocks = [
      `【Mock】${championName}での${kda}は見事ですが、視界スコアが低めです。`,
      `【Mock】${win ? "勝利おめでとう！" : "惜しい試合でした。"} 集団戦の立ち位置を改善しましょう。`,
    ];
    resultAdvice = mocks[Math.floor(Math.random() * mocks.length)];
  } else {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      // 'gemini-flash-latest' (v1.5)
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

      const result = await model.generateContent(prompt);
      resultAdvice = result.response.text();
    } catch (e: any) {
      console.error("Gemini Match Analysis API Error:", e);

      // Debug: If 404, try to list available models to see what IS valid
      if (e.message.includes("404") || e.message.includes("not found")) {
        try {
          const listRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          const listData = await listRes.json();
          if (listData.models) {
            const modelNames = listData.models
              .map((m: any) => m.name)
              .join(", ");
            return {
              error: `Gemini 404 Error. Available models: ${modelNames}`,
            };
          }
        } catch (listErr) {
          console.error("Failed to list models:", listErr);
        }
      }

      return { error: `Gemini Error: ${e.message || "Unknown error"}` };
    }
  }

  // DBに保存
  const { error } = await supabase.from("match_analyses").insert({
    user_id: user.id,
    match_id: matchId,
    summoner_name: summonerName,
    champion_name: championName,
    analysis_text: resultAdvice,
  });

  if (error) {
    console.error("Failed to save analysis:", error);
    // 保存失敗しても結果は返す
  }

  revalidatePath("/dashboard");
  return { success: true, advice: resultAdvice };
}


