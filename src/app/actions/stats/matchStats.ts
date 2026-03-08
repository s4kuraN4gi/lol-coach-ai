'use server'

import { createClient } from "@/utils/supabase/server";
import { fetchRank, fetchSummonerByPuuid, type LeagueEntryDTO, fetchMatchIds } from "../riot";
import { logger } from "@/lib/logger";
import type {
    ChampionStat,
    RadarStats,
    UniqueStats,
    RoleStats,
    BasicStatsDTO,
    MatchStatsDTO,
} from "./types";
import type { MatchV5Participant, MatchV5Info } from "../riot/types";

// --- Split Actions for Progressive Loading ---

export async function fetchBasicStats(puuid: string, summonerId?: string | null, gameName?: string | null, tagLine?: string | null): Promise<BasicStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); };

    try {
        // 0. Self-Heal: Recover SummonerID if missing
        let validSummonerId = summonerId;

        // Helper to check validity
        const isValid = (id?: string | null) => id && id.length > 5;

        if (!isValid(validSummonerId)) {
             const { fetchSummonerByPuuid, fetchRiotAccount } = await import('../riot');
             log(`[BasicStats] SummonerID missing. Fetching by PUUID...`);

             let summonerData = await fetchSummonerByPuuid(puuid);

             // Check if data is valid (has ID)
             if (!summonerData || !summonerData.id) {
                 log(`[BasicStats] PUUID Fetch failed/bad data. Trying Riot ID Recovery...`);
                 if (gameName && tagLine) {
                     const riotAccount = await fetchRiotAccount(gameName, tagLine);
                     if (riotAccount && riotAccount.puuid) {
                         log(`[BasicStats] Recovered fresh PUUID`);
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
             const { fetchSummonerByPuuid } = await import('../riot');
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

    } catch (e) {
        const errorMsg = `[BasicStats] Critical Error: ${e instanceof Error ? e.message : String(e)}`;
        logger.error("fetchBasicStats Error:", errorMsg);
        logs.push(errorMsg);
        return { ranks: [], debugLog: logs };
    }
}

// --- Cache-First Architecture ---

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
    } else {
    }

    // Default Empty State
    const result: MatchStatsDTO & BasicStatsDTO = {
        ranks: [],
        debugLog: logs,
        recentMatches: [],
        championStats: [],
        radarStats: null,
        uniqueStats: null,
        quickStats: null,
        roleStats: null
    };

    if (account) {
        if (account.rank_info) {
             result.ranks = account.rank_info as LeagueEntryDTO[];
        }

        // 2. Fetch Matches from Cache using stored IDs
        if (account.recent_match_ids && Array.isArray(account.recent_match_ids)) {
             const limit = 50;
             const targetIds = (account.recent_match_ids as string[]).slice(0, limit);

             if (targetIds.length > 0) {
                 const { getCachedMatchesByIds } = await import('@/services/matchService');
                 const cachedMatches = await getCachedMatchesByIds(targetIds);

                 // Process these matches
                 // FIX: cachedMatches are { metadata, info }, but processMatchStats expects info objects
                 const validMatchesInfo = cachedMatches.map((m) => m.info || m);

                 const final = processMatchStats(validMatchesInfo, puuid, result);
                 return final;
             }
        } else {
        }
    } else {
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
 * Deprecated / Compatible: Online Fetch
 * If offlineOnly is true, it redirects to cache.
 */
export async function fetchMatchStats(puuid: string, offlineOnly: boolean = false): Promise<MatchStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); };

    if (offlineOnly) {
        const stats = await getStatsFromCache(puuid);
        const { ranks, ...matchStats } = stats;
        return matchStats;
    }

    try {
        const { fetchAndCacheMatches } = await import('@/services/matchService');
        const { matches, logs: serviceLogs } = await fetchAndCacheMatches(puuid, 50);
        serviceLogs.forEach(l => log(l));

        const baseResult: MatchStatsDTO & BasicStatsDTO = { ranks: [], debugLog: logs, recentMatches: [], championStats: [], radarStats: null, uniqueStats: null, quickStats: null, roleStats: null };
        const result = processMatchStats(matches.map(m=>m.info), puuid, baseResult);
        const { ranks, ...finalMatchStats } = result;
        return finalMatchStats;
    } catch (e) {
        logger.error("fetchMatchStats error", e);
        return { recentMatches: [], championStats: [], radarStats: null, uniqueStats: null, quickStats: null, roleStats: null, debugLog: [e instanceof Error ? e.message : String(e)] };
    }
}

