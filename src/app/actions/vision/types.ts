export type VisionAnalysisRequest = {
    frames: string[]; // Base64 Data URLs
    question?: string;
    description?: string;
    matchId?: string; // For Hybrid Analysis
    puuid?: string;   // For Identification
    language?: 'ja' | 'en' | 'ko'; // Output language
    analysisStartGameTime?: number; // Game time in seconds when analysis starts
    analysisEndGameTime?: number;   // Game time in seconds when analysis ends
};

export type PlayerStatus = {
    hpPercent: number;
    manaPercent: number;
    level: number;
    ultimateReady: boolean | "unknown";
    summonerSpells: string;
    keyAbilitiesReady: string;
};

export type SituationSnapshot = {
    gameTime: string;
    myStatus: PlayerStatus;
    enemyStatus: PlayerStatus;
    environment: {
        minionAdvantage: string;
        wavePosition: string;
        junglerThreat: string;
        visionControl: string;
    };
};

export type TradeAnalysis = {
    tradeOccurred: boolean;
    outcome: "WIN" | "LOSE" | "EVEN" | "NO_TRADE";
    hpExchanged: {
        damageGiven: string;
        damageTaken: string;
    };
    reason: string;
    shouldHaveTraded: boolean;
    optimalAction: string;
    cooldownContext: string;
};

export type SkillEvaluation = {
    skill: string;
    used: boolean;
    hit: boolean | "N/A";
    timing: "PERFECT" | "GOOD" | "EARLY" | "LATE" | "MISSED_OPPORTUNITY";
    note: string;
};

export type DodgeEvaluation = {
    enemySkill: string;
    dodged: boolean;
    method: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
};

export type MechanicsEvaluation = {
    skillsUsed: SkillEvaluation[];
    skillsDodged: DodgeEvaluation[];
    autoAttackWeaving: "EXCELLENT" | "GOOD" | "NEEDS_WORK" | "POOR";
    comboExecution: string;
    positioningScore: "EXCELLENT" | "GOOD" | "RISKY" | "POOR";
    positioningNote: string;
};

export type Improvement = {
    priority: "HIGH" | "MEDIUM" | "LOW";
    category: "TRADING" | "DODGING" | "COOLDOWN_TRACKING" | "POSITIONING" | "COMBO" | "WAVE_CONTROL" | "RESOURCE_MANAGEMENT";
    title: string;
    currentBehavior: string;
    idealBehavior: string;
    practice: string;
    championSpecific: boolean;
};

export type VisionAnalysisResult = {
    observed_champions: { name: string; evidence: string }[];
    summary: string;
    mistakes: {
        timestamp: string;
        title: string;
        severity: "CRITICAL" | "MINOR";
        advice: string;
    }[];
    finalAdvice: string;
    timeOffset?: number;

    enhanced?: {
        situationSnapshot: SituationSnapshot;
        tradeAnalysis: TradeAnalysis;
        mechanicsEvaluation: MechanicsEvaluation;
        improvements: Improvement[];
        championContext: {
            championName: string;
            role: string;
            playstyleAdvice: string;
            keyCombo: string;
        };
        skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
        overallGrade: "S" | "A" | "B" | "C" | "D";
    };
};

export type MatchVerificationResult = {
    isValid: boolean;
    reason: string;
    detectedChampion?: string;
    confidence: number;
};
