
/**
 * Prunes the full Riot Match V5 JSON response to reduce storage size.
 * Removes unused 'challenges' and other heavy objects.
 */
import type { MatchV5Response } from "@/app/actions/riot/types";

export function pruneMatchData(matchData: MatchV5Response): MatchV5Response {
    if (!matchData || !matchData.info || !matchData.info.participants) {
        return matchData;
    }

    // Deep clone to avoid mutating original if used elsewhere immediately (though mostly used for save)
    const pruned: MatchV5Response = JSON.parse(JSON.stringify(matchData));

    // Whitelist of critical challenges we use for stats
    // Add new ones here as features expand
    const KEEP_CHALLENGES = [
        "soloKills",
        "soloKillsTaken",
        "goldPerMinute", // Good for Clutch
        "damagePerMinute",
        "kda",
        "killParticipation",
        "turretPlatesTaken",
        "visionScorePerMinute",
        "laneMinionsFirst10Minutes",
        "jungleCsBefore10Minutes",
        "teamDamagePercentage",
        "damageTakenOnTeamPercentage",
        "maxCsAdvantageOnLaneOpponent",
        "maxLevelLeadLaneOpponent"
    ];

    pruned.info.participants.forEach((p) => {
        if (p.challenges) {
            const newChallenges: Record<string, number> = {};
            KEEP_CHALLENGES.forEach(key => {
                const challenges = p.challenges as Record<string, number>;
                if (key in challenges && challenges[key] !== undefined) {
                    newChallenges[key] = challenges[key];
                }
            });
            p.challenges = newChallenges;
        }

        // Remove Missions (often contains localized strings or bulky tracking)
        if ('missions' in p) delete (p as Record<string, unknown>).missions;
    });

    return pruned;
}
