import { fetchMatchTimeline, fetchMatchDetail, fetchDDItemData, fetchRank, fetchLatestVersion, extractMatchEvents, extractFrameStats, getChampionAttributes, buildParticipantRoleMap, getRelevantMacroAdvice, getEnhancedMacroAdvice } from "../riot";
import type { MacroAdviceContext } from "../riot";
import type { MatchV5Participant, TruthEvent, FrameStats, ChampionAttributes, ParticipantRoleMap } from "../riot/types";
import { getMatchContext } from "./helpers";
import type { BuildItem, AnalysisFocus } from "./types";
import { logger } from "@/lib/logger";

export type MatchAnalysisContext = {
    userPart: MatchV5Participant;
    opponentPart: MatchV5Participant | undefined;
    userItems: BuildItem[];
    opponentItems: BuildItem[];
    opponentItemsStr: string;
    events: TruthEvent[];
    keyFrameStats: FrameStats[];
    rankTier: string;
    champAttrs: ChampionAttributes | null;
    roleMap: ParticipantRoleMap;
    combinedMacroAdvice: string;
    latestVersion: string;
    itemMap: Record<string, string>;
    idMap: Record<string, { name: string }>;
};

/**
 * Fetches all match data, builds context, and extracts events for coaching analysis.
 */
