// ============================================================
// TYPES
// ============================================================

export type VideoMacroSegment = {
    segmentId: number;
    type: 'OBJECTIVE' | 'DEATH' | 'TURNING_POINT';
    targetTimestamp: number;      // Game time in ms
    targetTimestampStr: string;   // "mm:ss"
    analysisStartTime: number;    // 30 seconds before target
    analysisEndTime: number;      // Target time
    eventDescription: string;     // What happened at this timestamp
};

export type VideoMacroAnalysisRequest = {
    matchId: string;
    puuid: string;
    segments: VideoMacroSegment[];
    frames: {
        segmentId: number;
        frameIndex: number;
        gameTime: number;
        base64Data: string;  // Base64 image data
    }[];
    language?: 'ja' | 'en' | 'ko';  // Output language
    timeOffset?: number;  // Video time offset (videoTime = gameTime + timeOffset)
};

export type SegmentAnalysis = {
    segmentId: number;
    type: 'OBJECTIVE' | 'DEATH' | 'TURNING_POINT';
    timestamp: string;

    // What we observed
    observation: {
        userPosition: string;        // Where was the user on minimap
        allyPositions: string;       // Where were allies
        enemyPositions: string;      // Visible enemy positions
        waveState: string;           // Wave positions on minimap
        objectiveState: string;      // Dragon/Baron timer if visible
    };

    // The winning pattern
    winningPattern: {
        title: string;               // e.g., "ドラゴン準備の正しい動き"
        steps: string[];             // Step-by-step what should happen
        macroConceptUsed: string;    // e.g., "Push and Rotate"
    };

    // What actually happened vs winning pattern
    gap: {
        description: string;         // The difference
        criticalMoment: string;      // When the decision diverged
        whatShouldHaveDone: string;  // Specific action
    };
};

export type BuildItem = {
    id: number;
    itemName: string;
};

export type BuildRecommendation = {
    userItems: BuildItem[];
    userChampionName: string;
    opponentItems: BuildItem[];
    opponentChampionName: string;
    recommendedItems: BuildItem[];
    analysis: string;  // AI-generated advice
};

export type VideoMacroAnalysisResult = {
    success: boolean;
    matchId: string;
    analyzedAt: string;
    segments: SegmentAnalysis[];
    overallSummary: {
        mainIssue: string;           // The biggest macro problem
        homework: {
            title: string;
            description: string;
            howToCheck: string;
            relatedTimestamps: string[];  // Related scene timestamps for review
        };
    };
    buildRecommendation?: BuildRecommendation;  // Build advice
    error?: string;
    warnings?: string[];  // Segment-level errors or warnings
    requestedSegments?: number;  // How many segments were requested
    completedSegments?: number;  // How many were successfully analyzed
    timeOffset?: number;  // Video time offset for seek (videoTime = gameTime + timeOffset)
};

export type MatchContext = {
    myChampion: string;
    myRole: string;
    myRoleJp: string;
    myRoleLocalized: string;
    allies: string[];
    enemies: string[];
    goldDiff: number;
};
