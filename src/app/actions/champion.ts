'use server'

import { fetchAndCacheMatches } from "@/services/matchService";
import { fetchSummonerByPuuid } from "./riot";

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
        goldDiff15: number;
        csDiff15: number;
        xpDiff15: number;
        laneWinRate: number; // based on Gold@15
    };
    combat: {
        damageShare: number; // % of team damage
        killParticipation: number; // % of team kills
        damagePerDeath: number;
    };
    spikes: {
        earlyGame: number; // Winrate 0-20 min
        midGame: number; // Winrate 20-30 min
        lateGame: number; // Winrate 30+ min
    };
}

export async function getChampionStats(puuid: string, championName: string): Promise<ChampionDetailsDTO | null> {
    if (!puuid || !championName) return null;

    // Fetch matches (limit 50, same as dashboard for consistency)
    const { matches } = await fetchAndCacheMatches(puuid, 50);

    // Filter for specific champion
    // Normalize championName comparison (case-insensitive)
    const championMatches = matches.filter(m => {
        const p = m.info.participants.find((p: any) => p.puuid === puuid);
        return p && p.championName.toLowerCase() === championName.toLowerCase();
    });

    if (championMatches.length === 0) return null;

    // Initialize accumulators
    let wins = 0;
    let kills = 0, deaths = 0, assists = 0;
    let cs = 0, duration = 0;
    let goldDiff15 = 0, csDiff15 = 0, xpDiff15 = 0, lanewins = 0;
    let damageShare = 0, killParticipation = 0;
    
    // Spikes tracking
    const spikes = {
        early: { wins: 0, games: 0 },
        mid: { wins: 0, games: 0 },
        late: { wins: 0, games: 0 }
    };

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

        // Laning (vs Lane Opponent is hard to determine reliably without role matching, 
        // but we can use challenges if available, or just raw @15 stats if we had opponent.
        // For now, let's use challenges if they exist for specific diffs, 
        // or approximate with individual challenges)
        
        // Riot Challenges often have 'maxCsAdvantageOnLaneOpponent' or similar. 
        // 'goldPerMinute' etc.
        // For direct laning diffs, we ideally need the opponent. 
        // Logic: Find opponent role (same teamPosition, different teamId).
        const opponent = m.info.participants.find((o: any) => 
            o.teamId !== p.teamId && o.teamPosition === p.teamPosition
        );

        if (opponent) {
            // Note: Timeline data is better, but match v5 dto has no timeline.
            // We rely on rough approximations if exact @15 isn't in challenges.
            // Actually, we can use challenges: 'laningPhaseGoldExpAdvantage', 'goldDiffAt15' is NOT in standard DTO.
            // But we have `challenges.goldAdvantageAt15`? No.
            // We might have to rely on `challenges` object.
            
            // Let's check whitelisted challenges in optimizer.ts?
            // "laneMinionsFirst10Minutes", "goldPerMinute", "damagePerMinute"
            
            // If we lack timeline, we might skip precise Diff@15 for now or use available proxies.
            // For MVP let's calculate simplistic diffs closer to 'End Game' diffs scaled, OR 
            // use `challenges` if we added them to whitelist.
            // Let's assume we will add `goldDiffAt15` logic later if missing.
            // For now, let's use specific known challenges if present:
            // `laneMinionsFirst10Minutes` - `opponent.laneMinionsFirst10Minutes`
            
            if (p.challenges?.laneMinionsFirst10Minutes && opponent.challenges?.laneMinionsFirst10Minutes) {
                csDiff15 += (p.challenges.laneMinionsFirst10Minutes - opponent.challenges.laneMinionsFirst10Minutes);
                // This is @10, but close enough proxy for laning phase strength
            }
            
            // Gold/XP diffs are harder without timeline. 
            // We'll leave them as 0 or estimated for now if data is missing.
        }

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

        // Power Spikes (Winrate by Duration)
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
    
    return {
        championName: championName, // Return essentially what was requested, normalized handling can be added
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
            goldDiff15: 0, // Placeholder until better data source
            csDiff15: parseFloat((csDiff15 / games).toFixed(1)), // Based on CS@10 actually
            xpDiff15: 0, // Placeholder
            laneWinRate: 0 // Placeholder
        },
        combat: {
            damageShare: parseFloat(((damageShare / games) * 100).toFixed(1)),
            killParticipation: parseFloat(((killParticipation / games) * 100).toFixed(1)),
            damagePerDeath: 0 // TODO
        },
        spikes: {
            earlyGame: spikes.early.games ? Math.round((spikes.early.wins / spikes.early.games) * 100) : 0,
            midGame: spikes.mid.games ? Math.round((spikes.mid.wins / spikes.mid.games) * 100) : 0,
            lateGame: spikes.late.games ? Math.round((spikes.late.wins / spikes.late.games) * 100) : 0,
        }
    };
}
