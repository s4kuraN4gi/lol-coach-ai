'use server'

import { createClient } from "@/utils/supabase/server";
import { fetchRank, fetchSummonerByPuuid, type LeagueEntryDTO, fetchMatchIds } from "./riot";

export type ChampionStat = {
    name: string;
    games: number;
    wins: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgCs: number;
    winRate: number;
    avgKda: string;
}


export type RadarStats = {
    combat: number;
    objective: number;
    vision: number;
    farming: number;
    survival: number;
}

export type UniqueStats = {
    winConditions: { label: string, winRate: number, count: number }[];
    nemesis: { name: string, wins: number, games: number, winRate: number }[];
    prey: { name: string, wins: number, games: number, winRate: number }[];
    survival: { csAdvantage: number, csAt10: number };
    clutch: { closeWr: number, stompWr: number, closeGames: number, stompGames: number };
}


export type DashboardStatsDTO = {
    ranks: LeagueEntryDTO[];
    recentMatches: {
        win: boolean;
        timestamp: number;
    }[]; // For LP Widget Trend
    championStats: ChampionStat[]; // For Champion Card
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
    debugLog: string[];
}

// Rate limit safe fetcher
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- Split Actions for Progressive Loading ---

export type BasicStatsDTO = {
    ranks: LeagueEntryDTO[];
    debugLog: string[];
}

export async function fetchBasicStats(puuid: string, summonerId?: string | null, gameName?: string | null, tagLine?: string | null): Promise<BasicStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };
    
    try {
        // 0. Self-Heal: Recover SummonerID if missing
        let validSummonerId = summonerId;
        
        // Helper to check validity
        const isValid = (id?: string | null) => id && id.length > 5;

        if (!isValid(validSummonerId)) {
             const { fetchSummonerByPuuid, fetchRiotAccount } = await import('./riot');
             log(`[BasicStats] SummonerID missing. Fetching by PUUID...`);
             
             let summonerData = await fetchSummonerByPuuid(puuid);
             
             // Check if data is valid (has ID)
             if (!summonerData || !summonerData.id) {
                 log(`[BasicStats] PUUID Fetch failed/bad data. Trying Riot ID Recovery...`);
                 if (gameName && tagLine) {
                     const riotAccount = await fetchRiotAccount(gameName, tagLine);
                     if (riotAccount && riotAccount.puuid) {
                         log(`[BasicStats] Recovered fresh PUUID: ${riotAccount.puuid.slice(0,10)}...`);
                         // Retry Summoner Fetch with NEW PUUID
                         summonerData = await fetchSummonerByPuuid(riotAccount.puuid);
                     } else {
                         log(`[BasicStats] Riot ID Lookup failed.`);
                     }
                 } else {
                     log(`[BasicStats] No Name/Tag provided for recovery.`);
                 }
             }

             if (summonerData && summonerData.id) {
                 validSummonerId = summonerData.id;
                 log(`[BasicStats] Recovered SummonerID: ${validSummonerId}`);
             } else {
                 throw new Error("Failed to recover SummonerID. API Key may be invalid or Account not found.");
             }
        }
        
        // Ensure validSummonerId is a string for fetchRank
        if (!validSummonerId) {
             throw new Error("Critical: validSummonerId is undefined after recovery attempt.");
        }

        // 1. Fetch Rank
        let ranks = await fetchRank(validSummonerId);

        // Self-heal: If NO ranks found, SummonerID might be stale. Re-fetch ID from Riot.
        if (ranks.length === 0) {
             const { fetchSummonerByPuuid } = await import('./riot');
             log(`[BasicStats] No ranks found. Verifying SummonerID...`);
             const freshSummoner = await fetchSummonerByPuuid(puuid, true); // noCache=true
             
             if (freshSummoner && freshSummoner.id !== validSummonerId) {
                 log(`[BasicStats] SummonerID mismatch! Updating to: ${freshSummoner.id}`);
                 validSummonerId = freshSummoner.id;
                 ranks = await fetchRank(validSummonerId);
                 log(`[BasicStats] Retry Rank Fetch found: ${ranks.length}`);
             } else {
                 log(`[BasicStats] SummonerID is valid (unchanged). User is likely truly Unranked.`);
             }
        }

        log(`[BasicStats] Ranks fetched: ${ranks.length}`);
        return { ranks, debugLog: logs };

    } catch (e: any) {
        const errorMsg = `[BasicStats] Critical Error: ${e.message || e}`;
        console.error("fetchBasicStats Error:", errorMsg);
        logs.push(errorMsg);
        return { ranks: [], debugLog: logs };
    }
}

