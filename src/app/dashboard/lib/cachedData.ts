// Cached data fetching for dashboard
// Uses React's cache() to deduplicate requests within a single render
import { cache } from "react";
import {
    getStatsFromCache,
    fetchRankHistory,
    fetchProfileEnhancedData,
    type MatchStatsDTO,
    type BasicStatsDTO,
    type RankHistoryEntry,
    type ProfileEnhancedData
} from "@/app/actions/stats";

type DashboardStats = MatchStatsDTO & BasicStatsDTO;

// Cached stats fetcher - deduplicates within a single request
export const getCachedStats = cache(async (puuid: string): Promise<DashboardStats> => {
    console.log(`[CachedData] Fetching stats for ${puuid.slice(0, 8)}...`);
    return getStatsFromCache(puuid);
});

// Cached enhanced data fetcher
export const getCachedEnhancedData = cache(async (puuid: string): Promise<ProfileEnhancedData> => {
    console.log(`[CachedData] Fetching enhanced data for ${puuid.slice(0, 8)}...`);
    return fetchProfileEnhancedData(puuid);
});

// Cached rank history fetcher
export const getCachedRankHistory = cache(async (
    puuid: string,
    queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR',
    days: number = 30
): Promise<RankHistoryEntry[]> => {
    console.log(`[CachedData] Fetching rank history for ${puuid.slice(0, 8)}...`);
    return fetchRankHistory(puuid, queueType, days);
});

// Helper to determine queue type from stats
export function getQueueType(stats: DashboardStats): 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' {
    const hasSolo = stats.ranks?.some((r: any) => r.queueType === "RANKED_SOLO_5x5");
    return hasSolo ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR';
}

// Helper to get displayed rank
export function getDisplayedRank(stats: DashboardStats) {
    const queueType = getQueueType(stats);
    return stats.ranks?.find((r: any) => r.queueType === queueType) || null;
}
