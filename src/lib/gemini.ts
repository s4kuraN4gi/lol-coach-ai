import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Cache GoogleGenerativeAI instances by API key to reuse across requests
 * within the same server process (avoids re-constructing on every call).
 */
const cache = new Map<string, GoogleGenerativeAI>();

export function getGeminiClient(apiKey: string): GoogleGenerativeAI {
    let client = cache.get(apiKey);
    if (!client) {
        client = new GoogleGenerativeAI(apiKey);
        cache.set(apiKey, client);
    }
    return client;
}
