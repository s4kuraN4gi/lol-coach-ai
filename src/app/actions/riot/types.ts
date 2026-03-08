// ─── Riot API Types ───────────────────────────────────────────────

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

// ─── Match V5 Types ─────────────────────────────────────────────

export type MatchV5Participant = {
    assists: number;
    baronKills: number;
    champExperience: number;
    champLevel: number;
    championId: number;
    championName: string;
    consumablesPurchased: number;
    damageDealtToBuildings: number;
    damageDealtToObjectives: number;
    damageDealtToTurrets: number;
    damageSelfMitigated: number;
    deaths: number;
    detectorWardsPlaced: number;
    doubleKills: number;
    dragonKills: number;
    firstBloodAssist: boolean;
    firstBloodKill: boolean;
    firstTowerAssist: boolean;
    firstTowerKill: boolean;
    gameEndedInEarlySurrender: boolean;
    gameEndedInSurrender: boolean;
    goldEarned: number;
    goldSpent: number;
    individualPosition: string;
    inhibitorKills: number;
    inhibitorTakedowns: number;
    inhibitorsLost: number;
    item0: number;
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number;
    killingSprees: number;
    kills: number;
    lane: string;
    largestCriticalStrike: number;
    largestKillingSpree: number;
    largestMultiKill: number;
    longestTimeSpentLiving: number;
    magicDamageDealt: number;
    magicDamageDealtToChampions: number;
    magicDamageTaken: number;
    neutralMinionsKilled: number;
    nexusKills: number;
    nexusTakedowns: number;
    nexusLost: number;
    objectivesStolen: number;
    objectivesStolenAssists: number;
    participantId: number;
    pentaKills: number;
    perks: {
        statPerks: { defense: number; flex: number; offense: number };
        styles: Array<{
            description: string;
            selections: Array<{ perk: number; var1: number; var2: number; var3: number }>;
            style: number;
        }>;
    };
    physicalDamageDealt: number;
    physicalDamageDealtToChampions: number;
    physicalDamageTaken: number;
    profileIcon: number;
    puuid: string;
    quadraKills: number;
    riotIdGameName: string;
    riotIdTagline: string;
    role: string;
    sightWardsBoughtInGame: number;
    spell1Casts: number;
    spell2Casts: number;
    spell3Casts: number;
    spell4Casts: number;
    summoner1Casts: number;
    summoner1Id: number;
    summoner2Casts: number;
    summoner2Id: number;
    summonerId: string;
    summonerLevel: number;
    summonerName: string;
    teamId: number; // 100 (Blue) or 200 (Red)
    teamPosition: string; // "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY"
    timeCCingOthers: number;
    timePlayed: number;
    totalDamageDealt: number;
    totalDamageDealtToChampions: number;
    totalDamageTaken: number;
    totalHeal: number;
    totalHealsOnTeammates: number;
    totalMinionsKilled: number;
    totalTimeCCDealt: number;
    totalUnitsHealed: number;
    tripleKills: number;
    trueDamageDealt: number;
    trueDamageDealtToChampions: number;
    trueDamageTaken: number;
    turretKills: number;
    turretTakedowns: number;
    turretsLost: number;
    unrealKills: number;
    visionScore: number;
    visionWardsBoughtInGame: number;
    wardsKilled: number;
    wardsPlaced: number;
    win: boolean;
    challenges?: Record<string, number>;
};

export type MatchV5Info = {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp: number;
    gameId: number;
    gameMode: string;
    gameName: string;
    gameStartTimestamp: number;
    gameType: string;
    gameVersion: string;
    mapId: number;
    participants: MatchV5Participant[];
    platformId: string;
    queueId: number;
    teams: Array<{
        bans: Array<{ championId: number; pickTurn: number }>;
        objectives: Record<string, { first: boolean; kills: number }>;
        teamId: number;
        win: boolean;
    }>;
};

export type MatchV5Response = {
    metadata: {
        dataVersion: string;
        matchId: string;
        participants: string[]; // PUUIDs
    };
    info: MatchV5Info;
};

// ─── Timeline V5 Types ──────────────────────────────────────────

export type TimelineParticipant = {
    participantId: number;
    puuid: string;
};

export type ParticipantFrame = {
    championStats: Record<string, number>;
    currentGold: number;
    damageStats: Record<string, number>;
    goldPerSecond: number;
    jungleMinionsKilled: number;
    level: number;
    minionsKilled: number;
    participantId: number;
    position: { x: number; y: number };
    timeEnemySpentControlled: number;
    totalGold: number;
    xp: number;
};

