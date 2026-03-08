'use server'

import { logger } from "@/lib/logger";
import { RIOT_API_KEY, REGION_ROUTING } from "./constants";
import type { RiotAccount } from "./types";

// 1. Get Account by Riot ID (Name + Tag)
export async function fetchRiotAccount(gameName: string, tagLine: string): Promise<RiotAccount | null> {
    if (!RIOT_API_KEY) return null;

    // URL Encode
    const encodedName = encodeURIComponent(gameName);
    const encodedTag = encodeURIComponent(tagLine);

    const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!res.ok) {
            logger.error(`Riot Account API Error: ${res.status}`);
            return null;
        }

        return await res.json();
    } catch (e) {
        logger.error("fetchRiotAccount exception:", e);
        return null;
    }
}
