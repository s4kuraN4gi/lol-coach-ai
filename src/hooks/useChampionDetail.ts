"use client";

import useSWR from "swr";
import type { DDragonChampionDetail } from "@/app/dashboard/match/[matchId]/components/DamageCalculator/types";

async function fetchDetail(key: string): Promise<DDragonChampionDetail | null> {
    const [, championName, language] = key.split(":");
    const { fetchChampionDetail } = await import("@/app/actions/riot");
    return fetchChampionDetail(championName, language as 'ja' | 'en' | 'ko');
}

async function fetchBin(key: string): Promise<Record<string, any> | null> {
    const [, championName] = key.split(":");
    const { fetchChampionBinData } = await import("@/app/actions/riot");
    return fetchChampionBinData(championName);
}

/**
 * SWR hook for fetching DDragon champion detail data (stats + spells)
 * and CommunityDragon bin data (spell values).
 * Cached for 24 hours since champion data rarely changes mid-patch.
 */
export function useChampionDetail(championName: string | null, language: 'ja' | 'en' | 'ko' = 'ja') {
    const { data, error, isLoading } = useSWR(
        championName ? `champion-detail:${championName}:${language}` : null,
        fetchDetail,
        {
            dedupingInterval: 86400000,
            revalidateOnFocus: false,
        }
    );

    const { data: binData } = useSWR(
        championName ? `champion-bin:${championName}` : null,
        fetchBin,
        {
            dedupingInterval: 86400000,
            revalidateOnFocus: false,
        }
    );

    return {
        championDetail: data ?? null,
        binData: binData ?? null,
        error,
        isLoading,
    };
}
