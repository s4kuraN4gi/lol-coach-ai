/**
 * Barrel file — re-exports from coach/ submodules.
 * Existing import paths (e.g. "@/app/actions/coach") remain valid.
 */

// Types
export type {
    MatchSummary,
    CoachingInsight,
    BuildItem,
    BuildComparison,
    SummaryAnalysis,
    TurningPoint,
    Homework,
    StrengthWeakness,
    RankAverages,
    AnalysisResult,
    AnalysisFocus,
} from "./coach/types";

// Match summary actions
export { getMatchSummary, getCoachMatches } from "./coach/matchSummary";

// Main analysis action
export { analyzeMatchTimeline } from "./coach/analyze";
