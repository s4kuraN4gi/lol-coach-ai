'use server'

import { createClient } from "@/utils/supabase/server";
import { fetchRank, fetchSummonerByPuuid, type LeagueEntryDTO, fetchMatchIds } from "./riot";

export type ChampionStat = {
    name: string;
    games: number;
    wins: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgCs: number;
    winRate: number;
    avgKda: string;
}


export type RadarStats = {
    combat: number;
    objective: number;
    vision: number;
    farming: number;
    survival: number;
}

export type UniqueStats = {
    winConditions: { label: string, winRate: number, count: number }[];
    nemesis: { name: string, wins: number, games: number, winRate: number }[];
    prey: { name: string, wins: number, games: number, winRate: number }[];
    survival: { csAdvantage: number, csAt10: number };
    clutch: { closeWr: number, stompWr: number, closeGames: number, stompGames: number };
}

export type QuickStats = {
    csPerMin: number;
    visionPerMin: number;
    kda: number;
    killParticipation: number;
    avgDamage: number;
    gamesAnalyzed: number;
}

export type RoleStats = {
    TOP: number;
    JUNGLE: number;
    MIDDLE: number;
    BOTTOM: number;
    UTILITY: number;
}

export type DashboardStatsDTO = {
    ranks: LeagueEntryDTO[];
    recentMatches: {
        win: boolean;
        timestamp: number;
    }[]; // For LP Widget Trend
    championStats: ChampionStat[]; // For Champion Card
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
    debugLog: string[];
}

// === RANK HISTORY TYPES ===

export type RankHistoryEntry = {
    id: string;
    puuid: string;
    queue_type: string;
    tier: string | null;
    rank: string | null;
    league_points: number | null;
    wins: number | null;
    losses: number | null;
    recorded_at: string; // YYYY-MM-DD
    created_at: string;
}

// === RANK HISTORY FUNCTIONS ===

/**
 * Record current rank to history (called during performFullUpdate)
 * Uses UPSERT to avoid duplicates per day
 */
export async function recordRankHistory(puuid: string, ranks: LeagueEntryDTO[]): Promise<void> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check auth context for debugging
    const { data: { user } } = await supabase.auth.getUser();
    console.log(`[RankHistory] Auth context - User ID: ${user?.id || 'NOT AUTHENTICATED'}`);
    console.log(`[RankHistory] Recording for PUUID: ${puuid.slice(0, 8)}... Date: ${today}`);

    for (const rank of ranks) {
        try {
            const payload = {
                puuid,
                queue_type: rank.queueType,
                tier: rank.tier,
                rank: rank.rank,
                league_points: rank.leaguePoints,
                wins: rank.wins,
                losses: rank.losses,
                recorded_at: today
            };

            console.log(`[RankHistory] Upserting:`, JSON.stringify(payload));

            const { data, error } = await supabase.from('rank_history').upsert(payload, {
                onConflict: 'puuid,queue_type,recorded_at'
            }).select();

            if (error) {
                console.error(`[RankHistory] UPSERT FAILED for ${rank.queueType}:`, error.message, error.code, error.details);
            } else {
                console.log(`[RankHistory] SUCCESS - Recorded ${rank.queueType}: ${rank.tier} ${rank.rank} ${rank.leaguePoints}LP`, data);
            }
        } catch (e: any) {
            console.error(`[RankHistory] Exception:`, e.message, e.stack);
        }
    }
}

/**
 * Fetch rank history for a given puuid and queue type
 * Returns last 30 days of data for graphing
 */
export async function fetchRankHistory(
    puuid: string,
    queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' = 'RANKED_SOLO_5x5',
    days: number = 30
): Promise<RankHistoryEntry[]> {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('rank_history')
        .select('*')
        .eq('puuid', puuid)
        .eq('queue_type', queueType)
        .gte('recorded_at', startDateStr)
        .order('recorded_at', { ascending: true });

    if (error) {
        console.error(`[RankHistory] Fetch error:`, error.message);
        return [];
    }

    return data || [];
}

// Rate limit safe fetcher
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- Split Actions for Progressive Loading ---

export type BasicStatsDTO = {
    ranks: LeagueEntryDTO[];
    debugLog: string[];
}

