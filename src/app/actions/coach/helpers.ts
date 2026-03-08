import type { RankAverages } from "./types";
import type { MatchV5Response, MatchV5Participant, TimelineV5Response, TimelineFrame, TimelineEvent as RiotTimelineEvent } from "../riot/types";

// Helper: Extract Match Context (User + Opponent + Runes)
export function getMatchContext(match: MatchV5Response, puuid: string, timeline?: TimelineV5Response) {
    const participants = match.info.participants;
    const userPart = participants.find((p) => p.puuid === puuid);

    if (!userPart) return null;

    // Find direct opponent (Same position, different team)
    const opponentPart = participants.find((p) =>
        p.teamId !== userPart.teamId &&
        p.teamPosition === userPart.teamPosition &&
        p.teamPosition !== ''
    );

    // Get Participant IDs from timeline (1-10 based on team)
    let userPid = 0;
    let opponentPid = 0;

    if (timeline?.info?.participants) {
        const timelineParticipants = timeline.info.participants;
        const userTimelinePart = timelineParticipants.find((p) => p.puuid === puuid);
        if (userTimelinePart) userPid = userTimelinePart.participantId;

        if (opponentPart) {
            const oppTimelinePart = timelineParticipants.find((p) => p.puuid === opponentPart.puuid);
            if (oppTimelinePart) opponentPid = oppTimelinePart.participantId;
        }
    } else {
        // Fallback: Use match participant index (not always reliable)
        const userIndex = participants.findIndex((p) => p.puuid === puuid);
        userPid = userIndex + 1;
        if (opponentPart) {
            const oppIndex = participants.findIndex((p) => p.puuid === opponentPart.puuid);
            opponentPid = oppIndex + 1;
        }
    }

    return { userPart, opponentPart, userPid, opponentPid };
}

// Helper: Summarize Timeline (Heuristic with Objectives & Context)
export function summarizeTimeline(
    timeline: TimelineV5Response,
    userId: number,
    opponentId?: number,
    mode: 'LANING' | 'MACRO' | 'TEAMFIGHT' = 'MACRO'
) {
    const events: Record<string, unknown>[] = [];
    const frames = timeline.info.frames;

    // Track Last Recall or Spawn for "Uptime"
    let lastSpawnTime = 0;

    // Pre-scan for Vision Events (Ward Placed) to optimize lookup
    const wardEvents: { timestamp: number, x: number, y: number }[] = [];
    frames.forEach((f: TimelineFrame) => {
        f.events.forEach((e: RiotTimelineEvent) => {
            if (e.type === 'WARD_PLACED' && e.creatorId === userId) {
                wardEvents.push({ timestamp: e.timestamp, x: e.position?.x || 0, y: e.position?.y || 0 });
            }
        });
    });

    frames.forEach((frame: TimelineFrame) => {
        // Mode Filtering Logic
        // LANING: Only events before 15 min (900000 ms)
        // TEAMFIGHT: Only events after 15 min
        if (mode === 'LANING' && frame.timestamp > 900000) return;
        if (mode === 'TEAMFIGHT' && frame.timestamp < 900000) return;

        // Update user state from frame
        const userFrame = frame.participantFrames?.[userId.toString()];
        const currentGold = userFrame?.currentGold || 0;
        const userPos = userFrame?.position || { x: 0, y: 0 };

        const relevantEvents = frame.events.filter((e: RiotTimelineEvent) => {
             // 1. Champion Kill (User or Opponent involved)
             if (e.type === 'CHAMPION_KILL') {
                 // Update Spawn time on death? No, on respawn?
                 // We just track death time.
                 if (e.victimId === userId) {
                     lastSpawnTime = e.timestamp; // Reset uptime counter roughly
                     return true;
                 }
                 return e.killerId === userId || e.assistingParticipantIds?.includes(userId) ||
                        (opponentId && (e.killerId === opponentId || e.victimId === opponentId));
             }
             // 2. Objectives
             if (e.type === 'ELITE_MONSTER_KILL') return true;

             // 3. Turrets
             if (e.type === 'BUILDING_KILL') {
                 // Filter relevant ones
                 return true;
             }

             // 4. Mode Specific Events
             if (mode === 'LANING' && e.type === 'SKILL_LEVEL_UP' && e.participantId === userId) {
                 return true; // Trace skill order in laning
             }

             return false; // Skip items for prompt brevity unless specialized
        });

        relevantEvents.forEach((e: RiotTimelineEvent) => {
            if (e.type === 'CHAMPION_KILL' && e.victimId === userId) {
                // --- Analyze Death Context ---
                const assistCount = e.assistingParticipantIds ? e.assistingParticipantIds.length : 0;
                const isSolo = assistCount === 0;
                const timeSinceLastSpawn = ((e.timestamp - lastSpawnTime) / 60000).toFixed(1); // mins

                // Vision Check: Any ward placed near user in last 90s?
                // We assume we look for wards placed ROUGHLY near death spot.
                // Death event has x,y usually.
                const deathX = e.position?.x || userPos.x;
                const deathY = e.position?.y || userPos.y;

                const recentWards = wardEvents.filter(w =>
                    w.timestamp < e.timestamp &&
                    w.timestamp > (e.timestamp - 90000) &&
                    getDistance(w.x, w.y, deathX, deathY) < 2000
                );
                const hasNearbyVision = recentWards.length > 0;

                events.push({
                    type: "USER_DIED",
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    category: isSolo ? "SOLO_KILL_LOSS" : "GANK_OR_TEAMFIGHT",
                    killerId: e.killerId,
                    assists: assistCount,
                    context: {
                        goldOnHand: currentGold,
                        nearbyVision: hasNearbyVision,
                        timeAliveMins: timeSinceLastSpawn,
                        isSolo: isSolo
                    },
                    details: isSolo
                        ? `1v1 Defeat against ${e.killerId}`
                        : `Caught by ${e.killerId} + ${assistCount} others`
                });
            } else if (e.type === 'SKILL_LEVEL_UP') {
                // Simplified Skill Event
                events.push({
                    type: "SKILL_UP",
                    timestamp: e.timestamp,
                    skill: e.skillSlot, // 1=Q, 2=W, 3=E, 4=R
                    level: e.levelUpType
                });
            } else {
                events.push({
                    type: e.type,
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    details: formatEventDetails(e, userId, opponentId)
                });
            }
        });
    });

    return events;
}

