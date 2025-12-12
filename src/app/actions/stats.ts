'use server'

import { createClient } from "@/utils/supabase/server";
import { fetchRank, fetchSummonerByPuuid, type LeagueEntryDTO } from "./riot";

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
    survival: { soloDeathRate: number, csAt10: number };
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

export async function fetchDashboardStats(puuid: string, summonerId?: string | null): Promise<DashboardStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    const stats: DashboardStatsDTO = {
        ranks: [],
        recentMatches: [],
        championStats: [],
        radarStats: null,
        uniqueStats: null,
        debugLog: []
    };

    try {
        const supabase = await createClient();

        // 0. Self-Heal: Recover SummonerID if missing
        let validSummonerId = summonerId;
        if (!validSummonerId) {
             const { fetchSummonerByPuuid } = await import('./riot');
             log(`[Stats] SummonerID missing. Recovering from Riot...`);
             const summonerData = await fetchSummonerByPuuid(puuid);
             if (summonerData) {
                 validSummonerId = summonerData.id;
                 log(`[Stats] Recovered SummonerID: ${validSummonerId}`);
             } else {
                 throw new Error("Failed to recover SummonerID from PUUID");
             }
        }

        // 1. Fetch Rank
        let ranks = await fetchRank(validSummonerId);

        // Self-heal: If NO ranks found, SummonerID might be stale. Re-fetch ID from Riot.
        if (ranks.length === 0 && validSummonerId) {
             const { fetchSummonerByPuuid } = await import('./riot');
             log(`[Stats] No ranks found. Verifying SummonerID...`);
             const freshSummoner = await fetchSummonerByPuuid(puuid, true); // noCache=true
             
             if (freshSummoner && freshSummoner.id !== validSummonerId) {
                 log(`[Stats] SummonerID mismatch! Updating to: ${freshSummoner.id}`);
                 validSummonerId = freshSummoner.id;
                 ranks = await fetchRank(validSummonerId);
                 log(`[Stats] Retry Rank Fetch found: ${ranks.length}`);
             } else {
                 log(`[Stats] SummonerID is valid (unchanged). User is likely truly Unranked.`);
             }
        }

        stats.ranks = ranks;
        log(`[Stats] Ranks fetched: ${ranks.length}`);
        if(ranks.length > 0) {
            log(`[Stats] Queues: ${ranks.map(r => r.queueType).join(', ')}`);
        } else {
             log(`[Stats] No ranks found for ID: ${validSummonerId}`);
        }


        // 2. Fetch Matches (Delegated to Service)
        const { fetchAndCacheMatches } = await import('@/services/matchService');
        const { matches, logs: serviceLogs } = await fetchAndCacheMatches(puuid, 50);
        serviceLogs.forEach(l => log(l));
        
        log(`[Stats] Processing ${matches.length} matches...`);
        
        const championMap = new Map<string, { wins: number, games: number, k: number, d: number, a: number, cs: number }>();

        
        // Radar aggregators
        let totalK = 0, totalD = 0, totalA = 0;
        let totalDmgObj = 0;
        let totalVision = 0;
        let totalCS = 0;
        let totalDuration = 0; // minutes
        let gameCount = 0;

        // Unique Stats Aggregators
        const winCondTracker = {
            firstBlood: { wins: 0, total: 0 },
            firstTower: { wins: 0, total: 0 },
            soloKill: { wins: 0, total: 0 }
        };
        const opponentMap = new Map<string, { wins: number, total: number }>();
        let soloDeathCount = 0;
        let totalCsAt10 = 0;
        
        let closeWins = 0, closeTotal = 0;
        let stompWins = 0, stompTotal = 0;

        matches.sort((a, b) => b.info.gameCreation - a.info.gameCreation).forEach(m => {
            // Filter: Only Analyze Summoner's Rift (CLASSIC) to avoid ARAM skewing stats
            if (m.info.gameMode !== 'CLASSIC') return;

            const p = m.info.participants.find((p: any) => p.puuid === puuid);
            if (!p) {
                 log(`[Stats] WAITING PUUID Match Fail: ${m.metadata.matchId}`);
                 // Log first few chars to compare
                 const participants = m.info.participants.map((px: any) => px.puuid.slice(0, 10)).join(', ');
                 log(`[Stats] Wanted: ${puuid.slice(0, 10)}... Found: ${participants}`);
                 return;
            }

            // Recent Matches (Win/Loss Trend)
            stats.recentMatches.push({
                win: p.win,
                timestamp: m.info.gameCreation
            });

            // Champion Stats
            const champ = p.championName;
            const current = championMap.get(champ) || { wins: 0, games: 0, k: 0, d: 0, a: 0, cs: 0 };
            
            current.games++;
            if (p.win) current.wins++;
            current.k += p.kills;
            current.d += p.deaths;
            current.a += p.assists;
            current.cs += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
            
            championMap.set(champ, current);

            // Radar Stats
            const durationMin = (m.info.gameDuration || 1) / 60; // Avoid div by 0
            totalDuration += durationMin;
            gameCount++;

            totalK += p.kills;
            totalD += p.deaths;
            totalA += p.assists;
            totalDmgObj += p.damageDealtToObjectives || 0;
            totalVision += p.visionScore || 0;
            totalCS += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
            
            // --- Unique Stats Logic ---
            // A. Win Conditions
            if (p.firstBloodKill) { winCondTracker.firstBlood.total++; if (p.win) winCondTracker.firstBlood.wins++; }
            if (p.firstTowerKill) { winCondTracker.firstTower.total++; if (p.win) winCondTracker.firstTower.wins++; }
            if (p.challenges?.soloKills > 0) { winCondTracker.soloKill.total++; if (p.win) winCondTracker.soloKill.wins++; }
            
            // B. Nemesis
            const enemy = m.info.participants.find((ep: any) => ep.teamId !== p.teamId && ep.teamPosition === p.teamPosition);
            if (enemy && p.teamPosition !== 'UTILITY' && p.teamPosition !== 'JUNGLE') { 
                const ename = enemy.championName;
                const ecurr = opponentMap.get(ename) || { wins: 0, total: 0 };
                ecurr.total++;
                if (p.win) ecurr.wins++;
                opponentMap.set(ename, ecurr);
            }

            // C. Survival (Approximate Isolation Death via Solo Kills Taken)
            if (p.challenges?.soloKillsTaken > 0) soloDeathCount++;

            const lMin = p.challenges?.laneMinionsFirst10Minutes || 0;
            const jMin = p.challenges?.jungleCsBefore10Minutes || 0;
            totalCsAt10 += (lMin + jMin);
            
            // D. Clutch (Gold Diff)
            const myTeamGold = m.info.participants.filter((pt: any) => pt.teamId === p.teamId).reduce((acc: number, curr: any) => acc + (curr.goldEarned || 0), 0);
            const enemyTeamGold = m.info.participants.filter((pt: any) => pt.teamId !== p.teamId).reduce((acc: number, curr: any) => acc + (curr.goldEarned || 0), 0);
            const goldDiff = Math.abs(myTeamGold - enemyTeamGold);
            
            if (goldDiff < 5000) { 
                 closeTotal++;
                 if (p.win) closeWins++;
            } else if (goldDiff > 10000) { 
                 stompTotal++;
                 if (p.win) stompWins++;
            }
        });

        // Format Champion Stats
        stats.championStats = Array.from(championMap.entries()).map(([name, data]) => {
            const avgDeaths = data.d / data.games;
            return {
                name,
                games: data.games,
                wins: data.wins,
                avgKills: parseFloat((data.k / data.games).toFixed(1)),
                avgDeaths: parseFloat(avgDeaths.toFixed(1)),
                avgAssists: parseFloat((data.a / data.games).toFixed(1)),
                avgCs: parseFloat((data.cs / data.games).toFixed(1)),
                winRate: Math.round((data.wins / data.games) * 100),
                avgKda: ((data.k + data.a) / Math.max(1, data.d)).toFixed(2)
            };
        }).sort((a, b) => b.games - a.games).slice(0, 5); // Top 5 Most Played

        // Calculate Radar Stats
        if (gameCount > 0) {
            const avgKda = (totalK + totalA) / Math.max(1, totalD);
            const avgDmgObj = totalDmgObj / gameCount;
            const avgVisionPerMin = totalVision / totalDuration; // totalVision / totalMinutes
            const avgCsPerMin = totalCS / totalDuration;
            const avgDeaths = totalD / gameCount;

            stats.radarStats = {
                combat: Math.min(100, Math.round(avgKda * 20)), // 5.0 KDA = 100
                objective: Math.min(100, Math.round((avgDmgObj / 15000) * 100)), // 15k Dmg = 100
                vision: Math.min(100, Math.round((avgVisionPerMin / 2.0) * 100)), // 2.0/min = 100
                farming: Math.min(100, Math.round(avgCsPerMin * 10)), // 10 CS/min = 100
                survival: Math.max(0, Math.round(100 - (avgDeaths * 10))) // 0 deaths = 100, 10 deaths = 0
            };
            
            // Format Unique Stats
            const nemesisList = Array.from(opponentMap.entries()).map(([name, data]) => ({
                name,
                wins: data.wins,
                games: data.total,
                winRate: Math.round((data.wins / data.total) * 100)
            }));
            
            stats.uniqueStats = {
                winConditions: [
                    { label: "Gets First Blood", count: winCondTracker.firstBlood.total, winRate: winCondTracker.firstBlood.total ? Math.round((winCondTracker.firstBlood.wins/winCondTracker.firstBlood.total)*100) : 0 },
                    { label: "Gets First Tower", count: winCondTracker.firstTower.total, winRate: winCondTracker.firstTower.total ? Math.round((winCondTracker.firstTower.wins/winCondTracker.firstTower.total)*100) : 0 },
                    { label: "Gets Solo Kill", count: winCondTracker.soloKill.total, winRate: winCondTracker.soloKill.total ? Math.round((winCondTracker.soloKill.wins/winCondTracker.soloKill.total)*100) : 0 }
                ].sort((a, b) => b.winRate - a.winRate),
                
                nemesis: nemesisList.filter(n => n.winRate < 50).sort((a, b) => a.winRate - b.winRate).slice(0, 3), // Lowest WR
                prey: nemesisList.filter(n => n.winRate >= 50).sort((a, b) => b.winRate - a.winRate).slice(0, 3), // Highest WR
                
                survival: {
                    soloDeathRate: Math.round((soloDeathCount / gameCount) * 100),
                    csAt10: gameCount > 0 ? parseFloat((totalCsAt10 / gameCount).toFixed(1)) : 0
                },
                
                clutch: {
                    closeWr: closeTotal ? Math.round((closeWins / closeTotal) * 100) : 0,
                    stompWr: stompTotal ? Math.round((stompWins / stompTotal) * 100) : 0,
                    closeGames: closeTotal,
                    stompGames: stompTotal
                }
            };
        }

        return stats;

    } catch (e: any) {
        const errorMsg = `[Stats] Critical Error: ${e.message || e}`;
        console.error("fetchDashboardStats Error:", errorMsg);
        logs.push(errorMsg);
        stats.debugLog = logs;
        return stats;
    }
}
