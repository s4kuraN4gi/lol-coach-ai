/**
 * Barrel file — re-exports from videoMacro/ submodules.
 * Existing import paths (e.g. "@/app/actions/videoMacroAnalysis") remain valid.
 */

// Types
export type {
    VideoMacroSegment,
    VideoMacroAnalysisRequest,
    SegmentAnalysis,
    BuildItem,
    BuildRecommendation,
    VideoMacroAnalysisResult,
    MatchContext,
} from "./videoMacro/types";

// Time detection
export { detectGameTimeFromFrame } from "./videoMacro/timeDetection";

// Segment selection
export { selectAnalysisSegments } from "./videoMacro/segmentSelection";

// Main analysis
export { analyzeVideoMacro } from "./videoMacro/analyze";

// Async job-based analysis
export {
    startVideoMacroAnalysis,
    getVideoMacroJobStatus,
    getLatestMacroAnalysisForMatch,
} from "./videoMacro/asyncJob";
