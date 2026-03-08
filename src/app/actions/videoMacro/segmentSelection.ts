'use server';

import { fetchMatchDetail, fetchMatchTimeline, extractMatchEvents, type TruthEvent } from "../riot";
import { matchIdSchema, puuidSchema, localeSchema } from "@/lib/validation";
import type { VideoMacroSegment } from "./types";
import { logger } from "@/lib/logger";

/**
 * Select 5 key segments from match events for macro analysis
 * Priority: Dragon/Baron > Deaths near objectives > Other deaths
 */
export async function selectAnalysisSegments(
    matchId: string,
    puuid: string,
    language: 'ja' | 'en' | 'ko' = 'ja',
    maxSegments: number = 2  // Free: 2, Premium: 4, Extra: 5
): Promise<{ success: boolean; segments?: VideoMacroSegment[]; error?: string }> {
    if (!matchIdSchema.safeParse(matchId).success) return { success: false, error: "Invalid match ID" };
    if (!puuidSchema.safeParse(puuid).success) return { success: false, error: "Invalid PUUID" };
    if (!localeSchema.safeParse(language).success) language = 'ja';
    // Translation templates for event descriptions
    const eventDescriptions = {
        ja: {
            objectiveSecured: (type: string) => `敵チームが${type || 'オブジェクト'}を獲得`,
            turningPoint: (detail: string) => `ターニングポイント: ${detail}`,
            objectiveFallback: 'オブジェクト'
        },
        en: {
            objectiveSecured: (type: string) => `Enemy team secured ${type || 'Objective'}`,
            turningPoint: (detail: string) => `Turning Point: ${detail}`,
            objectiveFallback: 'Objective'
        },
        ko: {
            objectiveSecured: (type: string) => `적 팀이 ${type || '오브젝트'}를 획득`,
            turningPoint: (detail: string) => `터닝 포인트: ${detail}`,
            objectiveFallback: '오브젝트'
        }
    };
    const desc = eventDescriptions[language];
    try {
        const [matchRes, timelineRes] = await Promise.all([
            fetchMatchDetail(matchId),
            fetchMatchTimeline(matchId)
        ]);

        if (!matchRes.success || !matchRes.data) {
            logger.error("[selectAnalysisSegments] fetchMatchDetail failed:", matchRes.error);
            return { success: false, error: `Failed to fetch match data: ${matchRes.error || 'unknown'}` };
        }
        if (!timelineRes.success || !timelineRes.data) {
            logger.error("[selectAnalysisSegments] fetchMatchTimeline failed:", timelineRes.error);
            return { success: false, error: `Failed to fetch timeline: ${timelineRes.error || 'unknown'}` };
        }

        // Extract events (pass language for i18n)
        const events = await extractMatchEvents(timelineRes.data, puuid, undefined, undefined, undefined, language);

        // Categorize events
        const objectiveEvents = events.filter(e =>
            e.type === 'OBJECTIVE' && e.context?.isAllyObjective === false
        );
        const deathEvents = events.filter(e => e.type === 'DEATH');

        // Find turning point (biggest gold swing)
        let turningPoint: TruthEvent | null = null;
        let maxGoldSwing = 0;
        for (const event of events) {
            const goldDiff = Math.abs(event.context?.goldDiff || 0);
            if (goldDiff > maxGoldSwing && event.type !== 'WARD') {
                maxGoldSwing = goldDiff;
                turningPoint = event;
            }
        }

        // Build segments (max based on plan)
        const segments: VideoMacroSegment[] = [];
        let segmentId = 0;

        // 1. First objective lost (if any)
        if (objectiveEvents.length > 0) {
            const firstObj = objectiveEvents[0];
            segments.push({
                segmentId: segmentId++,
                type: 'OBJECTIVE',
                targetTimestamp: firstObj.timestamp,
                targetTimestampStr: firstObj.timestampStr,
                analysisStartTime: Math.max(0, firstObj.timestamp - 30000),
                analysisEndTime: firstObj.timestamp,
                eventDescription: desc.objectiveSecured(firstObj.context?.objectiveType || desc.objectiveFallback)
            });
        }

        // 2. First death
        if (deathEvents.length > 0 && segments.length < maxSegments) {
            const firstDeath = deathEvents[0];
            segments.push({
                segmentId: segmentId++,
                type: 'DEATH',
                targetTimestamp: firstDeath.timestamp,
                targetTimestampStr: firstDeath.timestampStr,
                analysisStartTime: Math.max(0, firstDeath.timestamp - 30000),
                analysisEndTime: firstDeath.timestamp,
                eventDescription: `${firstDeath.detail}`
            });
        }

        // 3. Second objective or death near objective
        const secondObj = objectiveEvents[1];
        if (secondObj && segments.length < maxSegments) {
            segments.push({
                segmentId: segmentId++,
                type: 'OBJECTIVE',
                targetTimestamp: secondObj.timestamp,
                targetTimestampStr: secondObj.timestampStr,
                analysisStartTime: Math.max(0, secondObj.timestamp - 30000),
                analysisEndTime: secondObj.timestamp,
                eventDescription: desc.objectiveSecured(secondObj.context?.objectiveType || desc.objectiveFallback)
            });
        }

        // 4. Turning point
        if (turningPoint && segments.length < maxSegments) {
            // Check if not already included
            const isDuplicate = segments.some(s =>
                Math.abs(s.targetTimestamp - turningPoint!.timestamp) < 60000
            );
            if (!isDuplicate) {
                segments.push({
                    segmentId: segmentId++,
                    type: 'TURNING_POINT',
                    targetTimestamp: turningPoint.timestamp,
                    targetTimestampStr: turningPoint.timestampStr,
                    analysisStartTime: Math.max(0, turningPoint.timestamp - 30000),
                    analysisEndTime: turningPoint.timestamp,
                    eventDescription: desc.turningPoint(turningPoint.detail)
                });
            }
        }

        // 5. Fill remaining with deaths
        for (const death of deathEvents) {
            if (segments.length >= maxSegments) break;
            const isDuplicate = segments.some(s =>
                Math.abs(s.targetTimestamp - death.timestamp) < 60000
            );
            if (!isDuplicate) {
                segments.push({
                    segmentId: segmentId++,
                    type: 'DEATH',
                    targetTimestamp: death.timestamp,
                    targetTimestampStr: death.timestampStr,
                    analysisStartTime: Math.max(0, death.timestamp - 30000),
                    analysisEndTime: death.timestamp,
                    eventDescription: death.detail
                });
            }
        }

        // Sort by timestamp
        segments.sort((a, b) => a.targetTimestamp - b.targetTimestamp);

        // Re-assign segment IDs after sorting
        segments.forEach((s, idx) => s.segmentId = idx);

        return { success: true, segments };
    } catch (error) {
        logger.error("[selectAnalysisSegments] Error:", error);
        return { success: false, error: "SEGMENT_SELECTION_FAILED" };
    }
}