export async function fetchBasicStats(puuid: string, summonerId?: string | null, gameName?: string | null, tagLine?: string | null): Promise<BasicStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };
    
    try {
        // 0. Self-Heal: Recover SummonerID if missing
        let validSummonerId = summonerId;
        
        // Helper to check validity
        const isValid = (id?: string | null) => id && id.length > 5;

        if (!isValid(validSummonerId)) {
             const { fetchSummonerByPuuid, fetchRiotAccount } = await import('./riot');
             log(`[BasicStats] SummonerID missing. Fetching by PUUID...`);
             
             let summonerData = await fetchSummonerByPuuid(puuid);
             
             // Check if data is valid (has ID)
             if (!summonerData || !summonerData.id) {
                 log(`[BasicStats] PUUID Fetch failed/bad data. Trying Riot ID Recovery...`);
                 if (gameName && tagLine) {
                     const riotAccount = await fetchRiotAccount(gameName, tagLine);
                     if (riotAccount && riotAccount.puuid) {
                         log(`[BasicStats] Recovered fresh PUUID: ${riotAccount.puuid.slice(0,10)}...`);
                         // Retry Summoner Fetch with NEW PUUID
                         summonerData = await fetchSummonerByPuuid(riotAccount.puuid);
                     } else {
                         log(`[BasicStats] Riot ID Lookup failed.`);
                     }
                 } else {
                     log(`[BasicStats] No Name/Tag provided for recovery.`);
                 }
             }

             if (summonerData && summonerData.id) {
                 validSummonerId = summonerData.id;
                 log(`[BasicStats] Recovered SummonerID: ${validSummonerId}`);
             } else {
                 throw new Error("Failed to recover SummonerID. API Key may be invalid or Account not found.");
             }
        }
        
        // Ensure validSummonerId is a string for fetchRank
        if (!validSummonerId) {
             throw new Error("Critical: validSummonerId is undefined after recovery attempt.");
        }

        // 1. Fetch Rank
        let ranks = await fetchRank(validSummonerId);

        // Self-heal: If NO ranks found, SummonerID might be stale. Re-fetch ID from Riot.
        if (ranks.length === 0) {
             const { fetchSummonerByPuuid } = await import('./riot');
             log(`[BasicStats] No ranks found. Verifying SummonerID...`);
             const freshSummoner = await fetchSummonerByPuuid(puuid, true); // noCache=true
             
             if (freshSummoner && freshSummoner.id !== validSummonerId) {
                 log(`[BasicStats] SummonerID mismatch! Updating to: ${freshSummoner.id}`);
                 validSummonerId = freshSummoner.id;
                 ranks = await fetchRank(validSummonerId);
                 log(`[BasicStats] Retry Rank Fetch found: ${ranks.length}`);
             } else {
                 log(`[BasicStats] SummonerID is valid (unchanged). User is likely truly Unranked.`);
             }
        }

        log(`[BasicStats] Ranks fetched: ${ranks.length}`);
        return { ranks, debugLog: logs };

    } catch (e: any) {
        const errorMsg = `[BasicStats] Critical Error: ${e.message || e}`;
        console.error("fetchBasicStats Error:", errorMsg);
        logs.push(errorMsg);
        return { ranks: [], debugLog: logs };
    }
}

export type MatchStatsDTO = {
    recentMatches: { win: boolean; timestamp: number }[];
    championStats: ChampionStat[];
    radarStats: RadarStats | null;
    uniqueStats: UniqueStats | null;
    quickStats: QuickStats | null;
    roleStats: RoleStats | null;
    debugLog: string[];
}

// --- Cache-First Architecture ---

import { revalidatePath } from 'next/cache';


/**
 * A. Read (DB Cache Only) - Fast
 */
