'use server'

import { logger } from "@/lib/logger";
import { RIOT_API_KEY, PLATFORM_ROUTING } from "./constants";
import type { LeagueEntryDTO } from "./types";

// 3a. Get League Entries (Rank) by PUUID (Recommended - newer API)
export async function fetchRankByPuuid(puuid: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];

    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 300 } // 5 min cache - rank changes per game
        });

        if (!res.ok) {
            logger.error(`[RiotAPI] League by PUUID Error: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();
        return data;
    } catch (e) {
        logger.error("[RiotAPI] fetchRankByPuuid exception:", e);
        return [];
    }
}

// 3b. Get League Entries (Rank) by SummonerID (Legacy - may not work if ID unavailable)
export async function fetchRank(summonerId: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];

    // Fallback logic verification
    // PUUID is long (78 chars), SummonerID is short (40-63 chars usually, but rarely 78).
    // The by-summoner endpoint STRICTLY requires Encrypted Summoner ID.
    // If we only have PUUID (because fetchSummoner failed to give ID), we CANNOT fetch rank.
    // if (summonerId.length > 60) {
    //    logger.warn(`[RiotAPI] Cannot fetch rank with PUUID (length ${summonerId.length}). Returning Unranked.`);
    //    return [];
    // }

    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 300 } // 5 min cache - rank changes per game
        });

        if (!res.ok) {
            logger.error(`League API Error: ${res.status}`);
            return [];
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
            logger.warn(`[RiotAPI] fetchRank returned EMPTY for ID: ${summonerId}. URL: ${url}`);
        }
        return data;
    } catch (e) {
        logger.error("fetchRank exception:", e);
        return [];
    }
}
