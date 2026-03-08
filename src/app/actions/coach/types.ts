// ============================================================
// TYPES — Coach Analysis
// ============================================================

export type MatchSummary = {
    matchId: string;
    championName: string;
    win: boolean;
    kda: string;
    timestamp: number;
    queueId: number;
};

export type CoachingInsight = {
    timestamp: number; // in milliseconds
    timestampStr: string; // e.g. "15:20"
    title: string;
    description: string;
    type: 'MISTAKE' | 'TURNING_POINT' | 'GOOD_PLAY' | 'INFO';
    advice: string;
};

export type BuildItem = {
    id: number; // Item ID for Icon
    itemName: string;
    reason?: string; // Reason for recommendation or critique
};

export type BuildComparison = {
    userItems: BuildItem[];
    opponentItems?: BuildItem[];
    opponentChampionName?: string;
    recommendedItems: BuildItem[];
    analysis: string; // "Why X is better than Y"
};


export type SummaryAnalysis = {
    rootCause: string;
    rootCauseDetail?: string;
    priorityFocus: "REDUCE_DEATHS" | "OBJECTIVE_CONTROL" | "WAVE_MANAGEMENT" | "VISION_CONTROL" | "TRADING" | "POSITIONING" | "CS_EFFICIENCY" | "MAP_AWARENESS";
    actionPlan: string[];
    message: string;
};

export type TurningPoint = {
    timestamp: number;
    timestampStr: string;
    event: string;
    goldSwing: number;
    description: string;
    whatShouldHaveDone: string;
};

export type Homework = {
    title: string;
    description: string;
    howToCheck: string;
    relatedTimestamps: string[];
};

export type StrengthWeakness = {
    strengths: {
        category: string;
        value: string;
        comparison: string;
        comment?: string;
    }[];
    weaknesses: {
        category: string;
        value: string;
        comparison: string;
        comment?: string;
    }[];
};

export type RankAverages = {
    rank: string;
    avgDeaths: number;
    avgCS: number;
    avgVisionScore: number;
    avgKillParticipation: number;
};

export type AnalysisResult = {
    insights: CoachingInsight[];
    buildRecommendation?: BuildComparison;
    summaryAnalysis?: SummaryAnalysis;
    turningPoint?: TurningPoint;
    homework?: Homework;
    strengthWeakness?: StrengthWeakness;
};

export type AnalysisFocus = {
    focusArea: string;
    focusTime?: string;
    focusMode?: string;
    specificQuestion?: string;
    mode?: 'LANING' | 'MACRO' | 'TEAMFIGHT';
};
