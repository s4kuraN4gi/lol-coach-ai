'use server'

import { createClient, getUser } from "@/utils/supabase/server";
import type { LeagueEntryDTO } from "../riot";
import { logger } from "@/lib/logger";
import { revalidatePath } from 'next/cache';
import { recordRankHistory } from "./rankHistory";

/**
 * C. Update (Action) - Heavy
 */
export async function performFullUpdate(puuid: string) {
    const { fetchAndCacheMatches } = await import('@/services/matchService');
    const supabase = await createClient();


    // 1. Sync Matches (Fetch 50 new ones)
    let matchIds: string[] = [];
    try {
        const { matches } = await fetchAndCacheMatches(puuid, 50);
        matchIds = matches.map(m => m.metadata.matchId);
    } catch (e) {
        logger.error(`[Action] Match Fetch Error:`, e);
    }

    let ranks: LeagueEntryDTO[] = [];
    let oldIds: string[] = [];
    let targetSummonerId = "";
    let targetAccountId = "";
    let summonerLevel: number | null = null;
    let profileIconId: number | null = null;

    try {
        const authUser = await getUser();
        const { data: account } = await supabase.from('summoner_accounts').select('id, user_id, summoner_id, recent_match_ids, summoner_name, tag_line').eq('puuid', puuid).single();

        targetAccountId = account?.id;
        // Initialize targetSummonerId from DB, but allow overwriting by fallback
        if (account?.summoner_id) {
            targetSummonerId = account.summoner_id;
        }


        // DEEP REPAIR: if missing ID or potential old-key ID, try Account-V1 refresh
        // Note: For now we trigger this if ID is missing OR user manually requests refresh (which calls this fn)
        // If the ID length is < 70 (SummonerID) but fetchRank returns [], it might be an Old Key ID.
        // We will attempt to refresh Account Data if we have Name/Tag.
        if (account?.summoner_name && account?.tag_line) {
             try {
                const { fetchRiotAccount, fetchSummonerByPuuid } = await import('@/app/actions/riot');

                const riotAcc = await fetchRiotAccount(account.summoner_name, account.tag_line);
                if (riotAcc && riotAcc.puuid) {

                    // Fetch Summoner (Fresh)
                    const summoner = await fetchSummonerByPuuid(riotAcc.puuid);
                    if (summoner && summoner.id) {
                         targetSummonerId = summoner.id;
                         // Update PUUID in case it changed (rare but possible)
                         // Actually avoiding puuid update as it breaks relation? No, puuid is just a column.
                    }
                }
             } catch (repairErr) {
                 logger.error(`[Action] Deep Repair Failed:`, repairErr);
             }
        }

        oldIds = (account?.recent_match_ids as string[]) || [];

        // Fetch rank using PUUID directly (newer API, more reliable)
        try {
            const { fetchRankByPuuid } = await import('@/app/actions/riot');
            ranks = await fetchRankByPuuid(puuid);
        } catch (rankErr) {
            logger.error(`[Action] Rank Fetch Error (Non-fatal):`, rankErr);
        }

        // Fetch summoner data for level and icon update
        try {
            const { fetchSummonerByPuuid } = await import('@/app/actions/riot');
            const summonerData = await fetchSummonerByPuuid(puuid);
            if (summonerData) {
                summonerLevel = summonerData.summonerLevel ?? null;
                profileIconId = summonerData.profileIconId ?? null;
            }
        } catch (summonerErr) {
            logger.error(`[Action] Summoner Fetch Error (Non-fatal):`, summonerErr);
        }
    } catch (dbReadErr) {
        logger.error(`[Action] DB Read Error:`, dbReadErr);
    }

    // Merge new IDs ...
    const mergedIds = Array.from(new Set([...matchIds, ...oldIds])).slice(0, 100);

    // Record rank history for graphing (await to ensure it's saved before returning)
    if (ranks.length > 0) {
        try {
            await recordRankHistory(puuid, ranks);
        } catch (e) {
            logger.error('[Action] recordRankHistory failed:', e);
        }
    }

    // 3. Save to DB
    const updatePayload: Record<string, unknown> = {
        rank_info: ranks,
        recent_match_ids: mergedIds,
        last_updated_at: new Date().toISOString()
    };

    if (targetSummonerId) {
        updatePayload.summoner_id = targetSummonerId;
    }

    if (summonerLevel !== null) {
        updatePayload.summoner_level = summonerLevel;
    }

    if (profileIconId !== null) {
        updatePayload.profile_icon_id = profileIconId;
    }


    // Update by Primary Key (id)
    if (!targetAccountId) {
         logger.error("[Action] Account ID not found in initial fetch, cannot update.");
         throw new Error("Account ID missing");
    }

    const { data: updatedData, error: updateError, count } = await supabase.from('summoner_accounts')
    .update(updatePayload)
    .eq('id', targetAccountId)
    .select('id, summoner_id, rank_info');

    if (updateError) {
        logger.error(`[Action] DB Update Failed:`, updateError);
        throw new Error(`DB Update Failed: ${updateError.message}`);
    } else {
        const numRows = updatedData?.length ?? 0;

        if (numRows === 0) {
            logger.error(`[Action] CRITICAL: Update returned 0 rows! RLS or ID mismatch prevented write.`);
            logger.error(`[Action] Target Account PK: ${targetAccountId}`);
        } else {
        }
    }

    revalidatePath('/dashboard');
    return { success: true };
}
