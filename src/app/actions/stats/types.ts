'use server'

import type { LeagueEntryDTO } from "../riot";

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
    survival: { csAdvantage: number, csAt10: number };
    clutch: { closeWr: number, stompWr: number, closeGames: number, stompGames: number };
}

export type QuickStats = {
    csPerMin: number;
    visionPerMin: number;
    kda: number;
    killParticipation: number;
    avgDamage: number;
    gamesAnalyzed: number;
}

export type RoleStats = {
    TOP: number;
    JUNGLE: number;
    MIDDLE: number;
    BOTTOM: number;
    UTILITY: number;
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

// === RANK HISTORY TYPES ===

export type RankHistoryEntry = {
    id: string;
    puuid: string;
    queue_type: string;
    tier: string | null;
    rank: string | null;
    league_points: number | null;
    wins: number | null;
    losses: number | null;
    recorded_at: string; // YYYY-MM-DD
    created_at: string;
}

export type BasicStatsDTO = {
    ranks: LeagueEntryDTO[];
    debugLog: string[];
}

export type MatchStatsDTO = {
    recentMatches: { win: boolean; timestamp: number }[];
    championStats: ChampionStat[];
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
    quickStats: QuickStats | null;
    roleStats: RoleStats | null;
    debugLog: string[];
}

// === PROFILE ENHANCED DATA TYPES ===

export type MonthlyStats = {
    month: string; // "2026-02" format
    rankedGames: number;
    wins: number;
    losses: number;
    winRate: number;
}

export type CoachFeedbackSummary = {
    macroAnalyses: number;
    microAnalyses: number;
    macroIssues: { concept: string; count: number }[];
    microIssues: { category: string; count: number }[];
}

export type ProfileEnhancedData = {
    monthlyStats: MonthlyStats | null;
    coachFeedback: CoachFeedbackSummary | null;
}

// === RANK GOAL TYPES ===

export type RankGoal = {
    tier: string;
    rank: string;
    setAt: string; // ISO timestamp
}