export async function buildAnalysisContext(
    matchId: string,
    puuid: string,
    focus?: AnalysisFocus
): Promise<{ success: true; context: MatchAnalysisContext } | { success: false; error: string }> {
    // 1. Fetch Data
    const [timelineRes, matchRes, ddItemRes, latestVersion] = await Promise.all([
        fetchMatchTimeline(matchId),
        fetchMatchDetail(matchId),
        fetchDDItemData(),
        fetchLatestVersion()
    ]);

    if (!timelineRes.success || !timelineRes.data) return { success: false, error: "Failed to fetch timeline" };
    if (!matchRes.success || !matchRes.data) return { success: false, error: "Failed to fetch match details" };

    const timeline = timelineRes.data;
    const match = matchRes.data;
    const itemMap = ddItemRes?.nameMap || {};
    const idMap = ddItemRes?.idMap || {};

    // 2. Build Match Context
    const matchContext = getMatchContext(match, puuid, timeline);
    if (!matchContext) return { success: false, error: "Participant analysis failed" };

    const { userPart, opponentPart, userPid, opponentPid } = matchContext;

    // 3. Fetch Rank
    let rankTier = "UNRANKED";
    try {
        const ranks = await fetchRank(userPart.summonerId);
        const soloDuo = ranks.find((r) => r.queueType === "RANKED_SOLO_5x5");
        if (soloDuo) rankTier = soloDuo.tier;
    } catch (e) {
        logger.warn("Rank fetch failed, using UNRANKED", e);
    }

    // 4. Extract Items
    const userItemIds = [
        userPart.item0, userPart.item1, userPart.item2,
        userPart.item3, userPart.item4, userPart.item5
    ].filter((id: number) => id > 0);

    const userItems: BuildItem[] = userItemIds.map((id: number) => ({
        id,
        itemName: idMap[id]?.name || `Item ${id}`
    }));

    let opponentItemsStr = "不明";
    let opponentItems: BuildItem[] = [];

    if (opponentPart) {
        const oppItemIds = [
            opponentPart.item0, opponentPart.item1, opponentPart.item2,
            opponentPart.item3, opponentPart.item4, opponentPart.item5
        ].filter((id: number) => id > 0);

        const oppItems = oppItemIds.map((id: number) => idMap[id]?.name || `Item ${id}`);
        if (oppItems.length > 0) opponentItemsStr = oppItems.join(', ');

        opponentItems = oppItemIds.map((id: number) => ({
            id,
            itemName: idMap[id]?.name || `Item ${id}`
        }));
    }

    // 5. Build Role Map & Extract Events
    const roleMap = await buildParticipantRoleMap(match);

    let timeRange: { startMs: number, endMs: number } | undefined;
    if (focus?.mode === 'LANING') {
        timeRange = { startMs: 0, endMs: 900000 };
    } else if (focus?.mode === 'TEAMFIGHT') {
        timeRange = { startMs: 900000, endMs: 3600000 };
    }

    const rawEvents = await extractMatchEvents(timeline, puuid, timeRange, opponentPid, roleMap);

    // 6. Extract frame statistics
    const frameStats = await extractFrameStats(timeline, puuid, opponentPid);

    // Priority sorting
    const priorityOrder: Record<string, number> = {
        'DEATH': 1, 'OBJECTIVE': 2, 'TURRET': 3, 'KILL': 4,
        'WARD': 5, 'ITEM': 6, 'LEVEL': 7
    };
    const sortedEvents = rawEvents.sort((a, b) => {
        const aPriority = priorityOrder[a.type] || 99;
        const bPriority = priorityOrder[b.type] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.timestamp - b.timestamp;
    });

    const events = sortedEvents.slice(0, 50);
    const keyFrameStats = frameStats.filter((_, i) => i % 5 === 0 || i === frameStats.length - 1);

    // 7. Champion Attributes & Macro Advice
    const champAttrs = await getChampionAttributes(userPart.championName);

    const latestFrameStat = keyFrameStats[keyFrameStats.length - 1];
    const avgGoldDiff = latestFrameStat?.goldDiff || 0;
    const avgCsDiff = latestFrameStat?.csDiff || 0;
    const gameDurationMs = match.info.gameDuration * 1000;

    const userDeaths = events.filter(e => e.type === 'DEATH');
    const deathCount = userDeaths.length;

    const enemyObjectiveEvents = events.filter(e =>
        (e.type === 'OBJECTIVE' || e.type === 'TURRET') &&
        e.context?.isAllyObjective === false
    );

    let focusModeForMacro: 'LANING' | 'MACRO' | 'TEAMFIGHT' = 'MACRO';
    if (focus?.mode === 'LANING') focusModeForMacro = 'LANING';
    else if (focus?.mode === 'TEAMFIGHT') focusModeForMacro = 'TEAMFIGHT';

    const macroContext: MacroAdviceContext = {
        goldDiff: avgGoldDiff,
        gameTimeMs: gameDurationMs,
        userRole: userPart.teamPosition,
        events: events,
        focusMode: focusModeForMacro,
        deathCount: deathCount,
        csDiff: avgCsDiff,
        enemyObjectivesTaken: enemyObjectiveEvents.map(e => e.context?.objectiveType || 'UNKNOWN')
    };

    const generalMacroAdvice = await getEnhancedMacroAdvice(macroContext, undefined, undefined);

    let objectiveMacroAdvice = "";
    if (enemyObjectiveEvents.length > 0) {
        const objPriority: Record<string, number> = {
            'BARON_NASHOR': 1, 'BARON': 1, 'DRAGON': 2, 'ELDER_DRAGON': 1,
            'RIFT_HERALD': 3, 'HORDE': 4, 'TOWER_BUILDING': 5
        };

        const sortedObjectives = enemyObjectiveEvents.sort((a, b) => {
            const aP = objPriority[a.context?.objectiveType || ''] || 99;
            const bP = objPriority[b.context?.objectiveType || ''] || 99;
            return aP - bP;
        });

        const mostImpactfulEvent = sortedObjectives[0];
        if (mostImpactfulEvent) {
            objectiveMacroAdvice = await getRelevantMacroAdvice(
                avgGoldDiff,
                mostImpactfulEvent.timestamp,
                mostImpactfulEvent.context?.objectiveType,
                false,
                userPart.teamPosition
            );
        }
    }

    const combinedMacroAdvice = [generalMacroAdvice, objectiveMacroAdvice].filter(Boolean).join('\n\n');

    return {
        success: true,
        context: {
            userPart,
            opponentPart,
            userItems,
            opponentItems,
            opponentItemsStr,
            events,
            keyFrameStats,
            rankTier,
            champAttrs,
            roleMap,
            combinedMacroAdvice,
            latestVersion,
            itemMap,
            idMap,
        }
    };
}
