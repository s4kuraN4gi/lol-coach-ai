'use server'

import { fetchAndCacheMatches } from "@/services/matchService";

export type MatchupStat = {
    opponentChampion: string;
    games: number;
    wins: number;
    winRate: number;
    goldDiff: number;
    csDiff: number;
    killDiff: number;
}

export type ChampionDetailsDTO = {
    championName: string;
    summary: {
        games: number;
        wins: number;
        winRate: number;
        kda: string;
        avgKills: number;
        avgDeaths: number;
        avgAssists: number;
        avgCs: number;
        csPerMin: number;
    };
    laning: {
        goldDiff: number; // Avg Gold Diff (Global)
        csDiff10: number;
        xpDiff: number; // Avg XP Diff
        laneWinRate: number; // based on Gold Lead
    };
    combat: {
        damageShare: number; // % of team damage
        killParticipation: number; // % of team kills
        damagePerDeath: number;
    };
    spikes: {
        earlyGame: number; // Winrate 0-25 min
        midGame: number; // Winrate 25-35 min
        lateGame: number; // Winrate 35+ min
    };
    matchups: MatchupStat[];
}

export async function getChampionStats(puuid: string, championName: string): Promise<ChampionDetailsDTO | null> {
    if (!puuid || !championName) return null;

    console.log(`[ChampionStats] Fetching for PUUID: ${puuid?.slice(0, 10)}..., Champion: ${championName}`);

    const { matches } = await fetchAndCacheMatches(puuid, 50);
    console.log(`[ChampionStats] Matches Fetched: ${matches.length}`);

    // Filter for specific champion
    const championMatches = matches.filter(m => {
        const p = m.info.participants.find((p: any) => p.puuid === puuid);
        if (!p) return false;
        return p.championName.toLowerCase() === championName.toLowerCase();
    });

    console.log(`[ChampionStats] Filtered Matches: ${championMatches.length}`);

    if (championMatches.length === 0) {
        return null;
    }

    // Initialize accumulators
    let wins = 0;
    let kills = 0, deaths = 0, assists = 0;
    let cs = 0, duration = 0;
    let totalCsDiff10 = 0, totalGoldDiff = 0, totalXpDiff = 0;
    let laningGames = 0; // Games where we found an opponent
    let damageShare = 0, killParticipation = 0;
    
    // Spikes tracking
    const spikes = {
        early: { wins: 0, games: 0 },
        mid: { wins: 0, games: 0 },
        late: { wins: 0, games: 0 }
    };

    // Matchup Map
    const matchupMap = new Map<string, { games: number, wins: number, goldDiff: number, csDiff: number, killDiff: number }>();

    championMatches.forEach(m => {
        const p = m.info.participants.find((p: any) => p.puuid === puuid);
        const team = m.info.participants.filter((t: any) => t.teamId === p.teamId);
        
        // Basic Stats
        if (p.win) wins++;
        kills += p.kills;
        deaths += p.deaths;
        assists += p.assists;
        cs += (p.totalMinionsKilled + p.neutralMinionsKilled);
        duration += m.info.gameDuration;

        // Combat
        if (p.challenges?.teamDamagePercentage) {
            damageShare += p.challenges.teamDamagePercentage;
        } else {
             const totalTeamDmg = team.reduce((sum: number, t: any) => sum + t.totalDamageDealtToChampions, 0);
             if (totalTeamDmg > 0) damageShare += (p.totalDamageDealtToChampions / totalTeamDmg);
        }

        if (p.challenges?.killParticipation) {
            killParticipation += p.challenges.killParticipation;
        }

        // Matchup & Laning
        const opponent = m.info.participants.find((o: any) => 
            o.teamId !== p.teamId && o.teamPosition === p.teamPosition && p.teamPosition !== 'UTILITY'
        );

        if (opponent) {
            laningGames++;
            
            // Laning Metrics
            // CS Diff @ 10 (using challenges)
            if (p.challenges?.laneMinionsFirst10Minutes !== undefined && opponent.challenges?.laneMinionsFirst10Minutes !== undefined) {
                totalCsDiff10 += (p.challenges.laneMinionsFirst10Minutes - opponent.challenges.laneMinionsFirst10Minutes);
            }
            // Fallback to Jungle CS if jungle
            else if (p.teamPosition === 'JUNGLE' && p.challenges?.jungleCsBefore10Minutes !== undefined && opponent.challenges?.jungleCsBefore10Minutes !== undefined) {
                 totalCsDiff10 += (p.challenges.jungleCsBefore10Minutes - opponent.challenges.jungleCsBefore10Minutes);
            }

            // Gold/XP Diff (Whole Game Avg as proxy if @15 not avail)
            // Or better: Gold Per Minute Diff * 15?
            const gDiff = p.goldEarned - opponent.goldEarned;
            totalGoldDiff += gDiff;
            totalXpDiff += (p.champExperience - opponent.champExperience); // Total XP diff

            // Matchup Stats
            const opponentName = opponent.championName;
            const current = matchupMap.get(opponentName) || { games: 0, wins: 0, goldDiff: 0, csDiff: 0, killDiff: 0 };
            
            current.games++;
            if (p.win) current.wins++;
            current.goldDiff += gDiff;
            current.csDiff += ((p.totalMinionsKilled + p.neutralMinionsKilled) - (opponent.totalMinionsKilled + opponent.neutralMinionsKilled));
            current.killDiff += (p.kills - opponent.kills);
            
            matchupMap.set(opponentName, current);
        }

        // Power Spikes
        const mins = m.info.gameDuration / 60;
        if (mins < 25) {
            spikes.early.games++;
            if (p.win) spikes.early.wins++;
        } else if (mins < 35) {
            spikes.mid.games++;
            if (p.win) spikes.mid.wins++;
        } else {
            spikes.late.games++;
            if (p.win) spikes.late.wins++;
        }
    });

    const games = championMatches.length;
    
    // Process Matchups
    const matchups: MatchupStat[] = Array.from(matchupMap.entries()).map(([name, data]) => ({
        opponentChampion: name,
        games: data.games,
        wins: data.wins,
        winRate: Math.round((data.wins / data.games) * 100),
        goldDiff: Math.round(data.goldDiff / data.games),
        csDiff: Math.round(data.csDiff / data.games),
        killDiff: parseFloat((data.killDiff / data.games).toFixed(1))
    })).sort((a, b) => b.games - a.games);

    return {
        championName: championName,
        summary: {
            games,
            wins,
            winRate: Math.round((wins / games) * 100),
            kda: `${(kills / games).toFixed(1)} / ${(deaths / games).toFixed(1)} / ${(assists / games).toFixed(1)}`,
            avgKills: kills / games,
            avgDeaths: deaths / games,
            avgAssists: assists / games,
            avgCs: Math.round(cs / games),
            csPerMin: parseFloat(((cs / games) / (duration / games / 60)).toFixed(1))
        },
        laning: {
            goldDiff: laningGames ? Math.round(totalGoldDiff / laningGames) : 0,
            csDiff10: laningGames ? parseFloat((totalCsDiff10 / laningGames).toFixed(1)) : 0,
            xpDiff: laningGames ? Math.round(totalXpDiff / laningGames) : 0,
            laneWinRate: 0 // TODO: Implement if needed
        },
        combat: {
            damageShare: parseFloat(((damageShare / games) * 100).toFixed(1)),
            killParticipation: parseFloat(((killParticipation / games) * 100).toFixed(1)),
            damagePerDeath: 0 
        },
        spikes: {
            earlyGame: spikes.early.games ? Math.round((spikes.early.wins / spikes.early.games) * 100) : 0,
            midGame: spikes.mid.games ? Math.round((spikes.mid.wins / spikes.mid.games) * 100) : 0,
            lateGame: spikes.late.games ? Math.round((spikes.late.wins / spikes.late.games) * 100) : 0,
        },
        matchups: matchups
    };
}
