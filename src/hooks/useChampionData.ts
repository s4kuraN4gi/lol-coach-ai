"use client";

import useSWR from "swr";

// Fetcher for match IDs filtered by champion
async function fetchChampionMatchIds(
    puuid: string,
    championName: string
): Promise<string[]> {
    const [{ resolveChampionId }, { fetchMatchIds }] = await Promise.all([
        import("@/app/actions/champion"),
        import("@/app/actions/riot"),
    ]);

    const champIdStr = await resolveChampionId(championName);
    if (!champIdStr) {
        return [];
    }

    const champId = parseInt(champIdStr);
    const idsRes = await fetchMatchIds(puuid, 50, undefined, undefined, champId);

    if (!idsRes.success || !idsRes.data) {
        return [];
    }

    return idsRes.data;
}

// Fetcher for individual match detail
async function fetchMatchDetail(matchId: string): Promise<any> {
    const { fetchMatchDetail: fetchDetail } = await import("@/app/actions/riot");
    const res = await fetchDetail(matchId);
    return res.success ? res.data : null;
}

/**
 * Hook for champion match IDs with SWR caching
 */
export function useChampionMatchIds(puuid: string | null, championName: string | null) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid && championName ? `champion-match-ids-${puuid}-${championName}` : null,
        () => fetchChampionMatchIds(puuid!, championName!),
        {
            dedupingInterval: 60000, // 1 minute
            revalidateOnFocus: false,
        }
    );

    return {
        matchIds: data || [],
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}

/**
 * Hook for individual match detail with SWR caching
 */
export function useMatchDetail(matchId: string | null) {
    const { data, error, isLoading } = useSWR(
        matchId ? `match-detail-${matchId}` : null,
        () => fetchMatchDetail(matchId!),
        {
            dedupingInterval: 3600000, // 1 hour - match data never changes
            revalidateOnFocus: false,
        }
    );

    return {
        matchData: data,
        error,
        isLoading: isLoading && !data,
    };
}

/**
 * Hook for multiple match details with SWR caching
 * Uses individual SWR keys for each match to maximize cache hits
 */
export function useChampionMatchDetails(matchIds: string[]) {
    // We use useSWR for each match ID
    // This allows individual matches to be cached and reused
    const { data, error, isLoading } = useSWR(
        matchIds.length > 0 ? `champion-matches-${matchIds.join(',')}` : null,
        async () => {
            const { fetchMatchDetail: fetchDetail } = await import("@/app/actions/riot");

            // Fetch all matches in parallel
            const results = await Promise.all(
                matchIds.map(async (id) => {
                    const res = await fetchDetail(id);
                    return res.success ? res.data : null;
                })
            );

            return results.filter(Boolean);
        },
        {
            dedupingInterval: 60000, // 1 minute
            revalidateOnFocus: false,
        }
    );

    return {
        matches: data || [],
        error,
        isLoading: isLoading && !data,
        totalMatches: matchIds.length,
        loadedCount: data?.length || 0,
    };
}