export type MatchStatsDTO = {
    recentMatches: { win: boolean; timestamp: number }[];
    championStats: ChampionStat[];
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
    debugLog: string[];
}

// --- Cache-First Architecture ---

import { revalidatePath } from 'next/cache';


/**
 * A. Read (DB Cache Only) - Fast
 */
export async function getStatsFromCache(puuid: string): Promise<MatchStatsDTO & BasicStatsDTO> {
    const supabase = await createClient();
    const logs: string[] = [];

    // 1. Fetch from DB (Account + Ranks + MatchIDs)
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('*')
        .eq('puuid', puuid)
        .single();
    
    if (account) {
        console.log(`[Cache] Rank Info from DB: ${JSON.stringify(account.rank_info)}`);
    } else {
        console.log(`[Cache] Account not found for PUUID: ${puuid}`);
    }
    
    // Default Empty State
    const result: MatchStatsDTO & BasicStatsDTO = {
        ranks: [],
        debugLog: logs,
        recentMatches: [],
        championStats: [],
        radarStats: null,
        uniqueStats: null
    };

    if (account) {
        if (account.rank_info) {
             result.ranks = account.rank_info as LeagueEntryDTO[];
        }
        
        // 2. Fetch Matches from Cache using stored IDs
        if (account.recent_match_ids && Array.isArray(account.recent_match_ids)) {
             const limit = 50; 
             const targetIds = (account.recent_match_ids as string[]).slice(0, limit);
             console.log(`[Cache] Account has ${account.recent_match_ids.length} IDs. Fetching top ${targetIds.length}...`);
             
             if (targetIds.length > 0) {
                 const { getCachedMatchesByIds } = await import('@/services/matchService');
                 const cachedMatches = await getCachedMatchesByIds(targetIds);
                 console.log(`[Cache] Retrieved ${cachedMatches.length} matches from DB.`);
                 
                 // Process these matches
                 // FIX: cachedMatches are { metadata, info }, but processMatchStats expects info objects
                 const validMatchesInfo = cachedMatches.map((m: any) => m.info || m);
                 
                 const final = processMatchStats(validMatchesInfo, puuid, result);
                 console.log(`[Cache] Processed Matches: ${final.recentMatches.length} (Filtered from ${cachedMatches.length})`);
                 return final;
             }
        } else {
             console.log(`[Cache] Account has NO recent_match_ids.`);
        }
    } else {
        console.log(`[Cache] Account NOT found for PUUID: ${puuid}`);
    }
    
    return result;
}

/**
 * B. Check (Background) - Lightweight
 */
export async function checkForUpdates(puuid: string): Promise<{ hasUpdates: boolean, newGameCount: number }> {
    const supabase = await createClient();

    // 1. Get latest match ID from DB
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('recent_match_ids')
        .eq('puuid', puuid)
        .single();
        
    const storedIds = new Set((account?.recent_match_ids as string[]) || []);

    // 2. Fetch Recent IDs from Riot (Fast) - Check last 10
    const recentRes = await fetchMatchIds(puuid, 10);
    
    if (!recentRes.success || !recentRes.data) return { hasUpdates: false, newGameCount: 0 };
    
    const newCount = recentRes.data.filter(id => !storedIds.has(id)).length;
    
    return { hasUpdates: newCount > 0, newGameCount: newCount };
}

/**
 * C. Update (Action) - Heavy
 */
