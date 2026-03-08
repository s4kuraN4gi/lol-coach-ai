import { describe, it, expect, vi, beforeEach } from "vitest";
import { geminiRetry } from "../retry";

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Minimize wait times for tests (baseWaitMs: 1 + mock Math.random to 0)
const FAST = { baseWaitMs: 1 } as const;

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
});

describe("geminiRetry", () => {
    it("returns result on first successful call", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        const result = await geminiRetry(fn, FAST);
        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on 429 error and succeeds", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("429 Too Many Requests"))
            .mockResolvedValue("recovered");

        const result = await geminiRetry(fn, { ...FAST, maxRetries: 3 });
        expect(result).toBe("recovered");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries on 'Resource exhausted' error", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("Resource exhausted"))
            .mockResolvedValue("ok");

        const result = await geminiRetry(fn, { ...FAST, maxRetries: 2 });
        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries on error with status 429", async () => {
        const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
        const fn = vi
            .fn()
            .mockRejectedValueOnce(rateLimitErr)
            .mockResolvedValue("recovered");

        const result = await geminiRetry(fn, { ...FAST, maxRetries: 2 });
        expect(result).toBe("recovered");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws user-friendly message after exhausting retries on 429", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("429"));

        await expect(
            geminiRetry(fn, { ...FAST, maxRetries: 3 })
        ).rejects.toThrow("AI Service is busy (Rate Limited). Please try again later.");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws immediately on non-retryable errors", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("Invalid API key"));

        await expect(geminiRetry(fn, { ...FAST, maxRetries: 5 })).rejects.toThrow("Invalid API key");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry non-429 errors", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("PERMISSION_DENIED"))
            .mockResolvedValue("should not reach");

        await expect(geminiRetry(fn, { ...FAST, maxRetries: 3 })).rejects.toThrow("PERMISSION_DENIED");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("respects maxRetries option", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("429"));

        await expect(geminiRetry(fn, { ...FAST, maxRetries: 1 })).rejects.toThrow(
            "AI Service is busy (Rate Limited). Please try again later."
        );
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("preserves generic return type", async () => {
        const fn = vi.fn().mockResolvedValue({ data: [1, 2, 3] });
        const result = await geminiRetry<{ data: number[] }>(fn, FAST);
        expect(result.data).toEqual([1, 2, 3]);
    });

    it("uses fixed backoff when exponentialBackoff is false", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("429"))
            .mockResolvedValue("ok");

        await geminiRetry(fn, { ...FAST, maxRetries: 2, exponentialBackoff: false });
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("handles null/undefined errors without crashing", async () => {
        const fn = vi.fn().mockRejectedValue(null);

        await expect(geminiRetry(fn, { ...FAST, maxRetries: 2 })).rejects.toBeNull();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry if maxRetries is 1 even on 429", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("Too Many Requests"));

        await expect(geminiRetry(fn, { ...FAST, maxRetries: 1 })).rejects.toThrow(
            "AI Service is busy (Rate Limited). Please try again later."
        );
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
