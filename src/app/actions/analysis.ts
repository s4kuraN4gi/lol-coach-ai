/**
 * Barrel file -- re-exports from analysis/ submodules.
 * Existing import paths (e.g. "@/app/actions/analysis") remain valid.
 */

// Status
export {
    getAnalysisStatus,
    refreshAnalysisStatus,
    getVideoAnalysisStatus,
    getLatestActiveAnalysis,
} from "./analysis/status";

// Credit & subscription management
export {
    downgradeToFree,
    claimDailyReward,
    syncSubscriptionStatus,
    checkWeeklyLimit,
    incrementAnalysisCount,
} from "./analysis/credit";

// Match analysis
export {
    getMatchAnalysis,
    getAnalyzedMatchIds,
    analyzeMatchQuick,
    analyzeMatch,
} from "./analysis/matchAnalysis";

// Video analysis
export { analyzeVideo } from "./analysis/videoAnalysis";

// Job status
export {
    getAnalysisJobStatus,
    getLatestMicroAnalysisForMatch,
} from "./analysis/job";