// Internal Helper to process matches into stats
function processMatchStats(matches: MatchV5Info[], puuid: string, initialResult: MatchStatsDTO & BasicStatsDTO): MatchStatsDTO & BasicStatsDTO {
    const result = { ...initialResult }; // Copy
    const championMap = new Map<string, { wins: number, games: number, k: number, d: number, a: number, cs: number }>();

    let totalK = 0, totalD = 0, totalA = 0;
    let totalDmgObj = 0, totalVision = 0, totalCS = 0, totalDuration = 0, gameCount = 0;
    let totalTeamKills = 0, totalDamage = 0; // For QuickStats

    // Unique Stats Trackers
    const winCondTracker = { firstBlood: { wins: 0, total: 0 }, firstTower: { wins: 0, total: 0 }, soloKill: { wins: 0, total: 0 } };
    const opponentMap = new Map<string, { wins: number, total: number }>();
    let soloDeathCount = 0, totalCsAt10 = 0, totalMaxCsAdv = 0;
    let closeWins = 0, closeTotal = 0, stompWins = 0, stompTotal = 0;

    // Role Stats Tracker
    const roleCounter: RoleStats = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 };

    // Filter & Sort
    const validMatches = matches.filter(m => m.gameMode === 'CLASSIC');
    validMatches.sort((a, b) => b.gameCreation - a.gameCreation);

    validMatches.forEach(info => {
        const p = info.participants.find((p: MatchV5Participant) => p.puuid === puuid);
        if (!p) return;

        // Recent Matches
        result.recentMatches.push({ win: p.win, timestamp: info.gameCreation });

        // Role Stats
        const role = p.teamPosition as keyof RoleStats;
        if (role && roleCounter[role] !== undefined) {
            roleCounter[role]++;
        }

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
        totalDamage += p.totalDamageDealtToChampions || 0;

        // Team kills for kill participation
        const teamKills = info.participants
            .filter((pt: MatchV5Participant) => pt.teamId === p.teamId)
            .reduce((acc: number, pt: MatchV5Participant) => acc + (pt.kills || 0), 0);
        totalTeamKills += teamKills;

        // Unique
        if (p.firstBloodKill) { winCondTracker.firstBlood.total++; if (p.win) winCondTracker.firstBlood.wins++; }
        if (p.firstTowerKill) { winCondTracker.firstTower.total++; if (p.win) winCondTracker.firstTower.wins++; }
        if ((p.challenges?.soloKills ?? 0) > 0) { winCondTracker.soloKill.total++; if (p.win) winCondTracker.soloKill.wins++; }

        const enemy = info.participants.find((ep: MatchV5Participant) => ep.teamId !== p.teamId && ep.teamPosition === p.teamPosition);
        if (enemy && p.teamPosition !== 'UTILITY' && p.teamPosition !== 'JUNGLE') {
            const ename = enemy.championName;
            const ecurr = opponentMap.get(ename) || { wins: 0, total: 0 };
            ecurr.total++; if (p.win) ecurr.wins++;
            opponentMap.set(ename, ecurr);
        }

        if ((p.challenges?.soloKillsTaken ?? 0) > 0) {
            soloDeathCount++;
        }

        // DEBUG: Logging first 3 matches to check data availability
        if (gameCount <= 3) {
        }

        totalCsAt10 += ((p.challenges?.laneMinionsFirst10Minutes || 0) + (p.challenges?.jungleCsBefore10Minutes || 0));
        totalMaxCsAdv += (p.challenges?.maxCsAdvantageOnLaneOpponent || 0);

        const myTeamGold = info.participants.filter((pt: MatchV5Participant) => pt.teamId === p.teamId).reduce((acc: number, c: MatchV5Participant) => acc + (c.goldEarned || 0), 0);
        const enemyTeamGold = info.participants.filter((pt: MatchV5Participant) => pt.teamId !== p.teamId).reduce((acc: number, c: MatchV5Participant) => acc + (c.goldEarned || 0), 0);
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

        // QuickStats
        result.quickStats = {
            csPerMin: parseFloat((totalCS / totalDuration).toFixed(1)),
            visionPerMin: parseFloat((totalVision / totalDuration).toFixed(2)),
            kda: parseFloat(((totalK + totalA) / Math.max(1, totalD)).toFixed(2)),
            killParticipation: totalTeamKills > 0 ? Math.round(((totalK + totalA) / totalTeamKills) * 100) : 0,
            avgDamage: Math.round(totalDamage / gameCount),
            gamesAnalyzed: gameCount
        };

        // RoleStats
        result.roleStats = roleCounter;
    }

    return result;
}
