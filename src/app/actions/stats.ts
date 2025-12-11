'use server'

import { fetchMatchIds, fetchMatchDetail, fetchRank, type LeagueEntryDTO } from "./riot";

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
    survival: { soloDeathRate: number };
    clutch: { closeWr: number, stompWr: number, closeGames: number, stompGames: number };
}

export type DashboardStatsDTO = {
    rank: LeagueEntryDTO | null;
    recentMatches: {
        win: boolean;
        timestamp: number;
    }[]; // For LP Widget Trend
    championStats: ChampionStat[]; // For Champion Card
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
}

// Rate limit safe fetcher
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchDashboardStats(puuid: string, summonerId: string): Promise<DashboardStatsDTO> {
    const stats: DashboardStatsDTO = {
        rank: null,
        recentMatches: [],
        championStats: [],
        radarStats: null,
        uniqueStats: null
    };

    try {
        // 1. Fetch Rank
        const ranks = await fetchRank(summonerId);
        // Prioritize SOLO, then FLEX
        stats.rank = ranks.find(r => r.queueType === "RANKED_SOLO_5x5") 
                     || ranks.find(r => r.queueType === "RANKED_FLEX_SR") 
                     || null;

        // 2. Fetch Matches (20 for analytics)
        const idsRes = await fetchMatchIds(puuid, 20); // Fetch 20
        if (!idsRes.success || !idsRes.data) throw new Error("Failed to fetch match IDs");

        const matchIds = idsRes.data;
        console.log(`[Stats] Found ${matchIds.length} matches for ${puuid}`);

        // 3. Batch Fetch Details to respect Rate Limits (20 req / 1 sec)
        // We split into chunks of 10 and wait a bit.
        const matches: any[] = [];
        const chunkSize = 10;
        
        for (let i = 0; i < matchIds.length; i += chunkSize) {
            const chunk = matchIds.slice(i, i + chunkSize);
            const promises = chunk.map(id => fetchMatchDetail(id));
            const results = await Promise.all(promises);
            results.forEach(r => {
                if (r.success && r.data) matches.push(r.data);
            });
            
            if (i + chunkSize < matchIds.length) {
                await delay(1200); // Wait 1.2s between chunks
            }
        }

        // 4. Aggregate Data
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
        
        let closeWins = 0, closeTotal = 0;
        let stompWins = 0, stompTotal = 0;

        matches.sort((a, b) => b.info.gameCreation - a.info.gameCreation).forEach(m => {
            const p = m.info.participants.find((p: any) => p.puuid === puuid);
            if (!p) return;

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
            if (enemy && p.teamPosition !== 'UTILITY' && p.teamPosition !== 'JUNGLE') { // Optimization: positions usually match in lanes
                const ename = enemy.championName;
                const ecurr = opponentMap.get(ename) || { wins: 0, total: 0 };
                ecurr.total++;
                if (p.win) ecurr.wins++;
                opponentMap.set(ename, ecurr);
            }

            // C. Survival (Approximate Isolation Death via Solo Kills Taken)
            if (p.challenges?.soloKillsTaken > 0) soloDeathCount++;
            
            // D. Clutch (Gold Diff)
            // Calculate team gold
            const myTeamGold = m.info.participants.filter((pt: any) => pt.teamId === p.teamId).reduce((acc: number, curr: any) => acc + curr.goldEarned, 0);
            const enemyTeamGold = m.info.participants.filter((pt: any) => pt.teamId !== p.teamId).reduce((acc: number, curr: any) => acc + curr.goldEarned, 0);
            const goldDiff = Math.abs(myTeamGold - enemyTeamGold);
            
            if (goldDiff < 5000) { // < 5k Gold Diff is fairly close
                 closeTotal++;
                 if (p.win) closeWins++;
            } else if (goldDiff > 10000) { // > 10k is Stomp
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
                    soloDeathRate: Math.round((soloDeathCount / gameCount) * 100)
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

    } catch (e) {

        console.error("fetchDashboardStats Error:", e);
        // Return partial if fail
        return stats;
    }
}