export async function performFullUpdate(puuid: string) {
    const { fetchAndCacheMatches } = await import('@/services/matchService');
    const supabase = await createClient();
    
    console.log(`[Action] performFullUpdate started for ${puuid.slice(0, 8)}...`);

    // 1. Sync Matches (Fetch 50 new ones)
    let matchIds: string[] = [];
    try {
        const { matches } = await fetchAndCacheMatches(puuid, 50);
        matchIds = matches.map(m => m.metadata.matchId);
        console.log(`[Action] Fetched ${matchIds.length} matches`);
    } catch (e: any) {
        console.error(`[Action] Match Fetch Error:`, e);
    }
    
    let ranks: LeagueEntryDTO[] = [];
    let oldIds: string[] = [];
    let targetSummonerId = "";
    let targetAccountId = "";
    
    try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { data: account } = await supabase.from('summoner_accounts').select('id, user_id, summoner_id, recent_match_ids, summoner_name, tag_line').eq('puuid', puuid).single();
        
        targetAccountId = account?.id;
        // Initialize targetSummonerId from DB, but allow overwriting by fallback
        if (account?.summoner_id) {
            targetSummonerId = account.summoner_id;
        }
        
        console.log(`[Action] Auth Check - AuthID: ${authUser?.id} | DB_UserID: ${account?.user_id} | AccountPK: ${account?.id}`);
        
        // DEEP REPAIR: if missing ID or potential old-key ID, try Account-V1 refresh
        // Note: For now we trigger this if ID is missing OR user manually requests refresh (which calls this fn)
        // If the ID length is < 70 (SummonerID) but fetchRank returns [], it might be an Old Key ID.
        // We will attempt to refresh Account Data if we have Name/Tag.
        if (account?.summoner_name && account?.tag_line) {
             try {
                const { fetchRiotAccount, fetchSummonerByPuuid } = await import('@/app/actions/riot');
                console.log(`[Action] Deep Repair: Refining ID for ${account.summoner_name}#${account.tag_line}`);
                
                const riotAcc = await fetchRiotAccount(account.summoner_name, account.tag_line);
                if (riotAcc && riotAcc.puuid) {
                    console.log(`[Action] Account V1 PUUID: ${riotAcc.puuid}`);
                    
                    // Fetch Summoner (Fresh)
                    const summoner = await fetchSummonerByPuuid(riotAcc.puuid);
                    if (summoner && summoner.id) {
                         console.log(`[Action] Deep Repair Success! New ID: ${summoner.id}`);
                         targetSummonerId = summoner.id;
                         // Update PUUID in case it changed (rare but possible)
                         // Actually avoiding puuid update as it breaks relation? No, puuid is just a column.
                    }
                }
             } catch (repairErr) {
                 console.error(`[Action] Deep Repair Failed:`, repairErr);
             }
        }
        
        oldIds = (account?.recent_match_ids as string[]) || [];

        // ... (rest of logic) ...

        if (targetSummonerId) {
             console.log(`[Trace] 4. Before Rank Fetch - ID: ${targetSummonerId}`);
             try {
                // Check if ID is suspicious (e.g. PUUID length)
                console.log(`[Action] Fetching Rank for ID: ${targetSummonerId} (Length: ${targetSummonerId.length})`);
                
                if (targetSummonerId.length > 70) {
                    console.warn(`[Action] WARNING: Resolved ID is length ${targetSummonerId.length}. This looks like a PUUID, not a SummonerID!`);
                }
                
                ranks = await fetchRank(targetSummonerId);
                console.log(`[Action] Rank Result (Raw): ${JSON.stringify(ranks)}`);
             } catch (rankErr) {
                console.error(`[Action] Rank Fetch Error (Non-fatal):`, rankErr);
             }
        } else {
             console.log(`[Trace] 4. Before Rank Fetch - ID IS EMPTY (Skipping)`);
        }
    } catch (dbReadErr) {
        console.error(`[Action] DB Read Error:`, dbReadErr);
    }
    
    // Merge new IDs ...
    const mergedIds = Array.from(new Set([...matchIds, ...oldIds])).slice(0, 100);

    // 3. Save to DB
    const updatePayload: any = { 
        rank_info: ranks,
        recent_match_ids: mergedIds,
        last_updated_at: new Date().toISOString()
    };
    
    if (targetSummonerId) {
        updatePayload.summoner_id = targetSummonerId;
    }
    
    console.log(`[Action] DB Update Payload: ${JSON.stringify(updatePayload, null, 2)}`);

    // Update by Primary Key (id)
    if (!targetAccountId) {
         console.error("[Action] Account ID not found in initial fetch, cannot update.");
         throw new Error("Account ID missing");
    }

    const { data: updatedData, error: updateError, count } = await supabase.from('summoner_accounts')
    .update(updatePayload)
    .eq('id', targetAccountId) 
    .select('id, summoner_id, rank_info');

    if (updateError) {
        console.error(`[Action] DB Update Failed:`, updateError);
        throw new Error(`DB Update Failed: ${updateError.message}`);
    } else {
        const numRows = updatedData?.length ?? 0;
        console.log(`[Action] DB Update Success. Saved ${mergedIds.length} IDs. Rows Returned: ${numRows} (Count: ${count})`);
        
        if (numRows === 0) {
            console.error(`[Action] CRITICAL: Update returned 0 rows! RLS or ID mismatch prevented write.`);
            console.error(`[Action] Target Account PK: ${targetAccountId}`);
        } else {
            console.log(`[Action] Update Verification: ID=${updatedData[0].summoner_id}, Rank=${JSON.stringify(updatedData[0].rank_info)}`);
        }
    }

    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Deprecated / Compatible: Online Fetch
 * If offlineOnly is true, it redirects to cache.
 */
