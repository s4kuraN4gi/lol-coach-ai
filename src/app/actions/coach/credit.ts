'use server';

import { createClient, getUser } from "@/utils/supabase/server";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from '../constants';
import { logger } from "@/lib/logger";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export type CreditCheckResult = {
    success: true;
    userId: string;
    apiKeyToUse: string;
    debited: boolean;
    supabase: Awaited<ReturnType<typeof createClient>>;
} | {
    success: false;
    error: string;
};

/**
 * Handles authentication, credit check, and debit for coach analysis.
 * Returns the API key to use and whether credit was debited.
 */
export async function checkAndDebitCredit(
    userApiKey: string | undefined,
    skipCreditCheck: boolean
): Promise<CreditCheckResult> {
    const supabase = await createClient();
    const user = await getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    let debited = false;
    let apiKeyToUse: string | undefined;

    if (skipCreditCheck) {
        apiKeyToUse = userApiKey || GEMINI_API_KEY_ENV;
    } else {
        const { refreshAnalysisStatus } = await import("../analysis");
        const status = await refreshAnalysisStatus(user.id);
        if (!status) return { success: false, error: "User profile not found." };

        let useEnvKey = false;
        let shouldIncrementCount = false;

        const weeklyCount = status.weekly_analysis_count || 0;

        if (status.is_premium) {
            if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
                return { success: false, error: "WEEKLY_LIMIT_REACHED" };
            }
            useEnvKey = true;
            shouldIncrementCount = true;
        } else {
            if (userApiKey) {
                return { success: false, error: "CUSTOM_KEY_PREMIUM_ONLY" };
            }
            if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
                return { success: false, error: "FREE_WEEKLY_LIMIT_REACHED" };
            }
            useEnvKey = true;
            shouldIncrementCount = true;
        }

        apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;

        // DEBIT-FIRST: Consume count BEFORE AI call
        if (shouldIncrementCount) {
            const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
            await supabase.rpc('increment_weekly_count', { p_user_id: user.id, p_limit: limit });
            debited = true;
        }
    }

    if (!apiKeyToUse) {
        return { success: false, error: "API Key Not Found" };
    }

    return { success: true, userId: user.id, apiKeyToUse, debited, supabase };
}

/** Refund a debited credit on failure */
export async function refundCredit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    try {
        const { error: refundErr } = await supabase.rpc('decrement_weekly_count', { p_user_id: userId });
        if (refundErr) logger.error("Weekly count refund failed:", refundErr);
    } catch (refundErr) {
        logger.error("Weekly count refund failed:", refundErr);
    }
}
