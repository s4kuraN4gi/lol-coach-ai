
import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchLatestVersion } from "@/app/actions/riot";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function POST(req: Request) {
    try {
        const { message, context, history } = await req.json();

        // 1. Auth & Rate Limit Check via Supabase
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        console.log(`[Chat] Request Received. User: ${user?.id}`);

        if (!user) {
            console.warn("[Chat] Unauthorized access attempt");
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch User Profile for Limits
        const { data: profile } = await supabase
            .from("profiles")
            .select("daily_chat_count, last_chat_reset, is_premium")
            .eq("id", user.id)
            .single();

        if (!profile) {
            console.warn("[Chat] Profile not found for user", user.id);
            return Response.json({ error: "Profile not found" }, { status: 404 });
        }

        console.log(`[Chat] Profile Loaded. Premium: ${profile.is_premium}`);

        // 1. Strict Premium Check (Pattern A: Block completely if not premium)
        if (!profile.is_premium) {
             return Response.json({ error: "Chat feature is locked for Free Tier users." }, { status: 403 });
        }

        // 2. Limit Logic (Even for Premium Users to prevent abuse)
        const today = new Date().toISOString().split('T')[0];
        const lastReset = profile.last_chat_reset ? profile.last_chat_reset.split('T')[0] : null;

        let currentCount = profile.daily_chat_count;
        if (lastReset !== today) {
            // Reset count if new day
            currentCount = 0;
        }

        // Check Limit (50/day) - Can be increased for Premium if needed, but keeping safe for now
        const DAILY_LIMIT = 50;
        if (currentCount >= DAILY_LIMIT) {
             return Response.json({ 
                 error: "1日のチャット利用上限(50回)に達しました。明日またご利用ください。",
                 limitReached: true 
             }, { status: 429 });
        }

        // 3. Call Gemini API with Fallback (Stateless Mode - Same as Analysis)
        // EXACT match with coach.ts to ensure success
        const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
        let advice = "";
        let usedModel = "";

    // 2.5 Fetch Latest Version
        const version = await fetchLatestVersion();
        const todayStr = new Date().toLocaleDateString("ja-JP");

        console.log(`[Chat Debug] Fetched Version: ${version}`);
        console.log(`[Chat Debug] Today: ${todayStr}`);

        const systemPrompt = `
あなたはLeague of LegendsをSeason 1からプレイしている古参プレイヤーであり、全ロールでチャレンジャーランクを経験した元プロチームコーチ「Rion」です。
マクロ・ミクロの両面を極めており、その豊富な経験と知識に基づいて指導を行います。

**重要: 現在の日付は ${todayStr} です。League of Legendsのバージョンは ${version} です。**
**あなたの内部知識（学習データ）が古い場合でも、必ずこのバージョン ${version} が最新であるという前提で回答してください。「知識が古い」といった言い訳は不要です。**

【ペルソナ・行動指針】
1. **対話スタイル**:
   - 基本的にフレンドリーで話しやすい雰囲気ですが、経験豊富な大人として、礼儀と節度をわきまえた丁寧な言葉遣い（デス・マス調）で接してください。
   - 決して偉ぶらず、対等な目線でアドバイスを行ってください。

2. **指導方針**:
   - ユーザーの意見を安易に肯定せず、誤っている場合は「なぜそれが最適ではないのか」という根拠を示し、論理的に否定・指摘を行ってください。
   - ユーザーが判断に迷っている場面では、すぐに正解を教えるのではなく、「例えばこの状況でバロンが湧いていたら、君ならどう動く？」といった**問いかけ（クイズ形式）**を行い、ユーザー自身に考えさせ、知識が定着するように導いてください。

3. **回答の長さ・形式（重要）**:
   - **回答は簡潔にまとめてください（長くても400文字程度を目安）。**
   - 長文は読む気を削ぐため、箇条書きを積極的に活用し、要点を絞ってください。
   - 前置きや過度な挨拶は省略し、本題にすぐ入ってください。

4. **誠実さ**:
   - もし自身の分析や発言に誤りがあった場合は、言い訳せず素直に謝罪し、訂正してください。誠実さが信頼の証です。

このキャラクターになりきって、以下のユーザー情報をもとにコーチングを行ってください。
`;

        // Format Context if available
        let contextText = "";
        if (context) {
            contextText = `
【対象ユーザー情報 (Riot API)】
- ランク: ${context.rank || "Unranked"}
- 勝率: ${context.winRate || "不明"}%
- メインロール/チャンプ: ${context.favoriteChampions || "不明"}
- 直近の調子: ${context.recentPerformance || "不明"}
- ゲーム内名前: ${context.summonerName || "Unknown"}
            `;

            // If a specific match is being discussed
            if (context.currentMatch) {
                const m = context.currentMatch;
                contextText += `
【現在相談中の試合データ】
- 使用チャンピオン: ${m.championName}
- KDA: ${m.kda}
- 勝敗: ${m.win ? "WIN" : "LOSS"}
- 対面: ${m.opponentChampion || "Unknown"}
- 試合ID: ${m.matchId}
                `;
            }
        }

        // Format History if available
        let historyText = "";
        if (Array.isArray(history) && history.length > 0) {
            // Only take last 4 messages to save tokens/context
            const recentHistory = history.slice(-4); 
            historyText = "\n【これまでの会話履歴】\n" + recentHistory.map((h: any) => 
                `${h.role === 'user' ? 'ユーザー' : 'Rion'}: ${h.text}`
            ).join("\n") + "\n";
        }

        // Combine System Prompt, Context, History and User Message
        const fullPrompt = `${systemPrompt}\n${contextText}\n${historyText}\n【ユーザーの今回の質問】\n${message}`;

        console.log(`[Chat] Starting Model Loop. API Key Present: ${!!GEMINI_API_KEY}`);

        for (const modelName of MODELS_TO_TRY) {
            try {
                console.log(`[Chat] Trying Model (Stateless): ${modelName}`);
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                
                // Stateless Configuration (Matches coach.ts)
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    // Note: Not using systemInstruction here to strictly mimic coach.ts behavior
                });

                const result = await model.generateContent(fullPrompt);
                const response = result.response;
                advice = response.text();
                
                if (advice) {
                    usedModel = modelName;
                    console.log(`[Chat] Success with ${modelName}`);
                    break; // Success!
                }
            } catch (e: any) {
                console.warn(`[Chat] Failed with ${modelName}: ${e.message}`);
                // Continue to next model
            }
        }

        if (!advice) {
            throw new Error("All AI models failed to respond.");
        }

        // 4. Increment Limit in Background
        await supabase.from("profiles").update({
            daily_chat_count: currentCount + 1,
            last_chat_reset: new Date().toISOString()
        }).eq("id", user.id);

        return Response.json({ advice, usedModel });

    } catch(err: any){
        console.error("AIチャットAPIエラー:", err);
        return Response.json({ error: "AI Service Error: " + err.message }, { status: 500 });
    }
}