export async function getStatsFromCache(puuid: string): Promise<MatchStatsDTO & BasicStatsDTO> {
    const supabase = await createClient();
    const logs: string[] = [];

    // 1. Fetch from DB (Account + Ranks + MatchIDs)
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('*')
        .eq('puuid', puuid)
        .single();
    
    if (account) {
        console.log(`[Cache] Rank Info from DB: ${JSON.stringify(account.rank_info)}`);
    } else {
        console.log(`[Cache] Account not found for PUUID: ${puuid}`);
    }
    
    // Default Empty State
    const result: MatchStatsDTO & BasicStatsDTO = {
        ranks: [],
        debugLog: logs,
        recentMatches: [],
        championStats: [],
        radarStats: null,
        uniqueStats: null,
        quickStats: null,
        roleStats: null
    };

    if (account) {
        if (account.rank_info) {
             result.ranks = account.rank_info as LeagueEntryDTO[];
        }
        
        // 2. Fetch Matches from Cache using stored IDs
        if (account.recent_match_ids && Array.isArray(account.recent_match_ids)) {
             const limit = 50; 
             const targetIds = (account.recent_match_ids as string[]).slice(0, limit);
             console.log(`[Cache] Account has ${account.recent_match_ids.length} IDs. Fetching top ${targetIds.length}...`);
             
             if (targetIds.length > 0) {
                 const { getCachedMatchesByIds } = await import('@/services/matchService');
                 const cachedMatches = await getCachedMatchesByIds(targetIds);
                 console.log(`[Cache] Retrieved ${cachedMatches.length} matches from DB.`);
                 
                 // Process these matches
                 // FIX: cachedMatches are { metadata, info }, but processMatchStats expects info objects
                 const validMatchesInfo = cachedMatches.map((m: any) => m.info || m);
                 
                 const final = processMatchStats(validMatchesInfo, puuid, result);
                 console.log(`[Cache] Processed Matches: ${final.recentMatches.length} (Filtered from ${cachedMatches.length})`);
                 return final;
             }
        } else {
             console.log(`[Cache] Account has NO recent_match_ids.`);
        }
    } else {
        console.log(`[Cache] Account NOT found for PUUID: ${puuid}`);
    }
    
    return result;
}

/**
 * B. Check (Background) - Lightweight
 */
export async function checkForUpdates(puuid: string): Promise<{ hasUpdates: boolean, newGameCount: number }> {
    const supabase = await createClient();

    // 1. Get latest match ID from DB
    const { data: account } = await supabase
        .from('summoner_accounts')
        .select('recent_match_ids')
        .eq('puuid', puuid)
        .single();
        
    const storedIds = new Set((account?.recent_match_ids as string[]) || []);

    // 2. Fetch Recent IDs from Riot (Fast) - Check last 10
    const recentRes = await fetchMatchIds(puuid, 10);
    
    if (!recentRes.success || !recentRes.data) return { hasUpdates: false, newGameCount: 0 };
    
    const newCount = recentRes.data.filter(id => !storedIds.has(id)).length;
    
    return { hasUpdates: newCount > 0, newGameCount: newCount };
}

/**
 * C. Update (Action) - Heavy
 */
