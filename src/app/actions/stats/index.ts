/**
 * Barrel file -- re-exports from stats/ submodules.
 * Existing import paths (e.g. "@/app/actions/stats") remain valid.
 */

// Types
export type {
    ChampionStat,
    RadarStats,
    UniqueStats,
    QuickStats,
    RoleStats,
    DashboardStatsDTO,
    RankHistoryEntry,
    BasicStatsDTO,
    MatchStatsDTO,
    MonthlyStats,
    CoachFeedbackSummary,
    ProfileEnhancedData,
    RankGoal,
} from "./types";

// Rank history
export { recordRankHistory, fetchRankHistory } from "./rankHistory";

// Match stats (cache-first architecture)
export {
    fetchBasicStats,
    getStatsFromCache,
    checkForUpdates,
    fetchMatchStats,
} from "./matchStats";

// Profile enhanced data
export { fetchProfileEnhancedData } from "./profileEnhanced";

// Rank goal
export { getRankGoal, setRankGoal, clearRankGoal } from "./rankGoal";

// Full update orchestrator
export { performFullUpdate } from "./fullUpdate";
