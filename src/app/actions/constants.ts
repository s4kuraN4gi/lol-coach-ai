// Analysis limit constants and types
// Note: This file is separate from server actions because "use server" files can only export async functions

// Analysis limits by plan
export const FREE_WEEKLY_ANALYSIS_LIMIT = 3;       // Free users: 3 analyses per week
export const FREE_MONTHLY_ANALYSIS_LIMIT = FREE_WEEKLY_ANALYSIS_LIMIT; // Legacy alias
export const PREMIUM_WEEKLY_ANALYSIS_LIMIT = 20;  // Premium users: 20 analyses per week
export const EXTRA_WEEKLY_ANALYSIS_LIMIT = 50;    // Extra users: 50 analyses per week

// Max segments by plan
export const FREE_MAX_SEGMENTS = 2;
export const PREMIUM_MAX_SEGMENTS = 4;
export const EXTRA_MAX_SEGMENTS = 5;

// Frames per segment (balance between analysis quality and API cost/speed)
export const FRAMES_PER_SEGMENT = 4;

// Inter-segment delay for free users (rate limiting, ms)
export const FREE_INTER_SEGMENT_DELAY_MS = 1500;

// Legacy constant (kept for backwards compatibility, use plan-specific limits instead)
export const WEEKLY_ANALYSIS_LIMIT = PREMIUM_WEEKLY_ANALYSIS_LIMIT;

export type SubscriptionTier = 'free' | 'premium' | 'extra';

export type AnalysisStatus = {
  is_premium: boolean;
  analysis_credits: number;
  subscription_tier: string;
  daily_analysis_count: number;  // Legacy - kept for backwards compatibility
  last_analysis_date: string;    // Legacy
  weekly_analysis_count: number; // New: Weekly usage count
  weekly_reset_date: string;     // New: Next Monday reset date
  subscription_end_date?: string | null;
  auto_renew?: boolean;
  last_credit_update?: string;
  last_reward_ad_date?: string;
};

/** Check if user is on the Extra tier */
export function isExtraTier(status: AnalysisStatus | null): boolean {
  return status?.subscription_tier === 'extra';
}

/** Check if user is on Premium or Extra (both are "premium" level) */
export function isPremiumOrExtra(status: AnalysisStatus | null): boolean {
  return status?.is_premium === true;
}

/** Get weekly analysis limit based on subscription tier */
export function getWeeklyLimit(status: AnalysisStatus | null): number {
  if (!status) return 0;
  if (status.subscription_tier === 'extra') return EXTRA_WEEKLY_ANALYSIS_LIMIT;
  if (status.is_premium) return PREMIUM_WEEKLY_ANALYSIS_LIMIT;
  return FREE_WEEKLY_ANALYSIS_LIMIT;
}

/** Calculate the next Monday at 00:00:00 from a given date */
export function getNextMonday(from: Date): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  // 0=Sunday → 1 day, 1=Monday → 7 days, ..., 6=Saturday → 2 days
  const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
  result.setDate(result.getDate() + daysUntilMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Calculate the 1st of next month at 00:00:00 from a given date */
export function getNextMonthStart(from: Date): Date {
  const result = new Date(from);
  result.setMonth(result.getMonth() + 1, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}
