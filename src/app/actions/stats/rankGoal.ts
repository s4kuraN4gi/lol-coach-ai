'use server'

import { createClient, getUser } from "@/utils/supabase/server";
import { logger } from "@/lib/logger";
import { TIER_ORDER, RANK_ORDER } from '@/lib/rankUtils';
import type { RankGoal } from "./types";

/**
 * Get rank goal for a summoner
 */
export async function getRankGoal(puuid: string): Promise<RankGoal | null> {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('summoner_accounts')
        .select('rank_goal, user_id')
        .eq('puuid', puuid)
        .single();

    if (error || !data?.rank_goal) {
        return null;
    }

    // Verify ownership
    if (data.user_id !== user.id) {
        return null;
    }

    return data.rank_goal as RankGoal;
}

/**
 * Set rank goal for a summoner
 */
export async function setRankGoal(puuid: string, tier: string, rank: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Verify ownership: puuid must belong to this user
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('user_id')
        .eq('puuid', puuid)
        .single();
    if (!account || account.user_id !== user.id) {
        return { success: false, error: 'Unauthorized' };
    }

    // Validate tier and rank
    if (!TIER_ORDER.includes(tier.toUpperCase())) {
        return { success: false, error: 'Invalid tier' };
    }

    // Master+ don't have rank divisions
    const tierIndex = TIER_ORDER.indexOf(tier.toUpperCase());
    if (tierIndex < 7 && !RANK_ORDER.includes(rank.toUpperCase())) {
        return { success: false, error: 'Invalid rank' };
    }

    const goal: RankGoal = {
        tier: tier.toUpperCase(),
        rank: tierIndex >= 7 ? 'I' : rank.toUpperCase(),
        setAt: new Date().toISOString()
    };

    const { error } = await supabase
        .from('summoner_accounts')
        .update({ rank_goal: goal })
        .eq('puuid', puuid);

    if (error) {
        logger.error('[RankGoal] Set error:', error);
        return { success: false, error: 'DB_ERROR' };
    }

    return { success: true };
}

/**
 * Clear rank goal for a summoner
 */
export async function clearRankGoal(puuid: string): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return { success: false };

    // Verify ownership: puuid must belong to this user
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('user_id')
        .eq('puuid', puuid)
        .single();
    if (!account || account.user_id !== user.id) {
        return { success: false };
    }

    const { error } = await supabase
        .from('summoner_accounts')
        .update({ rank_goal: null })
        .eq('puuid', puuid);

    if (error) {
        logger.error('[RankGoal] Clear error:', error);
        return { success: false };
    }

    return { success: true };
}
