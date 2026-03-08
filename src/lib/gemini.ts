import { GoogleGenerativeAI } from "@google/generative-ai";

/** Ordered list of Gemini models to try (primary -> fallback) */
export const GEMINI_MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
] as const;

const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
    client: GoogleGenerativeAI;
    createdAt: number;
};

/**
 * Cache GoogleGenerativeAI instances by API key to reuse across requests
 * within the same server process. Capped at MAX_CACHE_SIZE entries with TTL.
 * User-provided keys are NOT cached — only the server env key.
 */
const cache = new Map<string, CacheEntry>();

const SERVER_KEY = process.env.GEMINI_API_KEY ?? "";

export function getGeminiClient(apiKey: string): GoogleGenerativeAI {
    // Only cache the server-owned env key — never cache user-provided keys
    const isServerKey = apiKey === SERVER_KEY;

    if (!isServerKey) {
        return new GoogleGenerativeAI(apiKey);
    }

    const entry = cache.get(apiKey);
    if (entry && Date.now() - entry.createdAt < CACHE_TTL_MS) {
        return entry.client;
    }

    // Evict stale entry or make room
    if (entry) {
        cache.delete(apiKey);
    } else if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }

    const client = new GoogleGenerativeAI(apiKey);
    cache.set(apiKey, { client, createdAt: Date.now() });
    return client;
}

/** Validate Gemini API key format (AIza prefix, 39 chars, alphanumeric + _ + -) */
const GEMINI_KEY_RE = /^AIza[A-Za-z0-9_-]{35}$/;

export function isValidGeminiApiKey(key: string): boolean {
    return GEMINI_KEY_RE.test(key);
}
