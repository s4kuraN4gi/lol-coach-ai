'use server'

import { logger } from "@/lib/logger";
import { RIOT_API_KEY, REGION_ROUTING, PLATFORM_ROUTING } from "./constants";
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

// 7. Get Third Party Code by SummonerID
export async function fetchThirdPartyCode(summonerId: string): Promise<string | null> {
    if (!RIOT_API_KEY) return null;

    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/platform/v4/third-party-code/by-summoner/${summonerId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store' // Verification code changes, so no cache
        });

        if (!res.ok) {
            logger.error(`ThirdPartyCode API Error: ${res.status}`);
            return null;
        }

        // The API returns the code string directly in quotes, e.g. "LCA-1234"
        const code = await res.json();
        return code;
    } catch (e) {
        logger.error("fetchThirdPartyCode exception:", e);
        return null;
    }
}
