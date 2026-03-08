import type { BuildItem, AnalysisResult, SummaryAnalysis, TurningPoint, Homework, StrengthWeakness, CoachingInsight } from "./types";
import { logger } from "@/lib/logger";

/** Raw AI response shape before post-processing */
export type RawAIAnalysisResult = {
    buildRecommendation?: {
        recommendedItems?: Array<{ itemName: string; id?: number }>;
        analysis?: string;
    };
    insights?: Array<{ timestamp: number; timestampStr?: string; [key: string]: unknown }>;
    summaryAnalysis?: SummaryAnalysis;
    turningPoint?: TurningPoint;
    homework?: Homework;
    strengthWeakness?: StrengthWeakness;
};

/**
 * Post-process AI result: map item names to IDs, validate insights against truth events.
 */
export function postprocessAnalysisResult(
    analysisResult: RawAIAnalysisResult,
    userItems: BuildItem[],
    opponentItems: BuildItem[],
    opponentChampionName: string,
    itemMap: Record<string, string>,
    events: { timestamp: number; [key: string]: unknown }[]
): { success: true; data: AnalysisResult } | { success: false; error: string } {
    // Safety check for buildRecommendation
    if (!analysisResult.buildRecommendation || !analysisResult.buildRecommendation.recommendedItems) {
        logger.error("[Coach] Invalid response structure - missing buildRecommendation or recommendedItems");
        logger.error("[Coach] Raw response:", JSON.stringify(analysisResult).substring(0, 500));
        return { success: false, error: "AI returned invalid response structure. Please try again." };
    }

    // Safety check for insights
    if (!analysisResult.insights || !Array.isArray(analysisResult.insights)) {
        logger.error("[Coach] Invalid response structure - missing or invalid insights");
        analysisResult.insights = [];
    }

    // Map recommended item names to IDs
    const normalizeRegex = /[\s\u3000\t・:：]+/g;
    const recommendedWithIds = analysisResult.buildRecommendation.recommendedItems.map((item) => {
        const lowerName = item.itemName.toLowerCase().replace(normalizeRegex, '');

        let id = 0;
        for (const [key, val] of Object.entries(itemMap)) {
            if (key.replace(normalizeRegex, '') === lowerName) {
                id = parseInt(val);
                break;
            }
        }

        return { ...item, id };
    });

    // Filter out unknown items
    const validatedRecommendedItems = recommendedWithIds.filter((item) => {
        if (item.id === 0) {
            logger.warn(`[Item Validation] Unknown item "${item.itemName}" - possibly hallucinated or outdated`);
            return false;
        }
        return true;
    });

    // Cross-check insights with Truth Events (±60s tolerance)
    const validatedInsights = analysisResult.insights.filter((insight) => {
        const insightTs = insight.timestamp;
        const hasMatchingEvent = events.some((e) => Math.abs(e.timestamp - insightTs) < 60000);
        if (!hasMatchingEvent) {
            logger.warn(`[Validation] Filtered insight at ${insight.timestampStr}: No matching Truth Event`);
        }
        return hasMatchingEvent;
    });

    const finalResult: AnalysisResult = {
        insights: validatedInsights as CoachingInsight[],
        buildRecommendation: {
            userItems,
            opponentItems,
            opponentChampionName,
            recommendedItems: validatedRecommendedItems,
            analysis: analysisResult.buildRecommendation.analysis || ''
        },
        summaryAnalysis: analysisResult.summaryAnalysis,
        turningPoint: analysisResult.turningPoint,
        homework: analysisResult.homework,
        strengthWeakness: analysisResult.strengthWeakness
    };

    return { success: true, data: finalResult };
}