export async function performFullUpdate(puuid: string) {
    const { fetchAndCacheMatches } = await import('@/services/matchService');
    const supabase = await createClient();
    
    console.log(`[Action] performFullUpdate started for ${puuid.slice(0, 8)}...`);

    // 1. Sync Matches (Fetch 50 new ones)
    let matchIds: string[] = [];
    try {
        const { matches } = await fetchAndCacheMatches(puuid, 50);
        matchIds = matches.map(m => m.metadata.matchId);
        console.log(`[Action] Fetched ${matchIds.length} matches`);
    } catch (e: any) {
        console.error(`[Action] Match Fetch Error:`, e);
    }
    
    let ranks: LeagueEntryDTO[] = [];
    let oldIds: string[] = [];
    let targetSummonerId = "";
    let targetAccountId = "";
    let summonerLevel: number | null = null;
    let profileIconId: number | null = null;
    
    try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { data: account } = await supabase.from('summoner_accounts').select('id, user_id, summoner_id, recent_match_ids, summoner_name, tag_line').eq('puuid', puuid).single();
        
        targetAccountId = account?.id;
        // Initialize targetSummonerId from DB, but allow overwriting by fallback
        if (account?.summoner_id) {
            targetSummonerId = account.summoner_id;
        }
        
        console.log(`[Action] Auth Check - AuthID: ${authUser?.id} | DB_UserID: ${account?.user_id} | AccountPK: ${account?.id}`);
        
        // DEEP REPAIR: if missing ID or potential old-key ID, try Account-V1 refresh
        // Note: For now we trigger this if ID is missing OR user manually requests refresh (which calls this fn)
        // If the ID length is < 70 (SummonerID) but fetchRank returns [], it might be an Old Key ID.
        // We will attempt to refresh Account Data if we have Name/Tag.
        if (account?.summoner_name && account?.tag_line) {
             try {
                const { fetchRiotAccount, fetchSummonerByPuuid } = await import('@/app/actions/riot');
                console.log(`[Action] Deep Repair: Refining ID for ${account.summoner_name}#${account.tag_line}`);
                
                const riotAcc = await fetchRiotAccount(account.summoner_name, account.tag_line);
                if (riotAcc && riotAcc.puuid) {
                    console.log(`[Action] Account V1 PUUID: ${riotAcc.puuid}`);
                    
                    // Fetch Summoner (Fresh)
                    const summoner = await fetchSummonerByPuuid(riotAcc.puuid);
                    if (summoner && summoner.id) {
                         console.log(`[Action] Deep Repair Success! New ID: ${summoner.id}`);
                         targetSummonerId = summoner.id;
                         // Update PUUID in case it changed (rare but possible)
                         // Actually avoiding puuid update as it breaks relation? No, puuid is just a column.
                    }
                }
             } catch (repairErr) {
                 console.error(`[Action] Deep Repair Failed:`, repairErr);
             }
        }
        
        oldIds = (account?.recent_match_ids as string[]) || [];

        // Fetch rank using PUUID directly (newer API, more reliable)
        try {
            const { fetchRankByPuuid } = await import('@/app/actions/riot');
            console.log(`[Action] Fetching Rank by PUUID: ${puuid.slice(0, 8)}...`);
            ranks = await fetchRankByPuuid(puuid);
            console.log(`[Action] Rank Result (Raw): ${JSON.stringify(ranks)}`);
        } catch (rankErr) {
            console.error(`[Action] Rank Fetch Error (Non-fatal):`, rankErr);
        }

        // Fetch summoner data for level and icon update
        try {
            const { fetchSummonerByPuuid } = await import('@/app/actions/riot');
            console.log(`[Action] Fetching Summoner Data for level/icon update...`);
            const summonerData = await fetchSummonerByPuuid(puuid);
            if (summonerData) {
                summonerLevel = summonerData.summonerLevel ?? null;
                profileIconId = summonerData.profileIconId ?? null;
                console.log(`[Action] Summoner Data: Level=${summonerLevel}, Icon=${profileIconId}`);
            }
        } catch (summonerErr) {
            console.error(`[Action] Summoner Fetch Error (Non-fatal):`, summonerErr);
        }
    } catch (dbReadErr) {
        console.error(`[Action] DB Read Error:`, dbReadErr);
    }
    
    // Merge new IDs ...
    const mergedIds = Array.from(new Set([...matchIds, ...oldIds])).slice(0, 100);

    // Record rank history for graphing (await to ensure it's saved before returning)
    if (ranks.length > 0) {
        try {
            await recordRankHistory(puuid, ranks);
        } catch (e) {
            console.error('[Action] recordRankHistory failed:', e);
        }
    }

    // 3. Save to DB
    const updatePayload: any = {
        rank_info: ranks,
        recent_match_ids: mergedIds,
        last_updated_at: new Date().toISOString()
    };

    if (targetSummonerId) {
        updatePayload.summoner_id = targetSummonerId;
    }

    if (summonerLevel !== null) {
        updatePayload.summoner_level = summonerLevel;
    }

    if (profileIconId !== null) {
        updatePayload.profile_icon_id = profileIconId;
    }
    
    console.log(`[Action] DB Update Payload: ${JSON.stringify(updatePayload, null, 2)}`);

    // Update by Primary Key (id)
    if (!targetAccountId) {
         console.error("[Action] Account ID not found in initial fetch, cannot update.");
         throw new Error("Account ID missing");
    }

    const { data: updatedData, error: updateError, count } = await supabase.from('summoner_accounts')
    .update(updatePayload)
    .eq('id', targetAccountId) 
    .select('id, summoner_id, rank_info');

    if (updateError) {
        console.error(`[Action] DB Update Failed:`, updateError);
        throw new Error(`DB Update Failed: ${updateError.message}`);
    } else {
        const numRows = updatedData?.length ?? 0;
        console.log(`[Action] DB Update Success. Saved ${mergedIds.length} IDs. Rows Returned: ${numRows} (Count: ${count})`);
        
        if (numRows === 0) {
            console.error(`[Action] CRITICAL: Update returned 0 rows! RLS or ID mismatch prevented write.`);
            console.error(`[Action] Target Account PK: ${targetAccountId}`);
        } else {
            console.log(`[Action] Update Verification: ID=${updatedData[0].summoner_id}, Rank=${JSON.stringify(updatedData[0].rank_info)}`);
        }
    }

    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Deprecated / Compatible: Online Fetch
 * If offlineOnly is true, it redirects to cache.
 */
