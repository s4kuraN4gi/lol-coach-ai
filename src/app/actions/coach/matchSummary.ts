'use server';

import { createClient } from "@/utils/supabase/server";
import { puuidSchema, matchIdSchema } from '@/lib/validation';
import type { MatchSummary } from "./types";

export async function getMatchSummary(matchId: string, puuid: string): Promise<MatchSummary | null> {
    if (!matchIdSchema.safeParse(matchId).success || !puuidSchema.safeParse(puuid).success) return null;
    const supabase = await createClient();

    const { data: matchData } = await supabase
        .from('match_cache')
        .select('data, match_id')
        .eq('match_id', matchId)
        .single();

    if (!matchData) return null;

    const info = matchData.data.info;
    const participant = info.participants.find((p: { puuid: string; championName: string; win: boolean; kills: number; deaths: number; assists: number }) => p.puuid === puuid);
    if (!participant) return null;

    return {
        matchId: matchData.match_id,
        championName: participant.championName,
        win: participant.win,
        kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
        timestamp: info.gameStartTimestamp,
        queueId: info.queueId
    };
}

export async function getCoachMatches(puuid: string): Promise<MatchSummary[]> {
    if (!puuidSchema.safeParse(puuid).success) return [];
    const supabase = await createClient();

    // 1. Get Match IDs from Summoner Account
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('recent_match_ids')
        .eq('puuid', puuid)
        .single();

    if (!account?.recent_match_ids) return [];

    const matchIds = account.recent_match_ids as string[];
    if (matchIds.length === 0) return [];

    // 2. Fetch Match Details from Cache
    const { data: matchesData } = await supabase
        .from('match_cache')
        .select('data, match_id')
        .in('match_id', matchIds);

    if (!matchesData) return [];

    // 3. Process matches
    const summaries = matchesData.map(m => {
        const info = m.data.info;
        const participant = info.participants.find((p: { puuid: string; championName: string; win: boolean; kills: number; deaths: number; assists: number }) => p.puuid === puuid);
        if (!participant) return null;

        return {
             matchId: m.match_id,
             championName: participant.championName,
             win: participant.win,
             kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
             timestamp: info.gameStartTimestamp,
             queueId: info.queueId
        };
    }).filter((s): s is MatchSummary => s !== null);

    return summaries.sort((a, b) => b.timestamp - a.timestamp);
}
