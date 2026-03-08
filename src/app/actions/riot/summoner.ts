'use server'

import { logger } from "@/lib/logger";
import { RIOT_API_KEY, PLATFORM_ROUTING } from "./constants";
import type { SummonerDTO } from "./types";

// 2. Get Summoner by PUUID
export async function fetchSummonerByPuuid(puuid: string, noCache = false): Promise<SummonerDTO | null> {
    if (!RIOT_API_KEY) return null;

    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            ...(noCache ? { cache: 'no-store' as const } : { next: { revalidate: 300 } })
        });

        if (!res.ok) {
            logger.error(`[RiotAPI] Summoner Error: ${res.status} ${res.statusText}`);
            const body = await res.text();
            logger.error(`[RiotAPI] Error Body: ${body}`);
            return null;
        }

        const data = await res.json();

        if (!data.id) {
             logger.error(`[RiotAPI] CRITICAL: Response missing 'id' field! Keys present: ${Object.keys(data)}`);
             data.id = data.puuid; // Hack: Try to use PUUID as ID
             data.name = data.name || "Summoner";
        }

        return data;
    } catch (e) {
        logger.error("fetchSummonerByPuuid exception:", e);
        return null;
    }
}
