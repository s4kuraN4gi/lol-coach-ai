'use server'

import { logger } from "@/lib/logger";
import { RIOT_API_KEY, REGION_ROUTING, delay } from "./constants";
import type {
    TruthEvent,
    FrameStats,
    ParticipantRole,
    ParticipantRoleMap,
    MatchV5Response,
    MatchV5Participant,
    TimelineV5Response,
    TimelineFrame,
    TimelineEvent as RiotTimelineEvent,
    TimelineParticipant,
    ParticipantFrame,
} from "./types";

// 4. Get Match IDs by PUUID
export async function fetchMatchIds(puuid: string, count: number = 20, queue?: number, type?: string, championId?: number, retries = 3): Promise<{ success: boolean, data?: string[], error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "Server Configuration Error: RIOT_API_KEY is missing" };

    // Ensure region is correct. JP1 -> asia
    let url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;

    if (queue) url += `&queue=${queue}`;
    if (type) url += `&type=${type}`;
    if (championId) url += `&champion=${championId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            cache: 'no-store'
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            await delay((retryAfter + 1) * 1000); // Wait +1s buffer
            return fetchMatchIds(puuid, count, queue, type, championId, retries - 1);
        }

        if (!res.ok) {
            const body = await res.text();
            logger.error(`MatchIDs API Error (${res.status}) URL: ${url} Body: ${body}`);
            return { success: false, error: `Riot API Error (${res.status}): ${res.statusText}` };
        }

        const data = await res.json();
        return { success: true, data };
    } catch (e) {
        logger.error("fetchMatchIds exception:", e);
        return { success: false, error: "RIOT_API_ERROR" };
    }
}

// 5. Get Match Details by MatchID
export async function fetchMatchDetail(matchId: string, retries = 3): Promise<{ success: boolean, data?: MatchV5Response, error?: string, retryAfterMs?: number }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };

    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 86400 } // 24h cache - match data is immutable
        });

        if (res.status === 429) {
            const retryAfterSec = parseInt(res.headers.get("Retry-After") || "1");
            if (retries > 0) {
                await delay((retryAfterSec + 1) * 1000);
                return fetchMatchDetail(matchId, retries - 1);
            }
            // Retries exhausted — propagate Retry-After to caller
            return { success: false, error: `Match Detail Error (429)`, retryAfterMs: retryAfterSec * 1000 };
        }

        if (res.status >= 500 && retries > 0) {
            const errorBody = await res.text().catch(() => '');
            logger.warn(`[RiotAPI] ${res.status} for ${matchId}: ${errorBody}. Retrying in 2s... (${retries} left)`);
            await delay(2000);
            return fetchMatchDetail(matchId, retries - 1);
        }

        if (!res.ok) {
            logger.error(`MatchDetail Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Detail Error (${res.status})` };
        }

        const data = await res.json();
        return { success: true, data };
    } catch (e) {
        logger.error("fetchMatchDetail exception:", e);
        return { success: false, error: "RIOT_API_ERROR" };
    }
}

// 6. Get Match Timeline by MatchID
export async function fetchMatchTimeline(matchId: string, retries = 3): Promise<{ success: boolean, data?: TimelineV5Response, error?: string }> {
    if (!RIOT_API_KEY) return { success: false, error: "RIOT_API_KEY is missing" };

    // Timeline endpoint: /lol/match/v5/matches/{matchId}/timeline
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;

    try {
        const res = await fetch(url, {
            headers: { "X-Riot-Token": RIOT_API_KEY },
            next: { revalidate: 86400 } // Cache for 24 hours (Immutable data)
        });

        if (res.status === 429 && retries > 0) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
            await delay((retryAfter + 1) * 1000);
            return fetchMatchTimeline(matchId, retries - 1);
        }

        if (res.status >= 500 && retries > 0) {
            const errorBody = await res.text().catch(() => '');
            logger.warn(`[RiotAPI] Timeline ${res.status} for ${matchId}: ${errorBody}. Retrying in 2s... (${retries} left)`);
            await delay(2000);
            return fetchMatchTimeline(matchId, retries - 1);
        }

        if (!res.ok) {
            logger.error(`MatchTimeline Error (${res.status}) for ${matchId}`);
           return { success: false, error: `Match Timeline Error (${res.status})` };
        }

        const data = await res.json();
        return { success: true, data };
    } catch (e) {
        logger.error("fetchMatchTimeline exception:", e);
        return { success: false, error: "RIOT_API_ERROR" };
    }
}

// ─── Participant Role Mapping ────────────────────────────────────

/**
 * Build a mapping of participantId -> role/champion/team
 * This allows us to determine WHO participated in each event
 */
export async function buildParticipantRoleMap(matchData: MatchV5Response): Promise<ParticipantRoleMap> {
    const roleMap: ParticipantRoleMap = {};

    if (!matchData?.info?.participants) return roleMap;

    matchData.info.participants.forEach((p: MatchV5Participant, index: number) => {
        const participantId = index + 1; // 1-10

        // teamPosition: "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", or ""
        let role: ParticipantRole = 'UNKNOWN';
        const pos = p.teamPosition?.toUpperCase() || '';

        if (pos === 'TOP') role = 'TOP';
        else if (pos === 'JUNGLE') role = 'JUNGLE';
        else if (pos === 'MIDDLE' || pos === 'MID') role = 'MIDDLE';
        else if (pos === 'BOTTOM' || pos === 'ADC' || pos === 'CARRY') role = 'BOTTOM';
        else if (pos === 'UTILITY' || pos === 'SUPPORT' || pos === 'SUP') role = 'UTILITY';

        roleMap[participantId] = {
            role,
            championName: p.championName || 'Unknown',
            teamId: p.teamId || (participantId <= 5 ? 100 : 200)
        };
    });

    return roleMap;
}

// ─── Kill Type Detection (Internal Helper) ───────────────────────

/**
 * Determine the type of kill based on participants and their roles
 * (Internal helper - not exported as Server Action)
 */
function determineKillType(
    killerPid: number,
    victimPid: number,
    assisterPids: number[],
    roleMap: ParticipantRoleMap,
    userPid: number
): 'SOLO' | 'LANE_2V2' | 'GANK' | 'ROAM' | 'TEAMFIGHT' | 'UNKNOWN' {
    const allParticipants = [killerPid, victimPid, ...assisterPids];
    const uniqueParticipants = [...new Set(allParticipants.filter(p => p > 0))];
    const totalCount = uniqueParticipants.length;

    // Get user's role and team
    const userInfo = roleMap[userPid];
    if (!userInfo) return 'UNKNOWN';

    const userRole = userInfo.role;
    const userTeam = userInfo.teamId;

    // Collect roles of all participants
    const participantRoles = uniqueParticipants.map(pid => ({
        pid,
        ...roleMap[pid]
    }));

    // Separate by team
    const allies = participantRoles.filter(p => p.teamId === userTeam);
    const enemies = participantRoles.filter(p => p.teamId !== userTeam);

    // 1. Solo Kill: 1v1, no assists
    if (totalCount === 2 && assisterPids.length === 0) {
        return 'SOLO';
    }

    // 2. Teamfight: 5+ participants
    if (totalCount >= 5) {
        return 'TEAMFIGHT';
    }

    // 3. Check if JUNGLE is involved (from either team, not being the user)
    const junglerInvolved = participantRoles.some(p =>
        p.role === 'JUNGLE' && p.pid !== userPid
    );

    if (junglerInvolved) {
        return 'GANK';
    }

    // 4. Check for roam (MID or TOP from enemy team joining a non-mid/top fight)
    const isUserBotLane = userRole === 'BOTTOM' || userRole === 'UTILITY';
    const roamerInvolved = enemies.some(p =>
        (p.role === 'MIDDLE' || p.role === 'TOP') &&
        isUserBotLane
    );

    if (roamerInvolved) {
        return 'ROAM';
    }

    // 5. Lane 2v2 (BOT + SUP vs BOT + SUP)
    if (isUserBotLane) {
        const allyRoles = allies.map(a => a.role);
        const enemyRoles = enemies.map(e => e.role);

        const isAllyBotLane = allyRoles.every(r => r === 'BOTTOM' || r === 'UTILITY');
        const isEnemyBotLane = enemyRoles.every(r => r === 'BOTTOM' || r === 'UTILITY');

        if (isAllyBotLane && isEnemyBotLane && totalCount <= 4) {
            return 'LANE_2V2';
        }
    }

    // 6. For other lanes, check if only lane opponents are involved
    const userLaneOpponentRole = userRole; // Same role = lane opponent
    const onlyLaneOpponents = enemies.every(e => e.role === userLaneOpponentRole);

    if (onlyLaneOpponents && totalCount <= 3) {
        return 'SOLO'; // Could be a 1v1 with assist from minions counted oddly, or just lane fight
    }

    // Default: If we can't determine, check participant count
    if (totalCount === 3) {
        return 'GANK'; // 3 people, likely a gank if we couldn't determine otherwise
    }

    return 'UNKNOWN';
}

// ─── Extract Match Events ────────────────────────────────────────

export async function extractMatchEvents(
    timeline: TimelineV5Response,
    puuid: string,
    range?: { startMs: number, endMs: number },
    opponentPid?: number,  // Optional: opponent's participant ID for context
    roleMap?: ParticipantRoleMap,  // NEW: Role mapping for accurate kill type detection
    language: 'ja' | 'en' | 'ko' = 'en'  // Language for event descriptions
): Promise<TruthEvent[]> {
    if (!timeline || !timeline.info || !timeline.info.frames) return [];

    // Translation templates for event details
    const eventTexts = {
        ja: {
            youKilled: (victim: string) => `あなたが${victim}をキル`,
            assists: (count: number) => `(+${count}アシスト)`,
            killedBy: (victim: string, killer: string) => `${victim}が${killer}にキルされた`,
            allySecured: (type: string, subType?: string) => `[味方獲得] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[敵獲得] ${type}${subType ? ` (${subType})` : ''} - なぜ取られたか分析`,
            allyDestroyed: (structure: string) => `[味方破壊] ${structure}`,
            enemyDestroyed: (structure: string) => `[敵破壊] ${structure} - なぜ破壊されたか分析`,
            wardPlaced: (wardType: string) => `ワード設置: ${wardType}`,
            wardDestroyed: 'ワード破壊',
            itemPurchased: (itemName: string) => `アイテム購入: ${itemName}`,
            levelUp: (level: number) => `レベル${level}に到達`,
            skillLevelUp: (slot: number) => `スキル${slot}をレベルアップ`,
            turret: 'タワー',
            player: 'プレイヤー'
        },
        en: {
            youKilled: (victim: string) => `YOU killed ${victim}`,
            assists: (count: number) => `(+${count} assists)`,
            killedBy: (victim: string, killer: string) => `${victim} killed by ${killer}`,
            allySecured: (type: string, subType?: string) => `[ALLY SECURED] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[ENEMY TOOK] ${type}${subType ? ` (${subType})` : ''} - Analyze: Why did YOUR team lose this objective?`,
            allyDestroyed: (structure: string) => `[ALLY DESTROYED] ${structure}`,
            enemyDestroyed: (structure: string) => `[ENEMY DESTROYED] Your ${structure} - Analyze: Why was this tower lost?`,
            wardPlaced: (wardType: string) => `Ward placed: ${wardType}`,
            wardDestroyed: 'Ward destroyed',
            itemPurchased: (itemName: string) => `Item purchased: ${itemName}`,
            levelUp: (level: number) => `Reached level ${level}`,
            skillLevelUp: (slot: number) => `Leveled up skill ${slot}`,
            turret: 'Turret',
            player: 'Player'
        },
        ko: {
            youKilled: (victim: string) => `당신이 ${victim}을(를) 처치`,
            assists: (count: number) => `(+${count} 어시스트)`,
            killedBy: (victim: string, killer: string) => `${victim}이(가) ${killer}에게 처치됨`,
            allySecured: (type: string, subType?: string) => `[아군 획득] ${type}${subType ? ` (${subType})` : ''}`,
            enemyTook: (type: string, subType?: string) => `[적 획득] ${type}${subType ? ` (${subType})` : ''} - 왜 빼앗겼는지 분석`,
            allyDestroyed: (structure: string) => `[아군 파괴] ${structure}`,
            enemyDestroyed: (structure: string) => `[적 파괴] ${structure} - 왜 파괴되었는지 분석`,
            wardPlaced: (wardType: string) => `와드 설치: ${wardType}`,
            wardDestroyed: '와드 파괴됨',
            itemPurchased: (itemName: string) => `아이템 구매: ${itemName}`,
            levelUp: (level: number) => `레벨 ${level} 도달`,
            skillLevelUp: (slot: number) => `스킬 ${slot} 레벨업`,
            turret: '타워',
            player: '플레이어'
        }
    };
    const txt = eventTexts[language];

    const frames = timeline.info.frames;
    const extracted: TruthEvent[] = [];

    // Find Participant ID for PUUID
    let myPid = 0;
    if (timeline.info.participants) {
        const found = timeline.info.participants.find((tp) => tp.puuid === puuid);
        if (found) myPid = found.participantId;
    }

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper: Get frame stats at a given timestamp
    const getFrameStatsAt = (timestamp: number) => {
        let closestFrame = frames[0];
        for (const frame of frames) {
            if (frame.timestamp <= timestamp) {
                closestFrame = frame;
            } else {
                break;
            }
        }

        if (!closestFrame?.participantFrames) return null;

        const myFrame = closestFrame.participantFrames[myPid.toString()];
        const oppFrame = opponentPid ? closestFrame.participantFrames[opponentPid.toString()] : null;

        if (!myFrame) return null;

        return {
            myGold: myFrame.totalGold || 0,
            myLevel: myFrame.level || 1,
            myCs: (myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0),
            oppGold: oppFrame?.totalGold || 0,
            oppLevel: oppFrame?.level || 1,
            oppCs: (oppFrame?.minionsKilled || 0) + (oppFrame?.jungleMinionsKilled || 0),
            goldDiff: (myFrame.totalGold || 0) - (oppFrame?.totalGold || 0),
            levelDiff: (myFrame.level || 1) - (oppFrame?.level || 1),
            csDiff: ((myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0)) -
                    ((oppFrame?.minionsKilled || 0) + (oppFrame?.jungleMinionsKilled || 0))
        };
    };

    // Helper: Get involved roles for an event
    const getInvolvedRoles = (participantIds: number[]): string[] => {
        if (!roleMap) return [];
        return participantIds
            .filter(pid => pid > 0 && roleMap[pid])
            .map(pid => `${roleMap[pid].role}(${roleMap[pid].championName})`);
    };

    // Track first blood
    let firstBloodOccurred = false;

    frames.forEach((frame: TimelineFrame) => {
        // Time Filter
        if (range) {
            if (frame.timestamp < range.startMs - 60000) return;
            if (frame.timestamp > range.endMs + 60000) return;
        }

        frame.events.forEach((e: RiotTimelineEvent) => {
            // Strict Time Check
            if (range) {
                if (e.timestamp < range.startMs || e.timestamp > range.endMs) return;
            }

            let eventObj: TruthEvent | null = null;
            const frameStats = getFrameStatsAt(e.timestamp);

            // === CHAMPION_KILL ===
            if (e.type === 'CHAMPION_KILL') {
                const killer = e.killerId ?? 0;
                const victim = e.victimId ?? 0;
                const assisters = e.assistingParticipantIds || [];
                const isFirstBlood = !firstBloodOccurred;
                if (isFirstBlood) firstBloodOccurred = true;

                // Determine kill type using role-aware logic
                const killType = roleMap
                    ? determineKillType(killer, victim, assisters, roleMap, myPid)
                    : (assisters.length === 0 ? 'SOLO' : assisters.length + 2 >= 5 ? 'TEAMFIGHT' : 'UNKNOWN');

                // Get involved roles for detailed context
                const allParticipants = [killer, victim, ...assisters];
                const involvedRoles = getInvolvedRoles(allParticipants);

                // Determine if this is USER's kill or death
                const isUserDeath = victim === myPid;
                const isUserKill = killer === myPid;

                // Build detailed context string with role information
                let ctx = "";
                const killerInfo = roleMap?.[killer];
                const victimInfo = roleMap?.[victim];

                if (isUserDeath) {
                    const killerDesc = killerInfo
                        ? `${killerInfo.championName}(${killerInfo.role})`
                        : `Player ${killer}`;
                    ctx = `YOU died to ${killerDesc}`;
                    if (assisters.length > 0) {
                        const assisterRoles = assisters
                            .map((aid: number) => roleMap?.[aid]?.role || 'UNKNOWN')
                            .join(', ');
                        ctx += ` (+${assisters.length} assists: ${assisterRoles})`;
                    }
                    // Add kill type explanation
                    const killTypeExplanation: Record<string, string> = {
                        'SOLO': '1v1',
                        'LANE_2V2': 'Lane Fight (2v2)',
                        'GANK': 'Jungle Gank',
                        'ROAM': 'Roam',
                        'TEAMFIGHT': 'Teamfight',
                        'UNKNOWN': ''
                    };
                    if (killTypeExplanation[killType]) {
                        ctx += ` [${killTypeExplanation[killType]}]`;
                    }
                } else if (isUserKill) {
                    const victimDesc = victimInfo
                        ? `${victimInfo.championName}(${victimInfo.role})`
                        : `${txt.player} ${victim}`;
                    ctx = txt.youKilled(victimDesc);
                    if (assisters.length > 0) ctx += ` ${txt.assists(assisters.length)}`;
                    ctx += ` [${killType}]`;
                } else {
                    ctx = txt.killedBy(`${txt.player} ${victim}`, `${txt.player} ${killer}`);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: isUserDeath ? 'DEATH' : 'KILL',
                    detail: ctx,
                    position: e.position || { x: 0, y: 0 },
                    participants: allParticipants,
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        levelDiff: frameStats?.levelDiff,
                        csDiff: frameStats?.csDiff,
                        assistCount: assisters.length,
                        isFirstBlood,
                        killType,
                        involvedRoles
                    }
                };
            }
            // === ELITE_MONSTER_KILL (Dragon, Baron, Herald, Grubs) ===
            else if (e.type === 'ELITE_MONSTER_KILL') {
                const monsterType = e.monsterType || 'UNKNOWN';
                const monsterSubType = e.monsterSubType || '';
                const killerTeam = e.killerTeamId;
                const myTeam = myPid <= 5 ? 100 : 200;
                const isAllyObjective = killerTeam === myTeam;

                // Create clear, unambiguous detail (translated)
                let detail = "";
                if (isAllyObjective) {
                    detail = txt.allySecured(monsterType, monsterSubType || undefined);
                } else {
                    detail = txt.enemyTook(monsterType, monsterSubType || undefined);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'OBJECTIVE',
                    detail,
                    position: e.position || { x: 0, y: 0 },
                    participants: [e.killerId ?? 0],
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        isAllyObjective,
                        objectiveType: monsterType
                    }
                };
            }
            // === BUILDING_KILL (Turret, Inhibitor) ===
            else if (e.type === 'BUILDING_KILL') {
                const buildingType = e.buildingType || txt.turret;
                const laneType = e.laneType || '';
                const towerType = e.towerType || '';
                const killerTeam = e.teamId === 100 ? 200 : 100; // Building's team is opposite of destroyer
                const myTeam = myPid <= 5 ? 100 : 200;
                const isAllyObjective = killerTeam !== myTeam; // true = YOUR team destroyed enemy tower

                // Create clear, unambiguous detail (translated)
                let detail = "";
                const structureName = `${laneType} ${towerType || buildingType}`.trim();
                if (isAllyObjective) {
                    detail = txt.allyDestroyed(structureName);
                } else {
                    detail = txt.enemyDestroyed(structureName);
                }

                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'TURRET',
                    detail,
                    position: e.position || { x: 0, y: 0 },
                    participants: e.killerId ? [e.killerId] : [],
                    context: {
                        goldDiff: frameStats?.goldDiff,
                        isAllyObjective,
                        objectiveType: buildingType
                    }
                };
            }
            // === WARD_PLACED ===
            else if (e.type === 'WARD_PLACED' && e.creatorId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'WARD',
                    detail: txt.wardPlaced(e.wardType || 'WARD'),
                    position: { x: 0, y: 0 }, // Ward position not in event
                    participants: [myPid],
                    context: {
                        wardType: e.wardType
                    }
                };
            }
            // === WARD_KILL ===
            else if (e.type === 'WARD_KILL' && e.killerId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'WARD',
                    detail: txt.wardDestroyed,
                    position: e.position || { x: 0, y: 0 },
                    participants: [myPid],
                    context: {
                        wardType: e.wardType
                    }
                };
            }
            // === ITEM_PURCHASED (Important items only) ===
            else if (e.type === 'ITEM_PURCHASED' && e.participantId === myPid) {
                // Only track significant items (cost > 1000 gold or completed items)
                // We'll filter by ID ranges or specific IDs if needed
                const itemId = e.itemId ?? 0;
                // Skip consumables and small items (rough filter)
                if (itemId > 3000 || [3340, 3363, 3364, 2055].includes(itemId)) {
                    eventObj = {
                        timestamp: e.timestamp,
                        timestampStr: formatTime(e.timestamp),
                        type: 'ITEM',
                        detail: txt.itemPurchased(`#${itemId}`),
                        position: { x: 0, y: 0 },
                        participants: [myPid],
                        context: {
                            itemId,
                            goldDiff: frameStats?.goldDiff
                        }
                    };
                }
            }
            // === LEVEL_UP ===
            else if (e.type === 'LEVEL_UP' && e.participantId === myPid) {
                // Only track important levels (6, 11, 16 for ult upgrades)
                if (e.level && [6, 11, 16].includes(e.level)) {
                    eventObj = {
                        timestamp: e.timestamp,
                        timestampStr: formatTime(e.timestamp),
                        type: 'LEVEL',
                        detail: txt.levelUp(e.level),
                        position: { x: 0, y: 0 },
                        participants: [myPid],
                        context: {
                            levelDiff: frameStats?.levelDiff
                        }
                    };
                }
            }
            // === CHAMPION_SPECIAL_KILL (Multi-kills, etc.) ===
            else if (e.type === 'CHAMPION_SPECIAL_KILL' && e.killerId === myPid) {
                eventObj = {
                    timestamp: e.timestamp,
                    timestampStr: formatTime(e.timestamp),
                    type: 'KILL',
                    detail: `YOU achieved ${e.killType || 'SPECIAL_KILL'}`,
                    position: e.position || { x: 0, y: 0 },
                    participants: [myPid]
                };
            }

            if (eventObj) extracted.push(eventObj);
        });
    });

    return extracted;
}

