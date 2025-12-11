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
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 3600 } })
        });
        
        if (!res.ok) {
            console.error(`Summoner API Error: ${res.status}`);
            return null;
        }
        
        return await res.json();
    } catch (e) {
        console.error("fetchSummonerByPuuid exception:", e);
        return null;
    }
}

// 3. Get League Entries (Rank) by SummonerID
export async function fetchRank(summonerId: string): Promise<LeagueEntryDTO[]> {
    if (!RIOT_API_KEY) return [];
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 600 } // Cache for 10 mins
        });
        
        if (!res.ok) {
            console.error(`League API Error: ${res.status}`);
            return [];
        }
        
        return await res.json();
    } catch (e) {
        console.error("fetchRank exception:", e);
        return [];
    }
}

// 4. Get Match IDs by PUUID
export async function fetchMatchIds(puuid: string, count: number = 20, queue?: number, type?: string): Promise<{ success: boolean, data?: string[], error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "Server Configuration Error: RIOT_API_KEY is missing" };
    
    // Ensure region is correct. JP1 -> asia
    let url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    
    if (queue) url += `&queue=${queue}`;
    if (type) url += `&type=${type}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });
        
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
