import { fetchLatestVersion } from "@/app/actions/riot";
import { logger } from "@/lib/logger";

const LOCALE = "en_US";

export type ChampionData = {
    id: string; // "Aatrox"
    key: string; // "266"
    name: string; // "Aatrox"
    image: { full: string };
};

let championCache: Map<string, ChampionData> | null = null;

export async function getChampionData(championName: string): Promise<ChampionData | null> {
    if (!championCache) {
        try {
            const version = await fetchLatestVersion();
            const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${LOCALE}/champion.json`);
            if (!res.ok) return null;
            const data = await res.json();
            
            championCache = new Map();
            Object.values(data.data).forEach((c: unknown) => {
                const champ = c as { id: string; key: string; name: string; image: { full: string } };
                championCache!.set(champ.id.toLowerCase(), {
                    id: champ.id,
                    key: champ.key,
                    name: champ.name,
                    image: champ.image
                });
            });
        } catch (e) {
            logger.error("Failed to fetch DDragon data", e);
            return null;
        }
    }

    // Try finding by ID (Aatrox) - case insensitive
    // Input might be "Aatrox" or "aatrox"
    return championCache?.get(championName.toLowerCase()) || null;
}