export async function fetchMatchStats(puuid: string, offlineOnly: boolean = false): Promise<MatchStatsDTO> {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };
    
    if (offlineOnly) {
        const stats = await getStatsFromCache(puuid);
        const { ranks, ...matchStats } = stats;
        return matchStats;
    }

    try {
        const { fetchAndCacheMatches } = await import('@/services/matchService');
        const { matches, logs: serviceLogs } = await fetchAndCacheMatches(puuid, 50);
        serviceLogs.forEach(l => log(l));
        
        const baseResult: MatchStatsDTO & BasicStatsDTO = { ranks: [], debugLog: logs, recentMatches: [], championStats: [], radarStats: null, uniqueStats: null, quickStats: null, roleStats: null };
        const result = processMatchStats(matches.map(m=>m.info), puuid, baseResult);
        const { ranks, ...finalMatchStats } = result;
        return finalMatchStats;
    } catch (e: any) {
        console.error("fetchMatchStats error", e);
        return { recentMatches: [], championStats: [], radarStats: null, uniqueStats: null, quickStats: null, roleStats: null, debugLog: [e.message] };
    }
}

// === PROFILE ENHANCED DATA ===

export type MonthlyStats = {
    month: string; // "2026-02" format
    rankedGames: number;
    wins: number;
    losses: number;
    winRate: number;
}

export type CoachFeedbackSummary = {
    macroAnalyses: number;
    microAnalyses: number;
    macroIssues: { concept: string; count: number }[];
    microIssues: { category: string; count: number }[];
}

export type ProfileEnhancedData = {
    monthlyStats: MonthlyStats | null;
    coachFeedback: CoachFeedbackSummary | null;
}

/**
 * Fetch enhanced profile data:
 * 1. Monthly ranked match statistics
 * 2. Aggregated AI coach feedback
 */
