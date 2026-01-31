"use client";

import useSWR from "swr";

type HistoryItem = {
    matchId: string;
    champion: string;
    win: boolean;
    kda: string;
    date: string;
    mode: string;
    duration: number;
    kills: number;
    deaths: number;
    assists: number;
};

type FilterType = "ALL" | "SOLO" | "FLEX" | "NORMAL" | "ARAM";

// Fetcher for match history
async function fetchMatchHistory(
    puuid: string,
    filter: FilterType
): Promise<HistoryItem[]> {
    const { fetchMatchIds, fetchMatchDetail } = await import("@/app/actions/riot");

    // Determine Queue ID / Type
    let queueId: number | undefined;
    let type: string | undefined;

    switch (filter) {
        case "SOLO": queueId = 420; break;
        case "FLEX": queueId = 440; break;
        case "ARAM": queueId = 450; break;
        case "NORMAL": type = "normal"; break;
        default: break;
    }

    // Fetch Match IDs
    const matchIdsRes = await fetchMatchIds(puuid, 10, queueId, type);

    if (!matchIdsRes.success || !matchIdsRes.data || matchIdsRes.data.length === 0) {
        return [];
    }

    const ids = matchIdsRes.data;

    // Fetch all match details in parallel
    const results = await Promise.all(
        ids.map(async (id) => {
            const res = await fetchMatchDetail(id);
            if (!res.success || !res.data) return null;

            const m = res.data;
            const p = m.info.participants.find((p: any) => p.puuid === puuid);

            if (!p) return null;

            return {
                matchId: m.metadata.matchId,
                champion: p.championName,
                win: p.win,
                kda: `${p.kills}/${p.deaths}/${p.assists}`,
                date: new Date(m.info.gameCreation).toLocaleDateString(),
                mode: m.info.gameMode,
                duration: m.info.gameDuration,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
            } as HistoryItem;
        })
    );

    return results.filter((item): item is HistoryItem => item !== null);
}

/**
 * Hook for match history with SWR caching
 * - First visit: fetches all matches in parallel
 * - Subsequent visits: returns cached data instantly
 */
export function useMatchHistory(puuid: string | null, filter: FilterType) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        puuid ? `match-history-${puuid}-${filter}` : null,
        () => fetchMatchHistory(puuid!, filter),
        {
            dedupingInterval: 30000, // 30 seconds
            revalidateOnFocus: false,
        }
    );

    return {
        history: data || [],
        error,
        isLoading: isLoading && !data,
        isValidating,
        refresh: mutate,
    };
}
