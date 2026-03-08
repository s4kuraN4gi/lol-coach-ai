import { geminiRetry } from "@/lib/retry";

interface GenerativeModelLike {
    generateContent: (content: string | (string | { inlineData: { data: string; mimeType: string } })[]) => Promise<{ response: { text: () => string } }>;
}

/**
 * Call model.generateContent with rate-limit retry (fixed 3s backoff, max 3 attempts).
 * Returns the full Gemini result object — callers use result.response.text().
 */
export async function generateContentWithRetry(model: GenerativeModelLike, content: string | (string | { inlineData: { data: string; mimeType: string } })[]): Promise<{ response: { text: () => string } }> {
    return geminiRetry(() => model.generateContent(content), {
        maxRetries: 3,
        exponentialBackoff: false,
        label: 'Analysis',
    });
}
