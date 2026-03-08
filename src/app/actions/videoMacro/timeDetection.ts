'use server';

import { getGeminiClient, isValidGeminiApiKey, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { logger } from "@/lib/logger";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

/**
 * Detect in-game time from a video frame using Gemini vision
 * The game clock is displayed in the top-center of the screen
 */
export async function detectGameTimeFromFrame(
    frameBase64: string,
    userApiKey?: string
): Promise<{ success: boolean; gameTimeSeconds?: number; gameTimeStr?: string; error?: string }> {
    if (userApiKey && !isValidGeminiApiKey(userApiKey)) {
        return { success: false, error: "Invalid API key format." };
    }
    const apiKey = userApiKey || GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return { success: false, error: "API Key not found" };
    }

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const genAI = getGeminiClient(apiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODELS_TO_TRY[0],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0
                }
            });

            const prompt = `この画像はLeague of Legendsのゲーム画面です。
画面上部中央に表示されているゲーム内時間（タイマー）を読み取ってください。

時間は通常「mm:ss」形式で表示されています（例: 15:30, 8:45, 23:12など）。

【出力形式 (JSON)】
{
    "detected": true または false,
    "timeStr": "mm:ss形式の時間文字列",
    "minutes": 分の数値,
    "seconds": 秒の数値
}

時間が読み取れない場合は detected: false としてください。`;

            // Parse base64 data
            const matches = frameBase64.match(/^data:(.+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return { success: false, error: "Invalid base64 format" };
            }

            const parts = [
                prompt,
                { inlineData: { data: matches[2], mimeType: matches[1] } }
            ];

            const result = await model.generateContent(parts);
            const text = result.response.text()
                .replace(/^```json\s*/, "")
                .replace(/^```\s*/, "")
                .replace(/\s*```$/, "");

            const data = JSON.parse(text);

            if (data.detected && typeof data.minutes === 'number' && typeof data.seconds === 'number') {
                const totalSeconds = data.minutes * 60 + data.seconds;
                return {
                    success: true,
                    gameTimeSeconds: totalSeconds,
                    gameTimeStr: data.timeStr || `${data.minutes}:${data.seconds.toString().padStart(2, '0')}`
                };
            } else {
                return { success: false, error: "TIME_DETECTION_FAILED" };
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const is429 = errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('Resource exhausted');

            if (is429 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 2000;
                await delay(waitTime);
                continue;
            }

            logger.error("[detectGameTimeFromFrame] Error:", error);
            return { success: false, error: "TIME_DETECTION_FAILED" };
        }
    }

    return { success: false, error: "Max retries exceeded" };
}
