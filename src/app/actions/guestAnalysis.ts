/**
 * Barrel file -- re-exports from guestAnalysis/ submodules.
 * Existing import paths (e.g. "@/app/actions/guestAnalysis") remain valid.
 */

// Types
export type {
    FreeSegmentInfo,
    GuestAnalysisRequest,
    GuestSegmentAnalysis,
    GuestAnalysisResult,
    GuestMicroAnalysisRequest,
    GuestMicroAnalysisResult,
} from "./guestAnalysis/shared";

// Macro analysis
export { canPerformGuestAnalysis, performGuestAnalysis } from "./guestAnalysis/macro";

// Micro analysis
export { performGuestMicroAnalysis } from "./guestAnalysis/micro";
