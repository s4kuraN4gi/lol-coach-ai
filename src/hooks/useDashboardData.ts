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
 * - With fallbackData (SSR): returns data instantly, revalidates in background
 * - Without fallbackData: fetches data, shows loading state
 * - Subsequent visits: returns SWR cached data instantly
 */
export function useDashboardStats(puuid: string | null, fallbackData?: DashboardStats) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `dashboard-stats-${puuid}` : null,
        () => fetchDashboardStats(puuid!),
        {
            dedupingInterval: 10000, // 10 seconds
            revalidateOnFocus: false,
            ...(fallbackData ? { fallbackData } : {}),
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
export function useEnhancedData(puuid: string | null, fallbackData?: ProfileEnhancedData) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `enhanced-data-${puuid}` : null,
        () => fetchEnhancedData(puuid!),
        {
            dedupingInterval: 10000,
            revalidateOnFocus: false,
            ...(fallbackData ? { fallbackData } : {}),
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
 * - With SSR fallback: instant first paint, revalidates in background
 * - Without fallback: fetches all data in parallel, shows loading state
 * - Subsequent visits: returns SWR cached data instantly
 */
export function useDashboard(
    puuid: string | null,
    options?: { initialStats?: DashboardStats; initialEnhancedData?: ProfileEnhancedData }
) {
    const { stats, isLoading: statsLoading, isValidating: statsValidating, refresh: refreshStats } =
        useDashboardStats(puuid, options?.initialStats);

    const { enhancedData, isLoading: enhancedLoading, isValidating: enhancedValidating, refresh: refreshEnhanced } =
        useEnhancedData(puuid, options?.initialEnhancedData);

    // Determine queue type from stats
    const hasSolo = stats?.ranks?.some((r) => r.queueType === "RANKED_SOLO_5x5");
    const queueType = hasSolo ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR';

    const { rankHistory, isLoading: historyLoading, isValidating: historyValidating, refresh: refreshHistory } =
        useRankHistory(puuid, queueType as 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR');

    // Get displayed rank
    const displayedRank = stats?.ranks?.find((r) => r.queueType === queueType) || null;

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
