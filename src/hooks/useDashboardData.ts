"use client";

import useSWR from "swr";
import type { MatchStatsDTO, BasicStatsDTO, RankHistoryEntry, ProfileEnhancedData } from "@/app/actions/stats";

type DashboardStats = MatchStatsDTO & BasicStatsDTO;

// Server action wrapper for SWR
// SWR requires a fetcher that takes a key and returns data
// We wrap our server actions to work with SWR

async function fetchDashboardStats(puuid: string): Promise<DashboardStats> {
    const { getStatsFromCache } = await import("@/app/actions/stats");
    return getStatsFromCache(puuid);
}

async function fetchEnhancedData(puuid: string): Promise<ProfileEnhancedData> {
    const { fetchProfileEnhancedData } = await import("@/app/actions/stats");
    return fetchProfileEnhancedData(puuid);
}

async function fetchRankHistoryData(
    puuid: string,
    queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR'
): Promise<RankHistoryEntry[]> {
    const { fetchRankHistory } = await import("@/app/actions/stats");
    return fetchRankHistory(puuid, queueType, 30);
}

/**
 * Hook for dashboard stats with SWR caching
 * - First visit: fetches data, shows loading state
 * - Subsequent visits: returns cached data instantly, revalidates in background
 */
export function useDashboardStats(puuid: string | null) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `dashboard-stats-${puuid}` : null,
        () => fetchDashboardStats(puuid!),
        {
            dedupingInterval: 10000, // 10 seconds
            revalidateOnFocus: false,
        }
    );

    return {
        stats: data,
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for enhanced profile data with SWR caching
 */
export function useEnhancedData(puuid: string | null) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `enhanced-data-${puuid}` : null,
        () => fetchEnhancedData(puuid!),
        {
            dedupingInterval: 10000,
            revalidateOnFocus: false,
        }
    );

    return {
        enhancedData: data,
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for rank history with SWR caching
 */
export function useRankHistory(
    puuid: string | null,
    queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR'
) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `rank-history-${puuid}-${queueType}` : null,
        () => fetchRankHistoryData(puuid!, queueType),
        {
            dedupingInterval: 30000, // 30 seconds for history
            revalidateOnFocus: false,
        }
    );

    return {
        rankHistory: data || [],
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Combined hook for all dashboard data
 * - First visit: fetches all data in parallel, shows loading state
 * - Subsequent visits: returns cached data instantly, revalidates in background
 */
export function useDashboard(puuid: string | null) {
    const { stats, isLoading: statsLoading, isValidating: statsValidating, refresh: refreshStats } =
        useDashboardStats(puuid);

    const { enhancedData, isLoading: enhancedLoading, isValidating: enhancedValidating, refresh: refreshEnhanced } =
        useEnhancedData(puuid);

    // Determine queue type from stats
    const hasSolo = stats?.ranks?.some((r: any) => r.queueType === "RANKED_SOLO_5x5");
    const queueType = hasSolo ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR';

    const { rankHistory, isLoading: historyLoading, isValidating: historyValidating, refresh: refreshHistory } =
        useRankHistory(puuid, queueType as 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR');

    // Get displayed rank
    const displayedRank = stats?.ranks?.find((r: any) => r.queueType === queueType) || null;

    // Refresh all data
    const refreshAll = async () => {
        await Promise.all([
            refreshStats(),
            refreshEnhanced(),
            refreshHistory(),
        ]);
    };

    return {
        stats,
        enhancedData,
        rankHistory,
        displayedRank,
        queueType,
        isLoading: statsLoading || enhancedLoading || historyLoading,
        isValidating: statsValidating || enhancedValidating || historyValidating,
        refreshAll,
    };
}
