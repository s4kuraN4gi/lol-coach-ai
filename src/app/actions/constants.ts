// Analysis limit constants and types
// Note: This file is separate from server actions because "use server" files can only export async functions

// Weekly analysis limits by plan
export const FREE_WEEKLY_ANALYSIS_LIMIT = 3;      // Free users: 3 analyses per week
export const PREMIUM_WEEKLY_ANALYSIS_LIMIT = 20;  // Premium users: 20 analyses per week
export const EXTRA_WEEKLY_ANALYSIS_LIMIT = 50;    // Extra users: 50 analyses per week

// Max segments by plan
export const EXTRA_MAX_SEGMENTS = 8;

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