export async function fetchProfileEnhancedData(puuid: string): Promise<ProfileEnhancedData> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { monthlyStats: null, coachFeedback: null };
    }

    // Calculate current month range
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Fetch monthly ranked stats from cached matches
    let monthlyStats: MonthlyStats | null = null;
    try {
        const { data: account } = await supabase
            .from('summoner_accounts')
            .select('recent_match_ids')
            .eq('puuid', puuid)
            .single();

        if (account?.recent_match_ids && Array.isArray(account.recent_match_ids)) {
            const matchIds = account.recent_match_ids as string[];

            if (matchIds.length > 0) {
                // Fetch match cache data
                const { data: cachedMatches } = await supabase
                    .from('match_cache')
                    .select('match_id, data')
                    .in('match_id', matchIds);

                if (cachedMatches && cachedMatches.length > 0) {
                    let rankedGames = 0;
                    let wins = 0;

                    for (const cache of cachedMatches) {
                        const matchData = cache.data as any;
                        const info = matchData?.info;
                        if (!info) continue;

                        // Check if ranked and within current month
                        const gameTime = info.gameCreation;
                        if (!gameTime) continue;

                        const gameDate = new Date(gameTime);
                        const isThisMonth = gameDate >= monthStart && gameDate <= monthEnd;
                        const isRanked = info.queueId === 420 || info.queueId === 440; // Solo/Duo or Flex

                        if (isThisMonth && isRanked) {
                            const participant = info.participants?.find((p: any) => p.puuid === puuid);
                            if (participant) {
                                rankedGames++;
                                if (participant.win) wins++;
                            }
                        }
                    }

                    if (rankedGames > 0) {
                        monthlyStats = {
                            month: currentMonth,
                            rankedGames,
                            wins,
                            losses: rankedGames - wins,
                            winRate: Math.round((wins / rankedGames) * 100)
                        };
                    }
                }
            }
        }
    } catch (e) {
        console.error('[ProfileEnhanced] Monthly stats error:', e);
    }

    // 2. Fetch AI coach feedback from video_analyses
    let coachFeedback: CoachFeedbackSummary | null = null;
    try {
        const { data: analyses } = await supabase
            .from('video_analyses')
            .select('result, inputs, created_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(30); // Last 30 analyses

        if (analyses && analyses.length > 0) {
            const macroConcepts: Record<string, number> = {};
            const microCategories: Record<string, number> = {};
            let macroCount = 0;
            let microCount = 0;

            for (const analysis of analyses) {
                const result = analysis.result as any;
                const inputs = analysis.inputs as any;
                if (!result) continue;

                const mode = inputs?.mode || 'MACRO'; // Default to MACRO for legacy data

                if (mode === 'MACRO') {
                    macroCount++;
                    // Extract macro concepts from segments
                    if (result.segments && Array.isArray(result.segments)) {
                        for (const segment of result.segments) {
                            const concept = segment.winningPattern?.macroConceptUsed;
                            if (concept) {
                                macroConcepts[concept] = (macroConcepts[concept] || 0) + 1;
                            }
                        }
                    }
                } else if (mode === 'MICRO') {
                    microCount++;
                    // Extract micro categories from enhanced.improvements
                    if (result.enhanced?.improvements && Array.isArray(result.enhanced.improvements)) {
                        for (const improvement of result.enhanced.improvements) {
                            const category = improvement.category;
                            if (category) {
                                microCategories[category] = (microCategories[category] || 0) + 1;
                            }
                        }
                    }
                    // Also check legacy mistakes array
                    if (result.mistakes && Array.isArray(result.mistakes)) {
                        for (const mistake of result.mistakes) {
                            // Use title as category for legacy data
                            const title = mistake.title;
                            if (title) {
                                microCategories[title] = (microCategories[title] || 0) + 1;
                            }
                        }
                    }
                }
            }

            // Sort and get top issues
            const macroIssues = Object.entries(macroConcepts)
                .map(([concept, count]) => ({ concept, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            const microIssues = Object.entries(microCategories)
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            // Only create feedback if there's at least some data
            if (macroCount > 0 || microCount > 0) {
                coachFeedback = {
                    macroAnalyses: macroCount,
                    microAnalyses: microCount,
                    macroIssues,
                    microIssues
                };
            }
        }
    } catch (e) {
        console.error('[ProfileEnhanced] Coach feedback error:', e);
    }

    return { monthlyStats, coachFeedback };
}

// === RANK GOAL TYPES & FUNCTIONS ===

import { TIER_ORDER, RANK_ORDER } from '@/lib/rankUtils';

export type RankGoal = {
    tier: string;
    rank: string;
    setAt: string; // ISO timestamp
}

/**
 * Get rank goal for a summoner
 */
export async function getRankGoal(puuid: string): Promise<RankGoal | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('summoner_accounts')
        .select('rank_goal')
        .eq('puuid', puuid)
        .single();

    if (error || !data?.rank_goal) {
        return null;
    }

    return data.rank_goal as RankGoal;
}

/**
 * Set rank goal for a summoner
 */
export async function setRankGoal(puuid: string, tier: string, rank: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Validate tier and rank
    if (!TIER_ORDER.includes(tier.toUpperCase())) {
        return { success: false, error: 'Invalid tier' };
    }

    // Master+ don't have rank divisions
    const tierIndex = TIER_ORDER.indexOf(tier.toUpperCase());
    if (tierIndex < 7 && !RANK_ORDER.includes(rank.toUpperCase())) {
        return { success: false, error: 'Invalid rank' };
    }

    const goal: RankGoal = {
        tier: tier.toUpperCase(),
        rank: tierIndex >= 7 ? 'I' : rank.toUpperCase(),
        setAt: new Date().toISOString()
    };

    const { error } = await supabase
        .from('summoner_accounts')
        .update({ rank_goal: goal })
        .eq('puuid', puuid);

    if (error) {
        console.error('[RankGoal] Set error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Clear rank goal for a summoner
 */
export async function clearRankGoal(puuid: string): Promise<{ success: boolean }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('summoner_accounts')
        .update({ rank_goal: null })
        .eq('puuid', puuid);

    if (error) {
        console.error('[RankGoal] Clear error:', error);
        return { success: false };
    }

    return { success: true };
}

// Internal Helper to process matches into stats
function processMatchStats(matches: any[], puuid: string, initialResult: MatchStatsDTO & BasicStatsDTO): MatchStatsDTO & BasicStatsDTO {
    const result = { ...initialResult }; // Copy
    const championMap = new Map<string, { wins: number, games: number, k: number, d: number, a: number, cs: number }>();
    
    let totalK = 0, totalD = 0, totalA = 0;
    let totalDmgObj = 0, totalVision = 0, totalCS = 0, totalDuration = 0, gameCount = 0;
    let totalTeamKills = 0, totalDamage = 0; // For QuickStats

    // Unique Stats Trackers
    const winCondTracker = { firstBlood: { wins: 0, total: 0 }, firstTower: { wins: 0, total: 0 }, soloKill: { wins: 0, total: 0 } };
    const opponentMap = new Map<string, { wins: number, total: number }>();
    let soloDeathCount = 0, totalCsAt10 = 0, totalMaxCsAdv = 0;
    let closeWins = 0, closeTotal = 0, stompWins = 0, stompTotal = 0;

    // Role Stats Tracker
    const roleCounter: RoleStats = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 };

    // Filter & Sort
    const validMatches = matches.filter(m => m.gameMode === 'CLASSIC');
    validMatches.sort((a, b) => b.gameCreation - a.gameCreation);

    validMatches.forEach(info => {
        const p = info.participants.find((p: any) => p.puuid === puuid);
        if (!p) return;

        // Recent Matches
        result.recentMatches.push({ win: p.win, timestamp: info.gameCreation });

        // Role Stats
        const role = p.teamPosition as keyof RoleStats;
        if (role && roleCounter[role] !== undefined) {
            roleCounter[role]++;
        }

        // Champion Stats
        const champ = p.championName;
        const current = championMap.get(champ) || { wins: 0, games: 0, k: 0, d: 0, a: 0, cs: 0 };
        current.games++;
        if (p.win) current.wins++;
        current.k += p.kills; current.d += p.deaths; current.a += p.assists;
        current.cs += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        championMap.set(champ, current);

        // Radar
        const durationMin = (info.gameDuration || 1) / 60;
        totalDuration += durationMin;
        gameCount++;
        totalK += p.kills; totalD += p.deaths; totalA += p.assists;
        totalDmgObj += p.damageDealtToObjectives || 0;
        totalVision += p.visionScore || 0;
        totalCS += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        totalDamage += p.totalDamageDealtToChampions || 0;

        // Team kills for kill participation
        const teamKills = info.participants
            .filter((pt: any) => pt.teamId === p.teamId)
            .reduce((acc: number, pt: any) => acc + (pt.kills || 0), 0);
        totalTeamKills += teamKills;

        // Unique
        if (p.firstBloodKill) { winCondTracker.firstBlood.total++; if (p.win) winCondTracker.firstBlood.wins++; }
        if (p.firstTowerKill) { winCondTracker.firstTower.total++; if (p.win) winCondTracker.firstTower.wins++; }
        if (p.challenges?.soloKills > 0) { winCondTracker.soloKill.total++; if (p.win) winCondTracker.soloKill.wins++; }

        const enemy = info.participants.find((ep: any) => ep.teamId !== p.teamId && ep.teamPosition === p.teamPosition);
        if (enemy && p.teamPosition !== 'UTILITY' && p.teamPosition !== 'JUNGLE') { 
            const ename = enemy.championName;
            const ecurr = opponentMap.get(ename) || { wins: 0, total: 0 };
            ecurr.total++; if (p.win) ecurr.wins++;
            opponentMap.set(ename, ecurr);
        }

        if (p.challenges?.soloKillsTaken > 0) {
            soloDeathCount++;
        }
        
        // DEBUG: Logging first 3 matches to check data availability
        if (gameCount <= 3) {
             console.log(`[StatsDebug] GameID ${info.gameId} | Mode: ${info.gameMode} | SoloTaken: ${p.challenges?.soloKillsTaken} | HasChallenges: ${!!p.challenges}`);
        }

        totalCsAt10 += ((p.challenges?.laneMinionsFirst10Minutes || 0) + (p.challenges?.jungleCsBefore10Minutes || 0));
        totalMaxCsAdv += (p.challenges?.maxCsAdvantageOnLaneOpponent || 0);

        const myTeamGold = info.participants.filter((pt: any) => pt.teamId === p.teamId).reduce((acc: number, c: any) => acc + (c.goldEarned || 0), 0);
        const enemyTeamGold = info.participants.filter((pt: any) => pt.teamId !== p.teamId).reduce((acc: number, c: any) => acc + (c.goldEarned || 0), 0);
        const diff = Math.abs(myTeamGold - enemyTeamGold);
        if (diff < 5000) { closeTotal++; if (p.win) closeWins++; }
        else if (diff > 10000) { stompTotal++; if (p.win) stompWins++; }
    });

    // Formatting
    result.championStats = Array.from(championMap.entries()).map(([name, data]) => ({
        name, games: data.games, wins: data.wins,
        avgKills: parseFloat((data.k/data.games).toFixed(1)),
        avgDeaths: parseFloat((data.d/data.games).toFixed(1)),
        avgAssists: parseFloat((data.a/data.games).toFixed(1)),
        avgCs: parseFloat((data.cs/data.games).toFixed(1)),
        winRate: Math.round((data.wins/data.games)*100),
        avgKda: ((data.k+data.a)/Math.max(1, data.d)).toFixed(2)
    })).sort((a,b)=>b.games-a.games);

    if (gameCount > 0) {
        result.radarStats = {
            combat: Math.min(100, Math.round(((totalK+totalA)/Math.max(1, totalD))*20)),
            objective: Math.min(100, Math.round(((totalDmgObj/gameCount)/15000)*100)),
            vision: Math.min(100, Math.round(((totalVision/totalDuration)/2.0)*100)),
            farming: Math.min(100, Math.round((totalCS/totalDuration)*10)),
            survival: Math.max(0, Math.round(100 - ((totalD/gameCount)*10)))
        };
        
        const nemesisList = Array.from(opponentMap.entries()).map(([name, d]) => ({ name, wins: d.wins, games: d.total, winRate: Math.round((d.wins/d.total)*100) }));
        result.uniqueStats = {
            winConditions: [
                { label: "Gets First Blood", count: winCondTracker.firstBlood.total, winRate: winCondTracker.firstBlood.total ? Math.round((winCondTracker.firstBlood.wins/winCondTracker.firstBlood.total)*100) : 0 },
                { label: "Gets First Tower", count: winCondTracker.firstTower.total, winRate: winCondTracker.firstTower.total ? Math.round((winCondTracker.firstTower.wins/winCondTracker.firstTower.total)*100) : 0 },
                { label: "Gets Solo Kill", count: winCondTracker.soloKill.total, winRate: winCondTracker.soloKill.total ? Math.round((winCondTracker.soloKill.wins/winCondTracker.soloKill.total)*100) : 0 }
            ].sort((a,b)=>b.winRate-a.winRate),
            nemesis: nemesisList.filter(n=>n.winRate<50).sort((a,b)=>a.winRate-b.winRate).slice(0,3),
            prey: nemesisList.filter(n=>n.winRate>=50).sort((a,b)=>b.winRate-a.winRate).slice(0,3),
            survival: { csAdvantage: Math.round(totalMaxCsAdv / gameCount), csAt10: parseFloat((totalCsAt10/gameCount).toFixed(1)) },
            clutch: { closeWr: closeTotal ? Math.round((closeWins/closeTotal)*100) : 0, stompWr: stompTotal ? Math.round((stompWins/stompTotal)*100) : 0, closeGames: closeTotal, stompGames: stompTotal }
        };

        // QuickStats
        result.quickStats = {
            csPerMin: parseFloat((totalCS / totalDuration).toFixed(1)),
            visionPerMin: parseFloat((totalVision / totalDuration).toFixed(2)),
            kda: parseFloat(((totalK + totalA) / Math.max(1, totalD)).toFixed(2)),
            killParticipation: totalTeamKills > 0 ? Math.round(((totalK + totalA) / totalTeamKills) * 100) : 0,
            avgDamage: Math.round(totalDamage / gameCount),
            gamesAnalyzed: gameCount
        };

        // RoleStats
        result.roleStats = roleCounter;
    }

    return result;
}
