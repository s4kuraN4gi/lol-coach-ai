'use server';

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';
import { getAnalysisStatus } from "./analysis";
import { fetchMatchDetail } from "./riot";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

type VisionAnalysisRequest = {
    frames: string[]; // Base64 Data URLs
    question?: string;
    description?: string;
    matchId?: string; // New: For Hybrid Analysis
    puuid?: string;   // New: For Identification
};

export type VisionAnalysisResult = {
    observed_champions: { name: string; evidence: string }[];
    summary: string;
    mistakes: {
        timestamp: string; // approx "0s" - "30s"
        title: string;
        severity: "CRITICAL" | "MINOR";
        advice: string;
    }[];
    finalAdvice: string;
};

export async function startVisionAnalysis(
    request: VisionAnalysisRequest, 
    userApiKey?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    // 1. Initial Limit/Auth Check (Fail fast)
    const status = await getAnalysisStatus();
    if (!status) return { success: false, error: "User profile not found." };

    // Check availability only (Consumption happens later or we assume success)
    if (status.is_premium) {
        if (status.daily_analysis_count >= 50) return { success: false, error: "Daily limit reached (50/50)." };
    } else {
        if (!userApiKey && status.analysis_credits <= 0) return { success: false, error: "Credits exhausted." };
    }

    // 2. Create Job Record
    // We do NOT store frames in DB (too large). Frames are passed in memory to the detached worker.
    const { data: job, error: jobError } = await supabase
        .from("video_analyses")
        .insert({
            user_id: user.id,
            match_id: request.matchId || "unknown", // Optional linkage
            status: "processing",
            result: null, // Set later
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
        console.error("Failed to create vision job:", jobError);
        return { success: false, error: "Database Error: Could not start analysis job." };
    }

    // 3. Trigger Async Processing (Fire & Forget)
    // We explicitly DO NOT await this.
    (async () => {
        try {
            await performVisionAnalysis(job.id, request, user.id, userApiKey);
        } catch (e) {
            console.error(`[Vision Job ${job.id}] Uncaught specific error:`, e);
        }
    })();

    return { success: true, jobId: job.id };
}

// Internal Worker Function (Detached)
async function performVisionAnalysis(
    jobId: string, 
    request: VisionAnalysisRequest, 
    userId: string,
    userApiKey?: string
) {
    const supabase = await createClient();
    let status: any = null;
    let debited = false;
    let shouldIncrementCount = false;
    let useEnvKey = false;
    
    try {
        // --- Limit Check Again (Double safe) & Key Setup ---
        status = await getAnalysisStatus();
        if (!status) throw new Error("User profile missing during processing.");
        
        if (status.is_premium) {
            useEnvKey = true;
            shouldIncrementCount = true;
            // Limit check
             const today = new Date().toISOString().split('T')[0];
             const lastDate = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
             let currentCount = status.daily_analysis_count;
             if (lastDate !== today) currentCount = 0;
             if (currentCount >= 50) throw new Error("Daily limit reached during processing.");
        } else {
             if (userApiKey) { useEnvKey = false; }
             else {
                 if (status.analysis_credits > 0) useEnvKey = true;
                 else throw new Error("Credits exhausted during processing.");
             }
        }

        const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
        if (!apiKeyToUse) throw new Error("API Key Not Found");

        // [DEBIT FIRST]
        if (shouldIncrementCount) {
             const today = new Date().toISOString();
             const todayDateStr = today.split('T')[0];
             const lastDateStr = status.last_analysis_date ? status.last_analysis_date.split('T')[0] : null;
             let newCount = status.daily_analysis_count + 1;
             if (lastDateStr !== todayDateStr) newCount = 1;
             await supabase.from("profiles").update({ daily_analysis_count: newCount, last_analysis_date: today }).eq("id", userId);
             debited = true;
        } else if (!userApiKey && useEnvKey && !status.is_premium) {
             await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", userId);
             debited = true;
        }

        // --- CORE ANALYSIS LOGIC (Copied from original) ---

        // 1. MATCH CONTEXT (Hybrid)
        let matchContextStr = "";
        let myChampName = "Unknown";
        
        if (request.matchId && request.puuid) {
            console.log(`[Vision Job ${jobId}] Fetching match context...`);
            const matchRes = await fetchMatchDetail(request.matchId);
            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: any) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) myChampName = me.championName;
                const allies = parts.filter((p: any) => p.teamId === myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: any) => p.teamId !== myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);

                 matchContextStr = `
                【最重要: 試合の正解データ】
                視点主（あなた）: ${myChampName}
                味方チーム: ${allies.join(", ")}
                敵チーム: ${enemies.join(", ")}
                ※ 画像認識で迷った場合は、**必ずこのリストの中から**選んでください。
                `;
            }
        }

        const modelsToTry = [
            "gemini-1.5-pro",
            "gemini-2.5-flash", 
            "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite"
        ];
        const errors: string[] = [];
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        let analysisData: VisionAnalysisResult | null = null;
        let success = false;

        for (const modelName of modelsToTry) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    console.log(`[Vision Job ${jobId}] Attempting ${modelName} (Try ${retryCount + 1})`);
                    const genAI = new GoogleGenerativeAI(apiKeyToUse);
                    const model = genAI.getGenerativeModel({ 
                        model: modelName, 
                        generationConfig: { 
                            responseMimeType: "application/json",
                            temperature: 0.0
                        } 
                    });

                    const promptText = `
                    あなたはLeague of Legendsのプロコーチです。
                    添付された画像は、プレイヤーが「デスした直前」または「重要なシーン」の連続フレームです。
                    
                    ${matchContextStr}

                    思考プロセス:
                    1. **画面情報の正確な読み取り**:
                       - 時間、チャンピオン、戦況（誰がどこで何をしているか）
                    2. **コーチング分析**:
                       - 視界、判断、操作の評価
    
                    ユーザーの質問: ${request.question || "死因と改善点を教えて。"}
    
                    【出力形式 (JSON)】
                    {
                        "observed_champions": [ { "name": "", "evidence": "" } ],
                        "summary": "戦況要約（タイムスタンプ含む）",
                        "mistakes": [
                            { "timestamp": "mm:ss", "title": "", "severity": "CRITICAL" | "MINOR", "advice": "" }
                        ],
                        "finalAdvice": "一言アドバイス"
                    }
                    `;
    
                    const parts: any[] = [promptText];
                    request.frames.forEach((frame) => {
                        const matches = frame.match(/^data:(.+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            parts.push({
                                inlineData: { data: matches[2], mimeType: matches[1] }
                            });
                        }
                    });

                    if (parts.length <= 1) throw new Error("No frames provided");

                    const result = await model.generateContent(parts);
                    const text = result.response.text().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
                    
                    try {
                        analysisData = JSON.parse(text) as VisionAnalysisResult;
                        success = true;
                    } catch (e) {
                         // Parse error handled below
                         throw new Error(`JSON Parse Error: ${text.substring(0, 100)}...`);
                    }

                    // Success!
                    break; 

                } catch (e: any) {
                    console.warn(`[Vision Job ${jobId}] Error ${modelName}:`, e.message);
                    errors.push(`${modelName}: ${e.message}`);
                    if (e.message?.includes('429')) {
                        await sleep(5000);
                        retryCount++;
                        continue;
                    }
                    break; // Next model
                }
            }
            if (success) break;
        }

        if (!success || !analysisData) {
            throw new Error(`All models failed: ${errors.join(" | ")}`);
        }

        // --- SUCCESS: Update DB & Stats ---
        
        // --- SUCCESS: Update DB ---
        
        // 1. Update Job
        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: analysisData,
                error: null
            })
            .eq("id", jobId);

    } catch (e: any) {
        console.error(`[Vision Job ${jobId}] FAILED:`, e);

        // [REFUND]
        try {
            if (debited) {
                if (!shouldIncrementCount && !userApiKey) {
                    // Only refund credits for non-premium/non-BYOK users
                    const { data: currentProfile } = await supabase.from("profiles").select("analysis_credits").eq("id", userId).single();
                    if (currentProfile) {
                        await supabase.from("profiles").update({ analysis_credits: currentProfile.analysis_credits + 1 }).eq("id", userId);
                    }
                }
            }
        } catch (refundError) {
            console.error("Refund failed", refundError);
        }

        await supabase
            .from("video_analyses")
            .update({
                status: "failed",
                error: e.message || "Unknown internal error"
            })
            .eq("id", jobId);
    }
}

