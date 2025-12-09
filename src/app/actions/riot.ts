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
export async function fetchSummonerByPuuid(puuid: string): Promise<SummonerDTO | null> {
    if (!RIOT_API_KEY) return null;
    
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 3600 }
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
export async function fetchMatchIds(puuid: string, count: number = 20): Promise<string[]> {
    if (!RIOT_API_KEY) return [];
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 300 } // 5 mins
        });
        
        if (!res.ok) {
           console.error(`MatchIDs API Error: ${res.status}`);
           return [];
        }
        
        return await res.json();
    } catch (e) {
        console.error("fetchMatchIds exception:", e);
        return [];
    }
}

// 5. Get Match Details by MatchID
export async function fetchMatchDetail(matchId: string): Promise<any> {
    if (!RIOT_API_KEY) return null;
    
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    
    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            // Matches are immutable, so cache forever (or very long)
            next: { revalidate: 86400 * 7 } 
        });
        
        if (!res.ok) return null;
        
        return await res.json();
    } catch (e) {
        console.error("fetchMatchDetail exception:", e);
        return null;
    }
}
