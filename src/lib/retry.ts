import { logger } from "./logger";

/**
 * Check if an error is a Gemini rate-limit (429) error.
 */
function isRateLimitError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const e = error as Record<string, unknown>;
    const msg = typeof e.message === 'string' ? e.message : '';
    return (
        msg.includes('429') ||
        msg.includes('Too Many Requests') ||
        msg.includes('Resource exhausted') ||
        e.status === 429
    );
}

/**
 * Extract Retry-After delay (in ms) from a rate-limit error.
 * Checks errorDetails (gRPC metadata) and common error properties.
 * Returns null if not available, capped at 120s.
 */
function extractRetryAfterMs(error: unknown): number | null {
    if (typeof error !== 'object' || error === null) return null;
    const e = error as Record<string, unknown>;

    // Google AI SDK: errorDetails may contain retryDelay metadata
    if (Array.isArray(e.errorDetails)) {
        for (const detail of e.errorDetails) {
            if (typeof detail === 'object' && detail !== null) {
                const d = detail as Record<string, unknown>;
                // gRPC retry info: { retryDelay: "Xs" } or { retryDelay: { seconds: N } }
                if (typeof d.retryDelay === 'string') {
                    const match = d.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
                    if (match) return Math.min(parseFloat(match[1]) * 1000, 120_000);
                }
                if (typeof d.retryDelay === 'object' && d.retryDelay !== null) {
                    const rd = d.retryDelay as Record<string, unknown>;
                    if (typeof rd.seconds === 'number') return Math.min(rd.seconds * 1000, 120_000);
                }
            }
        }
    }

    // Retry-After header value (some HTTP clients attach it)
    if (typeof e.retryAfter === 'number') return Math.min(e.retryAfter * 1000, 120_000);
    if (typeof e.retryAfter === 'string') {
        const secs = parseFloat(e.retryAfter);
        if (!isNaN(secs)) return Math.min(secs * 1000, 120_000);
    }

    return null;
}

export interface GeminiRetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxRetries?: number;
    /** Use exponential backoff with jitter (default: true). If false, uses fixed 3s wait. */
    exponentialBackoff?: boolean;
    /** Base wait in ms for exponential backoff (default: 1500) */
    baseWaitMs?: number;
    /** Label for log messages (e.g. "VideoMacro", "Analysis") */
    label?: string;
}

/**
 * Generic retry wrapper for Gemini API calls with rate-limit detection.
 *
 * Supports two backoff strategies:
 * - Exponential backoff with jitter (default): wait = 2^attempt * baseWaitMs + random(0-2000ms)
 * - Fixed wait: 3 seconds between retries
 *
 * @example
 * // Returns text (videoMacro / guestAnalysis pattern)
 * const text = await geminiRetry(
 *   () => model.generateContent(parts).then(r => r.response.text()),
 *   { maxRetries: 5, label: 'VideoMacro' }
 * );
 *
 * @example
 * // Returns full result (analysis / damageAnalysis pattern)
 * const result = await geminiRetry(
 *   () => model.generateContent(content),
 *   { maxRetries: 3, exponentialBackoff: false, label: 'Analysis' }
 * );
 */
export async function geminiRetry<T>(
    fn: () => Promise<T>,
    options: GeminiRetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        exponentialBackoff = true,
        baseWaitMs = 1500,
        label = 'Gemini',
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            if (isRateLimitError(error) && attempt < maxRetries) {
                const retryAfterMs = extractRetryAfterMs(error);
                const waitMs = retryAfterMs
                    ?? (exponentialBackoff
                        ? Math.pow(2, attempt) * baseWaitMs + Math.random() * 2000
                        : 3000);
                logger.warn(
                    `[${label}] Rate limit (429). Retrying in ${Math.round(waitMs)}ms (${attempt}/${maxRetries})${retryAfterMs ? ' [Retry-After]' : ''}`
                );
                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }

            // Final attempt or non-retryable error
            if (isRateLimitError(error)) {
                throw new Error('AI Service is busy (Rate Limited). Please try again later.');
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