// --- NEW: Match Integrity Check (Validation) ---
export type MatchVerificationResult = {
    isValid: boolean;
    reason: string;
    detectedChampion?: string;
    confidence: number;
};

export async function verifyMatchVideo(
    frames: string[],
    matchContext: {
        myChampion: string;
        allies: string[];
        enemies: string[];
    }
): Promise<{ success: boolean; data?: MatchVerificationResult; error?: string }> {
    // 1. Auth & minimal rate limiting check (skip credit deduction for verification)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // [GUARD] Credit Check: Prevent cost leakage by ensuring user has at least 1 credit OR is premium
    const status = await getAnalysisStatus();
    if (!status) return { success: false, error: "User profile not found." };
    if (!status.is_premium && status.analysis_credits <= 0) {
        return { success: false, error: "分析クレジットが不足しているため、照合プロセスを開始できません。プレミアムへアップグレードするか、報酬広告でクレジットを獲得してください。" };
    }

    if (!GEMINI_API_KEY_ENV) return { success: false, error: "Server Configuration Error" };

    // 2. Setup Lightweight Model (Flash) with Retry Logic
    // Prioritize 2.5 Flash as it is the 2025 Standard.
    const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-lite"
    ];

    const errors: string[] = [];
    
    // Helper for delay
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
        try {
            console.log(`[Verify] Attempting model: ${modelName}`);
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_ENV);
            const model = genAI.getGenerativeModel({ 
                model: modelName, 
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1 
                } 
            });

            const prompt = `
            あなたはLeague of Legendsの「Match Integrity Judge（不正防止審判）」です。
            ユーザーがアップロードした動画が、本当に「選択された試合データ」のものであるかを厳格に審査してください。
            
            【厳格な審査基準】
            1. **チャンピオン絶対一致則 (Zero Tolerance Identity Check)**: 
               - ターゲット: **${matchContext.myChampion}**
               - **最重要・必須条件**: 動画の**操作プレイヤー（視点主）**が **${matchContext.myChampion}** であること。
               - 画面中央に常に表示されているキャラクター、または画面下部のスキルアイコン、左下の顔アイコン、ヘルスバーの色（自キャラは緑/黄色）を確認してください。
               - **注意**: 単に ${matchContext.myChampion} が画面に映っているだけでは不十分です（味方や敵として映っている可能性）。そのキャラが「操作されている（POVである）」ことが必須です。
               - もし「操作キャラが誰かわからない」や「別のキャラを操作している」場合は、**迷わず** \`isValid: false\` にしてください。
               - "Likely match" や "Maybe" は禁止です。100%の確信がない限り \`false\` です。
               - 少しでも疑わしい場合、理由は "Champion identity mismatch or uncertain" としてください。

            2. **チーム構成の確認**:
               - 味方 (${matchContext.allies.join(", ")}) や 敵 (${matchContext.enemies.join(", ")}) が1人でも確認できますか？
               - 全く異なるチャンピオン（例: LoLではないゲームのキャラ、リプレイのバグ表示）が映っている場合は \`isValid: false\` です。
               - 全く異なるチャンピオンが映っている場合は \`isValid: false\` です。

            【入力データ (正解)】
            - My Champion (MUST MATCH): ${matchContext.myChampion}
            - Allies: ${matchContext.allies.join(", ")}
            - Enemies: ${matchContext.enemies.join(", ")}

            【出力形式 (JSON)】
            {
                "isValid": boolean, // 照合結果。動画と試合データに明らかな不整合があればfalse。
                "reason": "選択した試合とは異なる動画が選択されています。",
                "detectedChampion": "動画内で検出されたチャンピオン名",
                "confidence": 0.0 ~ 1.0
            }
            `;
    
            const parts: any[] = [prompt];
            frames.forEach(f => {
                parts.push({
                    inlineData: {
                        data: f,
                        mimeType: "image/jpeg"
                    }
                });
            });
    
            const result = await model.generateContent(parts);
            const response = await result.response;
            const text = response.text().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
            
            const data = JSON.parse(text) as MatchVerificationResult;
            console.log(`[Verify] Result from ${modelName}:`, data);
            
            return { success: true, data };
            
        } catch (e: any) {
            console.warn(`[Verify] Error using ${modelName}:`, e.message);
            errors.push(`${modelName}: ${e.message}`);
            
            // If explicit 429, maybe wait? But here we just failover fast to next model 
            // unless it's the last model.
            if (e.message?.includes('429') && modelName === modelsToTry[modelsToTry.length - 1]) {
                 // Last model failed with 429, return error
            }
        }
    }

    return { success: false, error: `Verification All Failed: ${errors.join(", ")}` };
}
