"use client";

import useSWR from "swr";

type MatchData = {
    matchData: any;
    analysis: any;
    ddVersion: string;
};

// Fetcher function
async function fetchMatchData(matchId: string): Promise<MatchData> {
    const [
        { fetchMatchDetail, fetchLatestVersion },
        { getMatchAnalysis }
    ] = await Promise.all([
        import("@/app/actions/riot"),
        import("@/app/actions/analysis"),
    ]);

    const [matchRes, analysisRes, ddVersion] = await Promise.all([
        fetchMatchDetail(matchId),
        getMatchAnalysis(matchId),
        fetchLatestVersion(),
    ]);

    return {
        matchData: matchRes.success ? matchRes.data : null,
        analysis: analysisRes,
        ddVersion,
    };
}

/**
 * Hook for match details with SWR caching
 * - First visit: fetches match data, shows loading state
 * - Subsequent visits: returns cached data instantly
 */
export function useMatchData(matchId: string | null) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        matchId ? `match-data-${matchId}` : null,
        () => fetchMatchData(matchId!),
        {
            dedupingInterval: 60000, // 1 minute - match data doesn't change
            revalidateOnFocus: false,
        }
    );

    return {
        matchData: data?.matchData || null,
        analysis: data?.analysis || null,
        ddVersion: data?.ddVersion || "14.24.1",
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}
