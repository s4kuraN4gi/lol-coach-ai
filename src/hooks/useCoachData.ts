"use client";

import useSWR from "swr";
import type { MatchSummary } from "@/app/actions/coach";
import type { AnalysisStatus } from "@/app/actions/constants";

// Fetcher functions
async function fetchCoachMatches(puuid: string): Promise<MatchSummary[]> {
    const { getCoachMatches } = await import("@/app/actions/coach");
    return getCoachMatches(puuid);
}

async function fetchAnalysisStatus(): Promise<AnalysisStatus | null> {
    const { getAnalysisStatus } = await import("@/app/actions/analysis");
    return getAnalysisStatus();
}

async function fetchAnalyzedMatchIds(): Promise<string[]> {
    const { getAnalyzedMatchIds } = await import("@/app/actions/analysis");
    return getAnalyzedMatchIds();
}

async function fetchDdVersion(): Promise<string> {
    const { fetchLatestVersion } = await import("@/app/actions/riot");
    return fetchLatestVersion();
}

/**
 * Hook for coach matches with SWR caching
 */
export function useCoachMatches(puuid: string | null) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `coach-matches-${puuid}` : null,
        () => fetchCoachMatches(puuid!),
        {
            dedupingInterval: 30000, // 30 seconds
            revalidateOnFocus: false,
        }
    );

    return {
        matches: data || [],
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for analysis status with SWR caching
 */
export function useAnalysisStatus() {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        'analysis-status',
        fetchAnalysisStatus,
        {
            dedupingInterval: 10000,
            revalidateOnFocus: false,
        }
    );

    return {
        status: data,
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for analyzed match IDs with SWR caching
 */
export function useAnalyzedMatchIds() {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        'analyzed-match-ids',
        fetchAnalyzedMatchIds,
        {
            dedupingInterval: 30000,
            revalidateOnFocus: false,
        }
    );

    return {
        analyzedIds: data || [],
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for Data Dragon version with SWR caching
 */
export function useDdVersion() {
    const { data, error, isLoading } = useSWR(
        'dd-version',
        fetchDdVersion,
        {
            dedupingInterval: 3600000, // 1 hour - version rarely changes
            revalidateOnFocus: false,
        }
    );

    return {
        ddVersion: data || "14.24.1", // fallback version
        error,
        isLoading: isLoading && !data,
    };
}

/**
 * Combined hook for all coach page data
 */
export function useCoachData(puuid: string | null) {
    const { matches, isLoading: matchesLoading, isValidating: matchesValidating, refresh: refreshMatches } =
        useCoachMatches(puuid);

    const { status, isLoading: statusLoading, isValidating: statusValidating, refresh: refreshStatus } =
        useAnalysisStatus();

    const { analyzedIds, isLoading: idsLoading, isValidating: idsValidating, refresh: refreshIds } =
        useAnalyzedMatchIds();

    const { ddVersion, isLoading: versionLoading } =
        useDdVersion();

    const refreshAll = async () => {
        await Promise.all([
            refreshMatches(),
            refreshStatus(),
            refreshIds(),
        ]);
    };

    return {
        matches,
        status,
        analyzedIds,
        ddVersion,
        isLoading: matchesLoading || statusLoading || idsLoading || versionLoading,
        isValidating: matchesValidating || statusValidating || idsValidating,
        refreshAll,
        refreshStatus,
    };
}
