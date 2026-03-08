import { describe, it, expect } from "vitest";
import {
  FREE_WEEKLY_ANALYSIS_LIMIT,
  PREMIUM_WEEKLY_ANALYSIS_LIMIT,
  EXTRA_WEEKLY_ANALYSIS_LIMIT,
  FREE_MAX_SEGMENTS,
  PREMIUM_MAX_SEGMENTS,
  EXTRA_MAX_SEGMENTS,
  FRAMES_PER_SEGMENT,
  getWeeklyLimit,
  isExtraTier,
  isPremiumOrExtra,
  getNextMonday,
  type AnalysisStatus,
} from "../constants";

// Helper to create a minimal AnalysisStatus for testing
function makeStatus(overrides: Partial<AnalysisStatus> = {}): AnalysisStatus {
  return {
    is_premium: false,
    analysis_credits: 0,
    subscription_tier: "free",
    daily_analysis_count: 0,
    last_analysis_date: "",
    weekly_analysis_count: 0,
    weekly_reset_date: "",
    ...overrides,
  };
}

describe("constants", () => {
  it("FREE_WEEKLY_ANALYSIS_LIMIT should be 3 (weekly limit)", () => {
    expect(FREE_WEEKLY_ANALYSIS_LIMIT).toBe(3);
  });

  it("PREMIUM_WEEKLY_ANALYSIS_LIMIT should be 20", () => {
    expect(PREMIUM_WEEKLY_ANALYSIS_LIMIT).toBe(20);
  });

  it("EXTRA_WEEKLY_ANALYSIS_LIMIT should be 50", () => {
    expect(EXTRA_WEEKLY_ANALYSIS_LIMIT).toBe(50);
  });
});

describe("getWeeklyLimit", () => {
  it("returns 0 for null status", () => {
    expect(getWeeklyLimit(null)).toBe(0);
  });

  it("returns FREE limit for free users", () => {
    const status = makeStatus({ subscription_tier: "free", is_premium: false });
    expect(getWeeklyLimit(status)).toBe(FREE_WEEKLY_ANALYSIS_LIMIT);
  });

  it("returns PREMIUM limit for premium users", () => {
    const status = makeStatus({ subscription_tier: "premium", is_premium: true });
    expect(getWeeklyLimit(status)).toBe(PREMIUM_WEEKLY_ANALYSIS_LIMIT);
  });

  it("returns EXTRA limit for extra tier users", () => {
    const status = makeStatus({ subscription_tier: "extra", is_premium: true });
    expect(getWeeklyLimit(status)).toBe(EXTRA_WEEKLY_ANALYSIS_LIMIT);
  });
});

describe("isExtraTier", () => {
  it("returns false for null", () => {
    expect(isExtraTier(null)).toBe(false);
  });

  it("returns false for free tier", () => {
    expect(isExtraTier(makeStatus({ subscription_tier: "free" }))).toBe(false);
  });

  it("returns false for premium tier", () => {
    expect(isExtraTier(makeStatus({ subscription_tier: "premium" }))).toBe(false);
  });

  it("returns true for extra tier", () => {
    expect(isExtraTier(makeStatus({ subscription_tier: "extra" }))).toBe(true);
  });
});

describe("isPremiumOrExtra", () => {
  it("returns false for null", () => {
    expect(isPremiumOrExtra(null)).toBe(false);
  });

  it("returns false for free users", () => {
    expect(isPremiumOrExtra(makeStatus({ is_premium: false }))).toBe(false);
  });

  it("returns true for premium users", () => {
    expect(isPremiumOrExtra(makeStatus({ is_premium: true }))).toBe(true);
  });

  it("returns true for extra tier (is_premium=true)", () => {
    expect(isPremiumOrExtra(makeStatus({ is_premium: true, subscription_tier: "extra" }))).toBe(true);
  });
});

describe("getNextMonday", () => {
  it("returns next Monday from a Wednesday", () => {
    // 2026-02-25 is a Wednesday
    const wed = new Date(2026, 1, 25, 14, 30);
    const result = getNextMonday(wed);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(2); // March 2
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("returns next Monday from a Sunday", () => {
    // 2026-03-01 is a Sunday
    const sun = new Date(2026, 2, 1, 10, 0);
    const result = getNextMonday(sun);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2); // March 2
  });

  it("returns the following Monday when called on a Monday", () => {
    // 2026-03-02 is a Monday
    const mon = new Date(2026, 2, 2, 8, 0);
    const result = getNextMonday(mon);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(9); // March 9 (next Monday)
  });

  it("returns next Monday from a Saturday", () => {
    // 2026-02-28 is a Saturday
    const sat = new Date(2026, 1, 28, 23, 59);
    const result = getNextMonday(sat);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2); // March 2
  });

  it("sets time to midnight", () => {
    const date = new Date(2026, 1, 25, 18, 45, 30, 999);
    const result = getNextMonday(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe("segment & frame constants", () => {
  it("FREE_MAX_SEGMENTS should be 2", () => {
    expect(FREE_MAX_SEGMENTS).toBe(2);
  });

  it("PREMIUM_MAX_SEGMENTS should be 4", () => {
    expect(PREMIUM_MAX_SEGMENTS).toBe(4);
  });

  it("EXTRA_MAX_SEGMENTS should be 5", () => {
    expect(EXTRA_MAX_SEGMENTS).toBe(5);
  });

  it("FRAMES_PER_SEGMENT should be 4", () => {
    expect(FRAMES_PER_SEGMENT).toBe(4);
  });

  it("tier hierarchy: FREE < PREMIUM < EXTRA segments", () => {
    expect(FREE_MAX_SEGMENTS).toBeLessThan(PREMIUM_MAX_SEGMENTS);
    expect(PREMIUM_MAX_SEGMENTS).toBeLessThan(EXTRA_MAX_SEGMENTS);
  });

  it("tier hierarchy: FREE < PREMIUM < EXTRA weekly limits", () => {
    expect(FREE_WEEKLY_ANALYSIS_LIMIT).toBeLessThan(PREMIUM_WEEKLY_ANALYSIS_LIMIT);
    expect(PREMIUM_WEEKLY_ANALYSIS_LIMIT).toBeLessThan(EXTRA_WEEKLY_ANALYSIS_LIMIT);
  });
});
