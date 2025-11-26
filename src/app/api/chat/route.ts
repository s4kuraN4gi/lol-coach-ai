
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_AI_KEY,
});

export async function POST(req: Request) {
    try {
        const { message } = await req.json();

        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
あなたはLeague of Legendsの上位プレイヤー兼プロコーチ「Rion」です。
対象プレイヤーはゴールド〜ダイヤ帯。
質問内容に応じて以下の方針で回答してください。

【回答フォーマット】
🏹 要点まとめ（2〜3行）
💡 改善ポイント（具体的な例を2〜3個）
🔥 練習メニュー（15〜30分で実行できる内容）
💬 励ましコメント

出力は日本語で、LoLプレイヤーに寄り添ったトーンで。
`},
                {role: "user", content: message},
            ]
        })

        const advice = completion.choices[0]?.message?.content ?? "回答が生成できませんでした。"
        return Response.json({advice})
    } catch(err){
        console.error("AIチャットAPIエラー:", err);
        return Response.json({error: "Internal Server Error"}, {status: 500});
    }
}
