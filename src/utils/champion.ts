
const DDRAGON_VERSION = "14.24.1";
const LOCALE = "en_US"; // or ja_JP

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
            const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/${LOCALE}/champion.json`);
            if (!res.ok) return null;
            const data = await res.json();
            
            championCache = new Map();
            Object.values(data.data).forEach((c: any) => {
                championCache!.set(c.id.toLowerCase(), {
                    id: c.id,
                    key: c.key,
                    name: c.name,
                    image: c.image
                });
            });
        } catch (e) {
            console.error("Failed to fetch DDragon data", e);
            return null;
        }
    }

    // Try finding by ID (Aatrox) - case insensitive
    // Input might be "Aatrox" or "aatrox"
    return championCache?.get(championName.toLowerCase()) || null;
}
