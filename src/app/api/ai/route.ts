import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match, summonerName, role="Top" } = body;
    if (
      !match?.info?.participants ||
      !Array.isArray(match.info.participants)
    ) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    //試合データ整形
    const p = match.info.participants[0];
    const compact = {
      summonerName: summonerName ?? p?.summonerName,
      championName: p?.championName,
      k: p?.kills,
      d: p?.deaths,
      a: p?.assists,
      win: !!p?.win,
      gameDuration: Math.floor(match.info.gameDuration ?? 0 / 60),
    };

    //プロンプト作成
    const system = `
あなたはLeague of Legendsの上位プレイヤー兼プロコーチ「Rion」です。
対象プレイヤーはゴールド〜プラチナ帯。
${role}ロールに応じて着目点を変えてください。

【出力フォーマット】
🏹 **要点まとめ（2〜3行）**
💡 **改善ポイント（2〜3個）**
🔥 **練習メニュー**
💬 **励ましメッセージ**

出力は日本語で、${role}ロールの視点で具体的に書いてください。
`.trim();

    const user = `
        - Summoner: ${compact.summonerName}
        - Role: ${role}
        - Champion: ${compact.championName}
        - KDA: ${compact.k}/${compact.d}/${compact.a}
        - Result: ${compact.win ? "Victory" : "Defeat"}
        - Game Duration: ${compact.gameDuration} min

        Rules:
        - 指示は具体例（例：「3wave目でフリーズ」「6レベ先行でオールイン」）を含める
        - CS/視界/スキル回し/ローム/リソース管理から優先課題を1〜2個に絞る
        - 練習タスクは15〜20分で反復できる粒度にする
        `.trim();

    //モデル呼び出し
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const advice =
      completion.choices[0]?.message?.content ??
      "コーチからのアドバイスを生成できませんでした。";

    return Response.json({ advice });
  } catch (err: any) {
    console.log("AI route error:", err);
    const msg =
      typeof err?.message === "string" ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, usage: "POST match JSON from /api/riot" });
}
