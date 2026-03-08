'use server';

import { createClient, getUser } from "@/utils/supabase/server";
import { getGeminiClient, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { geminiRetry } from "@/lib/retry";
import { refreshAnalysisStatus } from "../analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "../constants";
import { logger } from "@/lib/logger";
import type { MatchVerificationResult } from "./types";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export async function verifyMatchVideo(
    frames: string[],
    matchContext: {
        myChampion: string;
        allies: string[];
        enemies: string[];
    }
): Promise<{ success: boolean; data?: MatchVerificationResult; error?: string }> {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const status = await refreshAnalysisStatus(user.id);
    if (!status) return { success: false, error: "User profile not found." };
    const weeklyCount = status.weekly_analysis_count || 0;
    const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
    if (weeklyCount >= limit) {
        return { success: false, error: status.is_premium ? "WEEKLY_LIMIT_REACHED" : "FREE_WEEKLY_LIMIT_REACHED" };
    }

    if (!GEMINI_API_KEY_ENV) return { success: false, error: "Server Configuration Error" };

    for (const modelName of GEMINI_MODELS_TO_TRY) {
        try {
            const genAI = getGeminiClient(GEMINI_API_KEY_ENV);
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
               - 少しでも疑わしい場合、理由コードは "CHAMPION_MISMATCH" としてください。

            2. **チーム構成の確認**:
               - 味方 (${matchContext.allies.join(", ")}) や 敵 (${matchContext.enemies.join(", ")}) が1人でも確認できますか？
               - 全く異なるチャンピオン（例: LoLではないゲームのキャラ、リプレイのバグ表示）が映っている場合は \`isValid: false\` です。
               - 全く異なるチャンピオンが映っている場合は \`isValid: false\` で、理由コードは "TEAM_MISMATCH" です。

            【入力データ (正解)】
            - My Champion (MUST MATCH): ${matchContext.myChampion}
            - Allies: ${matchContext.allies.join(", ")}
            - Enemies: ${matchContext.enemies.join(", ")}

            【出力形式 (JSON)】
            {
                "isValid": boolean,
                "reason": "CHAMPION_MISMATCH | TEAM_MISMATCH | OTHER",
                "detectedChampion": "動画内で検出されたチャンピオン名",
                "confidence": 0.0 ~ 1.0
            }
            `;

            const parts: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];
            frames.forEach(f => {
                parts.push({
                    inlineData: {
                        data: f,
                        mimeType: "image/jpeg"
                    }
                });
            });

            const result = await geminiRetry(
                () => model.generateContent(parts),
                { maxRetries: 3, label: `Verify ${matchContext.myChampion}` }
            );
            const text = result.response.text().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

            if (text.length > 50 * 1024) {
                throw new Error("Response too large");
            }

            const data = JSON.parse(text) as MatchVerificationResult;
            return { success: true, data };

        } catch (e) {
            logger.warn(`[Verify] Error using ${modelName}: verification failed`);
        }
    }

    return { success: false, error: "ANALYSIS_FAILED" };
}
