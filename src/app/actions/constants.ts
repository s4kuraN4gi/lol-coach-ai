// Analysis limit constants and types
// Note: This file is separate from server actions because "use server" files can only export async functions

export const WEEKLY_ANALYSIS_LIMIT = 100;

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
