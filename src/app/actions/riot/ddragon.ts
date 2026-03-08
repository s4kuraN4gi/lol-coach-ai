'use server'

import { logger } from "@/lib/logger";

// 8. Get Latest Version
export async function fetchLatestVersion(): Promise<string> {
    try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { next: { revalidate: 3600 } });
        if (!res.ok) return "14.24.1"; // Fallback
        const versions = await res.json();
        return versions[0] || "14.24.1";
    } catch (e) {
        logger.error("fetchLatestVersion error:", e);
        return "14.24.1";
    }
}

// 10r. Get Runes Reforged (for public rune guide)
export async function fetchRunesReforged(language: 'ja' | 'en' | 'ko' = 'ja') {
    const localeMap: Record<string, string> = { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR' };
    const locale = localeMap[language] || 'ja_JP';
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/runesReforged.json`;
    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        return { version, runes: await res.json() as any[] };
    } catch (e) {
        logger.error("fetchRunesReforged error:", e);
        return null;
    }
}

// 10a. Get All Champions (for public champion DB)
export async function fetchAllChampions(language: 'ja' | 'en' | 'ko' = 'ja') {
    const localeMap: Record<string, string> = { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR' };
    const locale = localeMap[language] || 'ja_JP';
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion.json`;
    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        const data = await res.json();
        return { version, champions: Object.values(data.data) as any[] };
    } catch (e) {
        logger.error("fetchAllChampions error:", e);
        return null;
    }
}

// 10. Get DDragon Item Data (Cached per language)
const _itemCacheByLang: Record<string, Record<string, any>> = {};
const _itemNameCacheByLang: Record<string, Record<string, string>> = {}; // Name -> ID

export async function fetchDDItemData(language: 'ja' | 'en' | 'ko' = 'ja'): Promise<{ idMap: Record<string, any>, nameMap: Record<string, string> } | null> {
    // Map language code to Data Dragon locale
    const localeMap: Record<string, string> = {
        'ja': 'ja_JP',
        'en': 'en_US',
        'ko': 'ko_KR'
    };
    const locale = localeMap[language] || 'ja_JP';

    if (_itemCacheByLang[locale] && _itemNameCacheByLang[locale]) {
        return { idMap: _itemCacheByLang[locale], nameMap: _itemNameCacheByLang[locale] };
    }

    // Fetch latest version dynamically
    const version = await fetchLatestVersion();
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/item.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const data = await res.json();
        _itemCacheByLang[locale] = data.data;

        _itemNameCacheByLang[locale] = {};
        // Build Name -> ID Map (Normalize names to lower case for loose matching)
        for (const [id, item] of Object.entries(data.data as Record<string, any>)) {
            _itemNameCacheByLang[locale][item.name.toLowerCase()] = id;
            // Also map colloquials if we want later
        }

        return { idMap: _itemCacheByLang[locale]!, nameMap: _itemNameCacheByLang[locale]! };
    } catch (e) {
        logger.error("fetchDDItemData error:", e);
        return null;
    }
}

// 10b. Get DDragon Champion Detail (Stats + Spells) for Damage Calculator
const _championDetailCache: Record<string, any> = {};

export async function fetchChampionDetail(championName: string, language: 'ja' | 'en' | 'ko' = 'ja'): Promise<any | null> {
    const localeMap: Record<string, string> = {
        'ja': 'ja_JP',
        'en': 'en_US',
        'ko': 'ko_KR'
    };
    const locale = localeMap[language] || 'ja_JP';
    const cacheKey = `${championName}_${locale}`;

    if (_championDetailCache[cacheKey]) {
        return _championDetailCache[cacheKey];
    }

    const version = await fetchLatestVersion();
    // Fix known DDragon naming inconsistencies
    const nameMap: Record<string, string> = {
        "FiddleSticks": "Fiddlesticks",
    };
    const cName = nameMap[championName] || championName;
    const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${cName}.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;

        const data = await res.json();
        const detail = data.data?.[cName] || null;
        if (detail) {
            _championDetailCache[cacheKey] = detail;
        }
        return detail;
    } catch (e) {
        logger.error("fetchChampionDetail error:", e);
        return null;
    }
}

// 10c. Get CommunityDragon bin.json for champion spell data
const _championBinCache: Record<string, Record<string, any>> = {};

export async function fetchChampionBinData(championName: string): Promise<Record<string, any> | null> {
    const champLower = championName.toLowerCase();
    if (_championBinCache[champLower]) {
        return _championBinCache[champLower];
    }

    const url = `https://raw.communitydragon.org/latest/game/data/characters/${champLower}/${champLower}.bin.json`;

    try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) {
            logger.error(`fetchChampionBinData error: ${res.status} for ${championName}`);
            return null;
        }

        const data = await res.json();
        _championBinCache[champLower] = data;
        return data;
    } catch (e) {
        logger.error("fetchChampionBinData error:", e);
        return null;
    }
}
