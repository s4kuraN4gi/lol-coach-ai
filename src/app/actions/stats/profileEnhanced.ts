'use server'

import { createClient, getUser } from "@/utils/supabase/server";
import { logger } from "@/lib/logger";
import type { MonthlyStats, CoachFeedbackSummary, ProfileEnhancedData } from "./types";

/**
 * Fetch enhanced profile data:
 * 1. Monthly ranked match statistics
 * 2. Aggregated AI coach feedback
 */
export async function fetchProfileEnhancedData(puuid: string): Promise<ProfileEnhancedData> {
    const supabase = await createClient();
    const user = await getUser();

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
                            const participant = info.participants?.find((p: { puuid: string; win: boolean }) => p.puuid === puuid);
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
        logger.error('[ProfileEnhanced] Monthly stats error:', e);
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
        logger.error('[ProfileEnhanced] Coach feedback error:', e);
    }

    return { monthlyStats, coachFeedback };
}
