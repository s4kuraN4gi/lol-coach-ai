'use server'

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = "asia"; // Account V1, Match V5 (Asia/Sea)
const PLATFORM_ROUTING = "jp1"; // Summoner V4, League V4 (Japan)

// Types
export type RiotAccount = {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export type SummonerDTO = {
    accountId: string;
    profileIconId: number;
    revisionDate: number;
    name: string;
    id: string; // SummonerID
    puuid: string;
    summonerLevel: number;
}

export type LeagueEntryDTO = {
    leagueId: string;
    queueType: string;
    tier: string;
    rank: string;
    summonerId: string;
    summonerName: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    hotStreak: boolean;
    veteran: boolean;
    freshBlood: boolean;
    inactive: boolean;
}

// 1. Get Account by Riot ID (Name + Tag)
export async function fetchRiotAccount(gameName: string, tagLine: string): Promise<RiotAccount | null> {
    if (!RIOT_API_KEY) return null;
    
    // URL Encode
    const encodedName = encodeURIComponent(gameName);
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${tagLine}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        if (!res.ok) {
            console.error(`Riot Account API Error: ${res.status}`);
            return null;
        }
        
        return await res.json();
    } catch (e) {
        console.error("fetchRiotAccount exception:", e);
        return null;
    }
}

// 2. Get Summoner by PUUID
export async function fetchSummonerByPuuid(puuid: string, noCache = false): Promise<SummonerDTO | null> {
    if (!RIOT_API_KEY) return null;
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?t=${Date.now()}`;
    
    try {
        console.log(`[RiotAPI] Fetching Summoner (Cache-Bust): ${url}`);
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            console.error(`[RiotAPI] Summoner Error: ${res.status} ${res.statusText}`);
            const body = await res.text();
            console.error(`[RiotAPI] Error Body: ${body}`);
            return null;
        }
        
        const data = await res.json();
        console.log(`[RiotAPI] Raw Keys: ${Object.keys(data).join(", ")}`);
        console.log(`[RiotAPI] Summoner Data: ${JSON.stringify(data)}`);

        if (!data.id) {
             console.error(`[RiotAPI] CRITICAL: Response missing 'id' field! Keys present: ${Object.keys(data)}`);
             data.id = data.puuid; // Hack: Try to use PUUID as ID
             data.name = data.name || "Summoner";
        }

        return data;
    } catch (e) {
        console.error("fetchSummonerByPuuid exception:", e);
        return null;
    }
}

// 3. Get League Entries (Rank) by SummonerID
export async function fetchRank(summonerId: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];
    
    // Fallback logic verification
    // PUUID is long (78 chars), SummonerID is short (40-63 chars usually, but rarely 78).
    // The by-summoner endpoint STRICTLY requires Encrypted Summoner ID.
    // If we only have PUUID (because fetchSummoner failed to give ID), we CANNOT fetch rank.
    // if (summonerId.length > 60) {
    //    console.warn(`[RiotAPI] Cannot fetch rank with PUUID (length ${summonerId.length}). Returning Unranked.`);
    //    return [];
    // }
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    console.log(`[RiotAPI] Fetching Rank: ${url}`);
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            console.error(`League API Error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
            console.warn(`[RiotAPI] fetchRank returned EMPTY for ID: ${summonerId}. URL: ${url}`);
        }
        return data;
    } catch (e) {
        console.error("fetchRank exception:", e);
        return [];
    }
}

// 4. Get Match IDs by PUUID
export async function fetchMatchIds(puuid: string, count: number = 20, queue?: number, type?: string, championId?: number, retries = 3): Promise<{ success: boolean, data?: string[], error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "Server Configuration Error: RIOT_API_KEY is missing" };
    
    // Ensure region is correct. JP1 -> asia
    let url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    
    if (queue) url += `&queue=${queue}`;
    if (type) url += `&type=${type}`;
    if (championId) url += `&champion=${championId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            console.log(`[RiotAPI] MatchIDs 429 Hit. Waiting ${retryAfter}s...`);
            await delay((retryAfter + 1) * 1000); // Wait +1s buffer
            return fetchMatchIds(puuid, count, queue, type, championId, retries - 1);
        }
        
        if (!res.ok) {
            const body = await res.text();
            console.error(`MatchIDs API Error (${res.status}) URL: ${url} Body: ${body}`);
            return { success: false, error: `Riot API Error (${res.status}): ${res.statusText}` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchIds exception:", e);
        return { success: false, error: e.message || "Unknown Network Error" };
    }
}

// 5. Get Match Details by MatchID
// Helper delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchMatchDetail(matchId: string, retries = 3): Promise<{ success: boolean, data?: any, error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            console.log(`[RiotAPI] 429 Hit. Waiting ${retryAfter}s...`);
            await delay((retryAfter + 1) * 1000); // Wait +1s buffer
            return fetchMatchDetail(matchId, retries - 1);
        }
        
        if (!res.ok) {
            console.error(`MatchDetail Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Detail Error (${res.status})` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchDetail exception:", e);
        return { success: false, error: e.message };
    }
}
// 6. Get Match Timeline by MatchID
export async function fetchMatchTimeline(matchId: string): Promise<{ success: boolean, data?: any, error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };
    
    // Timeline endpoint: /lol/match/v5/matches/{matchId}/timeline
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 86400 } // Cache for 24 hours (Immutable data)
        });
        
        if (!res.ok) {
            console.error(`MatchTimeline Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Timeline Error (${res.status})` };
        }
        
        const data = await res.json();
        return { success: true, data };
    } catch (e: any) {
        console.error("fetchMatchTimeline exception:", e);
        return { success: false, error: e.message };
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
            console.error(`ThirdPartyCode API Error: ${res.status}`);
            return null;
        }
        
        // The API returns the code string directly in quotes, e.g. "LCA-1234"
        const code = await res.json();
        return code;
    } catch (e) {
        console.error("fetchThirdPartyCode exception:", e);
        return null;
    }
}

// 8. Get Latest Version
export async function fetchLatestVersion(): Promise<string> {
    try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { next: { revalidate: 3600 } });
        if (!res.ok) return "14.24.1"; // Fallback
        const versions = await res.json();
        return versions[0] || "14.24.1";
    } catch (e) {
        console.error("fetchLatestVersion error:", e);
        return "14.24.1";
    }
}

// 9. Get DDragon Item Data (Cached)
let _itemCache: Record<string, any> | null = null;
let _itemNameCache: Record<string, string> | null = null; // Name -> ID

export async function fetchDDItemData(): Promise<{ idMap: Record<string, any>, nameMap: Record<string, string> } | null> {
    if (_itemCache && _itemNameCache) return { idMap: _itemCache, nameMap: _itemNameCache };

    // Fetch latest version dynamically
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/item.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const data = await res.json();
        _itemCache = data.data;
        
        _itemNameCache = {};
        // Build Name -> ID Map (Normalize names to lower case for loose matching)
        for (const [id, item] of Object.entries(data.data as Record<string, any>)) {
            _itemNameCache[item.name.toLowerCase()] = id;
            // Also map colloquials if we want later
        }

        return { idMap: _itemCache!, nameMap: _itemNameCache! };
    } catch (e) {
        console.error("fetchDDItemData error:", e);
        return null;
    }
}