export type TimelineEvent = {
    timestamp: number;
    type: string;
    real?: number;
    position?: { x: number; y: number };
    // CHAMPION_KILL
    killerId?: number;
    victimId?: number;
    assistingParticipantIds?: number[];
    bounty?: number;
    killStreakLength?: number;
    killType?: string;
    // ELITE_MONSTER_KILL
    monsterType?: string;
    monsterSubType?: string;
    killerTeamId?: number;
    // BUILDING_KILL
    buildingType?: string;
    laneType?: string;
    towerType?: string;
    teamId?: number;
    // WARD
    wardType?: string;
    creatorId?: number;
    // ITEM
    participantId?: number;
    itemId?: number;
    // SKILL / LEVEL
    skillSlot?: number;
    level?: number;
    levelUpType?: string;
    // Allow additional Riot API fields
    [key: string]: unknown;
};

export type TimelineFrame = {
    timestamp: number;
    participantFrames: Record<string, ParticipantFrame>;
    events: TimelineEvent[];
};

export type TimelineV5Response = {
    metadata: {
        dataVersion: string;
        matchId: string;
        participants: string[];
    };
    info: {
        frameInterval: number;
        frames: TimelineFrame[];
        gameId: number;
        participants: TimelineParticipant[];
    };
};

// ─── Champion Attributes ─────────────────────────────────────────

export type ChampionAttributes = {
    identity: string;
    powerSpike: string;
    waveClear: string;
    mobility: string;
    class: string;
    lanes: string[];
    damageType: string;
    notes?: string;
};

// ─── Macro Knowledge ─────────────────────────────────────────────

export type MacroKnowledge = {
    meta?: Record<string, any>;
    fundamental_concepts?: Record<string, any>;
    season_16_changes?: Record<string, any>;
    objective_response: Record<string, any>;
    game_state_strategy: Record<string, any>;
    time_phase_priorities: Record<string, any>;
    common_macro_mistakes: Record<string, any>;
};

export type MacroAdviceContext = {
    goldDiff: number;
    gameTimeMs: number;
    userRole?: string;
    events?: TruthEvent[];
    focusMode?: 'LANING' | 'MACRO' | 'TEAMFIGHT';
    deathCount?: number;
    csDiff?: number;
    enemyObjectivesTaken?: string[];
};

// ─── Timeline / Match Event Types ────────────────────────────────

export type TruthEvent = {
    timestamp: number;
    timestampStr: string;
    type: 'KILL' | 'DEATH' | 'OBJECTIVE' | 'TURRET' | 'WARD' | 'ITEM' | 'LEVEL' | 'SPELL' | 'OTHER';
    detail: string;
    position: { x: number, y: number };
    participants: number[]; // IDs of involved players
    // Enhanced context for richer analysis
    context?: {
        goldDiff?: number;       // Gold difference at this moment (user vs opponent)
        levelDiff?: number;      // Level difference
        csDiff?: number;         // CS difference
        assistCount?: number;    // Number of assists (for kills)
        isFirstBlood?: boolean;
        killType?: 'SOLO' | 'LANE_2V2' | 'GANK' | 'ROAM' | 'TEAMFIGHT' | 'UNKNOWN';  // Role-aware classification
        involvedRoles?: string[];  // Roles of participants (e.g., ["BOTTOM", "UTILITY", "JUNGLE"])
        isAllyObjective?: boolean;  // true = YOUR team got it, false = ENEMY team got it
        objectiveType?: string;     // DRAGON, BARON, RIFT_HERALD, HORDE, etc.
        wardType?: string;       // YELLOW_TRINKET, CONTROL_WARD, etc.
        itemId?: number;
        itemName?: string;
        spellSlot?: number;      // 1=D, 2=F (summoner spells)
    };
};

// ─── Frame Statistics ────────────────────────────────────────────

export type FrameStats = {
    timestamp: number;
    timestampStr: string;
    user: {
        currentGold: number;
        totalGold: number;
        level: number;
        cs: number;
        jungleCs: number;
        position: { x: number, y: number };
    };
    opponent?: {
        totalGold: number;
        level: number;
        cs: number;
        jungleCs: number;
        position: { x: number, y: number };
    };
    goldDiff: number;    // user - opponent
    csDiff: number;      // user - opponent
    levelDiff: number;   // user - opponent
};

// ─── Participant Role Mapping ────────────────────────────────────

export type ParticipantRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | 'UNKNOWN';

export type ParticipantRoleMap = {
    [participantId: number]: {
        role: ParticipantRole;
        championName: string;
        teamId: number;  // 100 = Blue, 200 = Red
    };
};
