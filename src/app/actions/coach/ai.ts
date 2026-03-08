import { getGeminiClient, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { geminiRetry } from "@/lib/retry";
import { logger } from "@/lib/logger";

/**
 * Call Gemini AI with model fallback chain.
 * Returns the parsed JSON result or an error.
 */
export async function callGeminiWithFallback(
    apiKey: string,
    systemPrompt: string
): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
    let responseText = "";
    let analysisResult: Record<string, unknown> | null = null;

    for (const modelName of GEMINI_MODELS_TO_TRY) {
        try {
            const genAI = getGeminiClient(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json"
                }
            });

            const result = await geminiRetry(
                () => model.generateContent(systemPrompt),
                { maxRetries: 3, label: `Coach ${modelName}` }
            );
            responseText = result.response.text();

            if (responseText) {
                analysisResult = JSON.parse(responseText);
                break;
            }
        } catch (modelError) {
            logger.error(`[Coach] ${modelName} failed`);
        }
    }

    if (!responseText || !analysisResult) {
        logger.error("All Gemini models failed. API Key valid?", !!apiKey);
        return { success: false, error: "AI Service Unavailable (All models failed). Please check API Key or try again later." };
    }

    return { success: true, result: analysisResult };
}
