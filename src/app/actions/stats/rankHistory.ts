'use server'

import { createClient, getUser } from "@/utils/supabase/server";
import type { LeagueEntryDTO } from "../riot";
import { logger } from "@/lib/logger";
import type { RankHistoryEntry } from "./types";

/**
 * Record current rank to history (called during performFullUpdate)
 * Uses UPSERT to avoid duplicates per day
 */
export async function recordRankHistory(puuid: string, ranks: LeagueEntryDTO[]): Promise<void> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check auth context for debugging
    const user = await getUser();

    for (const rank of ranks) {
        try {
            const payload = {
                puuid,
                queue_type: rank.queueType,
                tier: rank.tier,
                rank: rank.rank,
                league_points: rank.leaguePoints,
                wins: rank.wins,
                losses: rank.losses,
                recorded_at: today
            };


            const { data, error } = await supabase.from('rank_history').upsert(payload, {
                onConflict: 'puuid,queue_type,recorded_at'
            }).select();

            if (error) {
                logger.error(`[RankHistory] UPSERT FAILED for ${rank.queueType}:`, error.message, error.code, error.details);
            } else {
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const stack = e instanceof Error ? e.stack : undefined;
            logger.error(`[RankHistory] Exception:`, msg, stack);
        }
    }
}

/**
 * Fetch rank history for a given puuid and queue type
 * Returns last 30 days of data for graphing
 */
export async function fetchRankHistory(
    puuid: string,
    queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' = 'RANKED_SOLO_5x5',
    days: number = 30
): Promise<RankHistoryEntry[]> {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('rank_history')
        .select('*')
        .eq('puuid', puuid)
        .eq('queue_type', queueType)
        .gte('recorded_at', startDateStr)
        .order('recorded_at', { ascending: true });

    if (error) {
        logger.error(`[RankHistory] Fetch error:`, error.message);
        return [];
    }

    return data || [];
}
