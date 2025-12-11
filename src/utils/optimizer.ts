
/**
 * Prunes the full Riot Match V5 JSON response to reduce storage size.
 * Removes unused 'challenges' and other heavy objects.
 */
export function pruneMatchData(matchData: any): any {
    if (!matchData || !matchData.info || !matchData.info.participants) {
        return matchData;
    }

    // Deep clone to avoid mutating original if used elsewhere immediately (though mostly used for save)
    const pruned = JSON.parse(JSON.stringify(matchData));

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
        "visionScorePerMinute"
    ];

    pruned.info.participants.forEach((p: any) => {
        // Prune Challenges
        if (p.challenges) {
            const newChallenges: any = {};
            KEEP_CHALLENGES.forEach(key => {
                if (key in p.challenges) {
                    newChallenges[key] = p.challenges[key];
                }
            });
            p.challenges = newChallenges;
        }

        // Remove Missions (often contains localized strings or bulky tracking)
        if (p.missions) delete p.missions;
        
        // Remove Perks if we don't visualize rune trees deeply?
        // We might want perks for "Build Analysis", so keeping them for now.
        // if (p.perks) delete p.perks; 
    });

    return pruned;
}
