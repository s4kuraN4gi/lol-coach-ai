
import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
    try {
        const { message } = await req.json();

        // 1. Auth & Rate Limit Check via Supabase
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch User Profile for Limits
        const { data: profile } = await supabase
            .from("profiles")
            .select("daily_chat_count, last_chat_reset, is_premium")
            .eq("id", user.id)
            .single();

        if (!profile) {
            return Response.json({ error: "Profile not found" }, { status: 404 });
        }

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

        // 3. Call Gemini API
        const systemPrompt = `
あなたはLeague of Legendsの上位プレイヤー兼プロコーチ「Rion」です。
対象プレイヤーはゴールド〜ダイヤ帯。
質問内容に応じて以下の方針で回答してください。

【回答フォーマット】
🏹 要点まとめ（2〜3行）
💡 改善ポイント（具体的な例を2〜3個）
🔥 練習メニュー（15〜30分で実行できる内容）
💬 励ましコメント

出力は日本語で、LoLプレイヤーに寄り添ったトーンで。
`;

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: "model",
                    parts: [{ text: "了解しました。コーチのRionです。ゴールドからダイヤ帯のプレイヤーに向けて、具体的かつ実践的なアドバイスを提供します。どのような質問でしょうか？" }],
                },
            ],
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const result = await chat.sendMessage(message);
        const response = result.response;
        const advice = response.text();

        // 4. Increment Limit in Background
        await supabase.from("profiles").update({
            daily_chat_count: currentCount + 1,
            last_chat_reset: new Date().toISOString()
        }).eq("id", user.id);

        return Response.json({ advice });

    } catch(err: any){
        console.error("AIチャットAPIエラー:", err);
        return Response.json({ error: "AI Service Error" }, { status: 500 });
    }
}