export function formatEventDetails(e: RiotTimelineEvent, uid: number, oid?: number) {
    if (e.type === 'CHAMPION_KILL') {
         if (e.victimId === uid) return "User DIED"; // Handled above but fallback
         if (e.killerId === uid) return `User KILLED (Victim: ${e.victimId})`;
         if (oid && e.killerId === oid) return `Opponent KILLED someone`;
         if (oid && e.victimId === oid) return `Opponent DIED`;
         return `Teamfight (User Assist)`;
    }
    if (e.type === 'ELITE_MONSTER_KILL') return `${e.monsterType} taken by ${e.killerId}`;
    if (e.type === 'BUILDING_KILL') return `Turret Destroyed`;
    return e.type;
}

export function getDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getTeamIdFromPid(pid: number, timeline: TimelineV5Response) {
    return pid <= 5 ? 100 : 200;
}

// Helper: Get Rank-specific average stats for comparison
export function getRankAverages(rank: string): RankAverages {
    // Data based on LoL statistics from various sources (approximate averages)
    const rankData: Record<string, RankAverages> = {
        'IRON': { rank: 'IRON', avgDeaths: 8.5, avgCS: 4.5, avgVisionScore: 12, avgKillParticipation: 45 },
        'BRONZE': { rank: 'BRONZE', avgDeaths: 7.8, avgCS: 5.0, avgVisionScore: 15, avgKillParticipation: 48 },
        'SILVER': { rank: 'SILVER', avgDeaths: 6.8, avgCS: 5.5, avgVisionScore: 18, avgKillParticipation: 52 },
        'GOLD': { rank: 'GOLD', avgDeaths: 5.8, avgCS: 6.0, avgVisionScore: 22, avgKillParticipation: 55 },
        'PLATINUM': { rank: 'PLATINUM', avgDeaths: 5.2, avgCS: 6.5, avgVisionScore: 26, avgKillParticipation: 58 },
        'EMERALD': { rank: 'EMERALD', avgDeaths: 4.8, avgCS: 7.0, avgVisionScore: 30, avgKillParticipation: 60 },
        'DIAMOND': { rank: 'DIAMOND', avgDeaths: 4.5, avgCS: 7.5, avgVisionScore: 35, avgKillParticipation: 62 },
        'MASTER': { rank: 'MASTER', avgDeaths: 4.2, avgCS: 8.0, avgVisionScore: 40, avgKillParticipation: 65 },
        'GRANDMASTER': { rank: 'GRANDMASTER', avgDeaths: 4.0, avgCS: 8.5, avgVisionScore: 45, avgKillParticipation: 68 },
        'CHALLENGER': { rank: 'CHALLENGER', avgDeaths: 3.8, avgCS: 9.0, avgVisionScore: 50, avgKillParticipation: 70 },
        'UNRANKED': { rank: 'UNRANKED', avgDeaths: 6.5, avgCS: 5.5, avgVisionScore: 18, avgKillParticipation: 50 }
    };

    const normalizedRank = rank.toUpperCase();
    return rankData[normalizedRank] || rankData['UNRANKED'];
}
