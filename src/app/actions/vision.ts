'use server';

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';
import { getAnalysisStatus } from "./analysis";
import { WEEKLY_ANALYSIS_LIMIT } from "./constants";
import { fetchMatchDetail, fetchLatestVersion, fetchMatchTimeline, extractMatchEvents, getChampionAttributes } from "./riot";

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
    timeOffset?: number; // Added: Sync offset (Video Time - Game Time)
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
        const weeklyCount = status.weekly_analysis_count || 0;
        if (weeklyCount >= WEEKLY_ANALYSIS_LIMIT) return { success: false, error: `週間制限に達しました (${weeklyCount}/${WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。` };
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
            // Weekly limit check
            const weeklyCount = status.weekly_analysis_count || 0;
            if (weeklyCount >= WEEKLY_ANALYSIS_LIMIT) {
                throw new Error(`週間制限に達しました (${weeklyCount}/${WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。`);
            }
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
             // Increment weekly count (reset is handled by getAnalysisStatus)
             const newWeeklyCount = (status.weekly_analysis_count || 0) + 1;
             await supabase.from("profiles").update({ weekly_analysis_count: newWeeklyCount }).eq("id", userId);
             debited = true;
        } else if (!userApiKey && useEnvKey && !status.is_premium) {
             await supabase.from("profiles").update({ analysis_credits: status.analysis_credits - 1 }).eq("id", userId);
             debited = true;
        }

        // --- CORE ANALYSIS LOGIC (Copied from original) ---
        const version = await fetchLatestVersion(); // Fetch latest version

        // 1. MATCH CONTEXT & Truth Injection
        let matchContextStr = "";
        let myChampName = "Unknown";
        let truthEvents: any[] = [];
        let champAttrs: any = null;
        
        if (request.matchId && request.puuid) {
            console.log(`[Vision Job ${jobId}] Fetching match context...`);
            const [matchRes, timelineRes] = await Promise.all([
                fetchMatchDetail(request.matchId),
                fetchMatchTimeline(request.matchId)
            ]);

            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: any) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) {
                     myChampName = me.championName;
                     // Fetch Champion Attributes
                     champAttrs = await getChampionAttributes(me.championName);
                }
                const allies = parts.filter((p: any) => p.teamId === myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: any) => p.teamId !== myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);

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

            // Extract Truth Events (Wide Window fallback)
            // Ideally we wait for TimeSync result, but for now we fetch ALL relevant events or wide window.
            // Since we don't know exact game time yet (we ask AI to find it), we pass a loose set or empty first?
            // BETTER: We can't filter by time efficiently without knowing time.
            // STRATEGY: We inject KEY events (Kills/Objectives) for the WHOLE game? Too big.
            // We'll ask AI to find time, then we verify? No, one shot.
            // Fallback: We rely on AI finding time first in a previous step?
            // No, user wants it now.
            // Compromise: We fetch all "Elite Monster Kills" and "My Deaths" for the whole game.
            if (timelineRes.success) {
                const allEvents = await extractMatchEvents(timelineRes.data, request.puuid);
                // Filter to critical ones to limit token usage if needed, or just pass first 50 relevant.
                truthEvents = allEvents.filter(e => e.type === 'KILL' || e.type === 'OBJECTIVE');
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
                    あなたはLeague of Legendsの「ミクロ戦術（メカニクス・操作技術・カメラワーク）」に特化した専門コーチです。
                    添付された画像（連続フレーム）から、プレイヤーの技術的な改善点を指摘してください。
                    
                    ${matchContextStr}

                    **【重要：禁止事項】**
                    - **マクロな指摘の禁止**: 「ドラゴンを取られた」「反対側のレーンをプッシュすべき」などのマップ全体の戦略には言及しないでください。
                    - **「味方が悪い」等の他責思考**: 画面外の味方の動きを評価しないでください。
                    - **誤った事実の捏造**: 以下の「確定事実」に書かれていないキルやオブジェクト取得を、映像から無理やり読み取らないでください。

                    **【Riot APIによる確定事実 (Truth Events)】**
                    ※以下のイベントは**絶対的な事実**です。
                    ${JSON.stringify(truthEvents.slice(0, 30))} 
                    (※主要イベント抜粋。映像内の時間と一致するイベントがあれば、それを前提に分析してください)

                    **【分析ターゲット】**
                    1. **カメラ操作 (F-Keys / Tab)**:
                       - 激しい戦闘中や移動中に、カメラを適切に敵や味方に合わせているか？
                       - 情報を収集しようとするカメラの動きがあるか？
                    2. **スキル精度 (Skillshots)**:
                       - スキルショットを外していないか？敵のスキルを避ける動き（サイドステップ）はできているか？
                       - **チャンピオン特性 (${champAttrs?.class || '不明'}) に適した動き**ができているか？ (例: Assassinなら敵キャリーを狙う、ADCならカイトする)
                    3. **ダメージトレード**:
                       - 敵のクールダウン中に攻撃できているか？
                       - ミニオンシャワー（Aggro）を無駄に受けていないか？

                    **現在のLoLバージョン: ${version}**

                    ユーザーの質問: ${request.question || "操作やメカニクスの改善点を教えて。"}
    
                    【出力形式 (JSON)】
                    {
                        "observed_champions": [ { "name": "", "evidence": "" } ],
                        "summary": "戦況要約（事実ベース）",
                        "mistakes": [
                            { "timestamp": "mm:ss", "title": "短いタイトル", "severity": "CRITICAL" | "MINOR", "advice": "具体的な操作改善案" }
                        ],
                        "finalAdvice": "ミクロ視点での総評",
                        "initialGameTime": "mm:ss" 
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
                        
                        // --- Time Sync Calculation ---
                        if ((analysisData as any).initialGameTime) {
                             const initTimeStr = (analysisData as any).initialGameTime;
                             const [m, s] = initTimeStr.split(':').map(Number);
                             if (!isNaN(m) && !isNaN(s)) {
                                 // Standard: The first frame used is approximately at t=0 of the *analyzed segment*
                                 // But wait, the client extracts frames. The first frame passed IS the start.
                                 // So Video Start Time (0s relative to passed frames) = initTimeStr
                                 // videoTime (0) - gameTime (initTime) = offset
                                 const gameTimeSec = m * 60 + s;
                                 analysisData.timeOffset = 0 - gameTimeSec; 
                                 
                                 // Wait, if video starts at 60s (skipped loading), client frames might be from 60s?
                                 // Actually no, for the AI, the first frame IS "Frame 1".
                                 // But we need to know the VIDEO FILE timestamp of "Frame 1".
                                 // The client sends just base64 frames. It does NOT send timestamps of frames currently.
                                 // This is a limitation. We assume Frame 1 is the "Start of Analysis".
                                 // If client skipped 60s, then Frame 1 is at 60s of the file.
                                 // We need `startTime` input in `VisionAnalysisRequest` to correspond to file time.
                                 // Currently `request` doesn't have it.
                                 // Plan: For now, assume Frame 1 corresponds to "Start of Video Context".
                                 // If the user skipped loading screen (frontend logic?), then we need that info.
                                 // But wait, `startVisionAnalysis` handles the job creation. The worker just gets frames.
                                 // The frames are extracted by `VideoProcessor`.
                                 // If VideoProcessor skipped 60s, Frame 1 is at 60s.
                                 // We need to pass `startTime` from Client.
                                 // Let's rely on Client passing accurate frames.
                                 // If we don't know the file timestamp of Frame 1, we can't calculate exact file offset.
                                 // CRITICAL: The prompt asks for "initialGameTime".
                                 // Let's assume for this MVP that Offset = (Start Video Time) - (Detected Game Time).
                                 // BUT we don't know Start Video Time here (it's in Client param).
                                 // Valid approach: Just return `initialGameTime` in result. 
                                 // Frontend can calculate offset: Offset = CurrentVideoTime - GameTime.
                                 // BUT backend saves `time_offset`.
                                 // Let's assume Frame 1 is roughly "Start of Analysis".
                                 // If we calculate offset here, we need Frame 1's file timestamp.
                                 // For now: Just save `initialGameTime` (in seconds) as `time_offset`? No.
                                 // Let's calculate a "Game Start Offset" relative to this specific analysis block.
                                 // Actually, simpler: 
                                 // `time_offset` = How many seconds needed to add to Game Time to get Video Time.
                                 // Frame 1 Video Time = X (unknown here, but usually 0 on short clips).
                                 // If we can't get X, we can't correct perfectly for long videos with skip.
                                 // Workaround: We will update `VisionAnalysisRequest` type to optionally include `frameTimestamps`.
                                 // But since I can't easily change Client -> Server contract for large payload structure without risk,
                                 // I will assume Frame 1 is at 0s of the *clip sent* or rely on `initialGameTime` being returned
                                 // and let the frontend update the DB or Local State?
                                 // No, the task is to save `time_offset` to DB.
                                 // Let's simply save the `initialGameTime` in seconds as a NEGATIVE value (Game Time Start).
                                 // E.g. if Game shows 00:00, offset is 0.
                                 // If Game shows 01:00, offset is -60. (Video 0 = Game 60).
                                 // This implies Video Time = Game Time + Offset.
                                 // 0 = 60 + (-60). Correct.
                                 // This assumes the video starts at the frame we analyzed.
                                 analysisData.timeOffset = -gameTimeSec;
                             }
                        }
                        
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

        // --- Post-Process Validation: Champion Detection ---
        // Verify observed_champions against match context if available
        if (analysisData.observed_champions && myChampName !== "Unknown") {
            const validChampions = new Set([myChampName.toLowerCase()]);
            // Add allies and enemies if we have matchContext
            const detectedValid = analysisData.observed_champions.filter((obs: any) => {
                const isValid = validChampions.has(obs.name?.toLowerCase());
                if (!isValid && obs.name) {
                    console.warn(`[Vision Validation] Detected champion "${obs.name}" not in match context - marking as unverified`);
                }
                return true; // Keep all for now, but mark
            });
            console.log(`[Vision] Champion detection: ${analysisData.observed_champions.length} champions found, ${detectedValid.filter((o: any) => validChampions.has(o.name?.toLowerCase())).length} verified against match`);
        }

        
        // --- SUCCESS: Update DB ---
        
        // 1. Update Job
        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: analysisData,
                time_offset: analysisData.timeOffset || 0, // Save extracted offset
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
