'use server'

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData, fetchSummonerByPuuid } from "./riot";

export type ReplayData = {
    matchId: string;
    timeline: any;
    matchDetail: any;
    itemMap: any;
    championMap: any; // ID -> Name map for icon lookup
}

export async function getReplayData(matchId: string): Promise<{ success: boolean, data?: ReplayData, error?: string }> {
    const supabase = await createClient();
    
    try {
        // 1. Check Cache (DB)
        const { data: cached, error: cacheError } = await supabase
            .from('match_timelines')
            .select('timeline_json')
            .eq('match_id', matchId)
            .single();

        let timelineData = null;

        if (cached && cached.timeline_json) {
            console.log(`[Replay] Cache Hit for ${matchId}`);
            timelineData = cached.timeline_json;
        } else {
            console.log(`[Replay] Cache Miss for ${matchId}. Fetching from Riot...`);
            // 2. Fetch from Riot API
            const timelineRes = await fetchMatchTimeline(matchId);
            if (!timelineRes.success || !timelineRes.data) {
                return { success: false, error: timelineRes.error || "Failed to fetch timeline" };
            }
            timelineData = timelineRes.data;

            // 3. Save to Cache
            const { error: insertError } = await supabase
                .from('match_timelines')
                .insert({
                    match_id: matchId,
                    timeline_json: timelineData
                });
            
            if (insertError) {
                console.error("[Replay] Failed to cache timeline:", insertError);
            }
        }

        // 4. Fetch Match Detail (for champion & participant info)
        const detailRes = await fetchMatchDetail(matchId);
        if (!detailRes.success || !detailRes.data) {
             return { success: false, error: detailRes.error || "Failed to fetch match detail" };
        }

        // 5. Fetch DDragon Data (for Items/Champions)
        // Note: fetchMatchDetail result has champion names, but we might want icons or ID mapping.
        // Using existing utilities.
        const ddData = await fetchDDItemData(); // Returns idMap and nameMap for items.
        // For champions, we can use DDragon URL directly with championName from match detail.

        return {
            success: true,
            data: {
                matchId,
                timeline: timelineData,
                matchDetail: detailRes.data,
                itemMap: ddData?.idMap || {},
                championMap: {} // Not strictly needed if we use championName from Participants
            }
        };

    } catch (e: any) {
        console.error("getReplayData exception:", e);
        return { success: false, error: e.message };
    }
}