export async function fetchMatchStats(puuid: string, offlineOnly: boolean = false): Promise<MatchStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };
    
    if (offlineOnly) {
        const stats = await getStatsFromCache(puuid);
        const { ranks, ...matchStats } = stats;
        return matchStats;
    }

    try {
        const { fetchAndCacheMatches } = await import('@/services/matchService');
        const { matches, logs: serviceLogs } = await fetchAndCacheMatches(puuid, 50);
        serviceLogs.forEach(l => log(l));
        
        const baseResult: MatchStatsDTO & BasicStatsDTO = { ranks: [], debugLog: logs, recentMatches: [], championStats: [], radarStats: null, uniqueStats: null };
        const result = processMatchStats(matches.map(m=>m.info), puuid, baseResult);
        const { ranks, ...finalMatchStats } = result;
        return finalMatchStats;
    } catch (e: any) {
        console.error("fetchMatchStats error", e);
        return { recentMatches: [], championStats: [], radarStats: null, uniqueStats: null, debugLog: [e.message] };
    }
}

// Internal Helper to process matches into stats
function processMatchStats(matches: any[], puuid: string, initialResult: MatchStatsDTO & BasicStatsDTO): MatchStatsDTO & BasicStatsDTO {
    const result = { ...initialResult }; // Copy
    const championMap = new Map<string, { wins: number, games: number, k: number, d: number, a: number, cs: number }>();
    
    let totalK = 0, totalD = 0, totalA = 0;
    let totalDmgObj = 0, totalVision = 0, totalCS = 0, totalDuration = 0, gameCount = 0;
    
    // Unique Stats Trackers
    const winCondTracker = { firstBlood: { wins: 0, total: 0 }, firstTower: { wins: 0, total: 0 }, soloKill: { wins: 0, total: 0 } };
    const opponentMap = new Map<string, { wins: number, total: number }>();
    let soloDeathCount = 0, totalCsAt10 = 0, totalMaxCsAdv = 0;
    let closeWins = 0, closeTotal = 0, stompWins = 0, stompTotal = 0;

    // Filter & Sort
    const validMatches = matches.filter(m => m.gameMode === 'CLASSIC');
    validMatches.sort((a, b) => b.gameCreation - a.gameCreation);

    validMatches.forEach(info => {
        const p = info.participants.find((p: any) => p.puuid === puuid);
        if (!p) return;

        // Recent Matches
        result.recentMatches.push({ win: p.win, timestamp: info.gameCreation });

        // Champion Stats
        const champ = p.championName;
        const current = championMap.get(champ) || { wins: 0, games: 0, k: 0, d: 0, a: 0, cs: 0 };
        current.games++;
        if (p.win) current.wins++;
        current.k += p.kills; current.d += p.deaths; current.a += p.assists;
        current.cs += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        championMap.set(champ, current);

        // Radar
        const durationMin = (info.gameDuration || 1) / 60;
        totalDuration += durationMin;
        gameCount++;
        totalK += p.kills; totalD += p.deaths; totalA += p.assists;
        totalDmgObj += p.damageDealtToObjectives || 0;
        totalVision += p.visionScore || 0;
        totalCS += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);

        // Unique
        if (p.firstBloodKill) { winCondTracker.firstBlood.total++; if (p.win) winCondTracker.firstBlood.wins++; }
        if (p.firstTowerKill) { winCondTracker.firstTower.total++; if (p.win) winCondTracker.firstTower.wins++; }
        if (p.challenges?.soloKills > 0) { winCondTracker.soloKill.total++; if (p.win) winCondTracker.soloKill.wins++; }

        const enemy = info.participants.find((ep: any) => ep.teamId !== p.teamId && ep.teamPosition === p.teamPosition);
        if (enemy && p.teamPosition !== 'UTILITY' && p.teamPosition !== 'JUNGLE') { 
            const ename = enemy.championName;
            const ecurr = opponentMap.get(ename) || { wins: 0, total: 0 };
            ecurr.total++; if (p.win) ecurr.wins++;
            opponentMap.set(ename, ecurr);
        }

        if (p.challenges?.soloKillsTaken > 0) {
            soloDeathCount++;
        }
        
        // DEBUG: Logging first 3 matches to check data availability
        if (gameCount <= 3) {
             console.log(`[StatsDebug] GameID ${info.gameId} | Mode: ${info.gameMode} | SoloTaken: ${p.challenges?.soloKillsTaken} | HasChallenges: ${!!p.challenges}`);
        }

        totalCsAt10 += ((p.challenges?.laneMinionsFirst10Minutes || 0) + (p.challenges?.jungleCsBefore10Minutes || 0));
        totalMaxCsAdv += (p.challenges?.maxCsAdvantageOnLaneOpponent || 0);

        const myTeamGold = info.participants.filter((pt: any) => pt.teamId === p.teamId).reduce((acc: number, c: any) => acc + (c.goldEarned || 0), 0);
        const enemyTeamGold = info.participants.filter((pt: any) => pt.teamId !== p.teamId).reduce((acc: number, c: any) => acc + (c.goldEarned || 0), 0);
        const diff = Math.abs(myTeamGold - enemyTeamGold);
        if (diff < 5000) { closeTotal++; if (p.win) closeWins++; }
        else if (diff > 10000) { stompTotal++; if (p.win) stompWins++; }
    });

    // Formatting
    result.championStats = Array.from(championMap.entries()).map(([name, data]) => ({
        name, games: data.games, wins: data.wins,
        avgKills: parseFloat((data.k/data.games).toFixed(1)),
        avgDeaths: parseFloat((data.d/data.games).toFixed(1)),
        avgAssists: parseFloat((data.a/data.games).toFixed(1)),
        avgCs: parseFloat((data.cs/data.games).toFixed(1)),
        winRate: Math.round((data.wins/data.games)*100),
        avgKda: ((data.k+data.a)/Math.max(1, data.d)).toFixed(2)
    })).sort((a,b)=>b.games-a.games);

    if (gameCount > 0) {
        result.radarStats = {
            combat: Math.min(100, Math.round(((totalK+totalA)/Math.max(1, totalD))*20)),
            objective: Math.min(100, Math.round(((totalDmgObj/gameCount)/15000)*100)),
            vision: Math.min(100, Math.round(((totalVision/totalDuration)/2.0)*100)),
            farming: Math.min(100, Math.round((totalCS/totalDuration)*10)),
            survival: Math.max(0, Math.round(100 - ((totalD/gameCount)*10)))
        };
        
        const nemesisList = Array.from(opponentMap.entries()).map(([name, d]) => ({ name, wins: d.wins, games: d.total, winRate: Math.round((d.wins/d.total)*100) }));
        result.uniqueStats = {
            winConditions: [
                { label: "Gets First Blood", count: winCondTracker.firstBlood.total, winRate: winCondTracker.firstBlood.total ? Math.round((winCondTracker.firstBlood.wins/winCondTracker.firstBlood.total)*100) : 0 },
                { label: "Gets First Tower", count: winCondTracker.firstTower.total, winRate: winCondTracker.firstTower.total ? Math.round((winCondTracker.firstTower.wins/winCondTracker.firstTower.total)*100) : 0 },
                { label: "Gets Solo Kill", count: winCondTracker.soloKill.total, winRate: winCondTracker.soloKill.total ? Math.round((winCondTracker.soloKill.wins/winCondTracker.soloKill.total)*100) : 0 }
            ].sort((a,b)=>b.winRate-a.winRate),
            nemesis: nemesisList.filter(n=>n.winRate<50).sort((a,b)=>a.winRate-b.winRate).slice(0,3),
            prey: nemesisList.filter(n=>n.winRate>=50).sort((a,b)=>b.winRate-a.winRate).slice(0,3),
            survival: { csAdvantage: Math.round(totalMaxCsAdv / gameCount), csAt10: parseFloat((totalCsAt10/gameCount).toFixed(1)) },
            clutch: { closeWr: closeTotal ? Math.round((closeWins/closeTotal)*100) : 0, stompWr: stompTotal ? Math.round((stompWins/stompTotal)*100) : 0, closeGames: closeTotal, stompGames: stompTotal }
        };
    }

    return result;
}