// ─── Extract Frame Statistics ────────────────────────────────────

// 12. Extract Frame Statistics (Gold/CS/Level over time)
export async function extractFrameStats(
    timeline: TimelineV5Response,
    puuid: string,
    opponentPid?: number
): Promise<FrameStats[]> {
    if (!timeline || !timeline.info || !timeline.info.frames) return [];

    const frames = timeline.info.frames;
    const stats: FrameStats[] = [];

    // Find Participant ID for PUUID
    let myPid = 0;
    if (timeline.info.participants) {
        const found = timeline.info.participants.find((tp) => tp.puuid === puuid);
        if (found) myPid = found.participantId;
    }

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    frames.forEach((frame: TimelineFrame) => {
        if (!frame.participantFrames) return;

        const myFrame = frame.participantFrames[myPid.toString()];
        if (!myFrame) return;

        const oppFrame = opponentPid ? frame.participantFrames[opponentPid.toString()] : null;

        const myCs = (myFrame.minionsKilled || 0) + (myFrame.jungleMinionsKilled || 0);
        const oppCs = oppFrame ? (oppFrame.minionsKilled || 0) + (oppFrame.jungleMinionsKilled || 0) : 0;

        stats.push({
            timestamp: frame.timestamp,
            timestampStr: formatTime(frame.timestamp),
            user: {
                totalGold: myFrame.totalGold || 0,
                currentGold: myFrame.currentGold || 0,
                level: myFrame.level || 1,
                cs: myFrame.minionsKilled || 0,
                jungleCs: myFrame.jungleMinionsKilled || 0,
                position: myFrame.position || { x: 0, y: 0 }
            },
            opponent: oppFrame ? {
                totalGold: oppFrame.totalGold || 0,
                level: oppFrame.level || 1,
                cs: oppFrame.minionsKilled || 0,
                jungleCs: oppFrame.jungleMinionsKilled || 0,
                position: oppFrame.position || { x: 0, y: 0 }
            } : undefined,
            goldDiff: (myFrame.totalGold || 0) - (oppFrame?.totalGold || 0),
            csDiff: myCs - oppCs,
            levelDiff: (myFrame.level || 1) - (oppFrame?.level || 1)
        });
    });

    return stats;
}
