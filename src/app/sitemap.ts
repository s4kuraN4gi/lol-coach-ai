import { MetadataRoute } from 'next';
import { fetchAllChampions } from '@/app/actions/riot';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const result = await fetchAllChampions('en');
    const champions = result?.champions || [];
    const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://lolcoachai.com';

    const goldAssetIds = [
        "dragon_infernal", "dragon_mountain", "dragon_ocean", "dragon_cloud",
        "dragon_hextech", "dragon_chemtech",
        "baron", "herald", "void_grubs",
    ];

    return [
        { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1.0 },
        { url: `${BASE}/champions`, changeFrequency: 'weekly', priority: 0.9 },
        { url: `${BASE}/items`, changeFrequency: 'weekly', priority: 0.9 },
        { url: `${BASE}/guide/gold`, changeFrequency: 'monthly', priority: 0.8 },
        { url: `${BASE}/guide/gold/market`, changeFrequency: 'monthly', priority: 0.7 },
        ...goldAssetIds.map(id => ({
            url: `${BASE}/guide/gold/market/${id}`,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        })),
        { url: `${BASE}/guide/runes`, changeFrequency: 'monthly', priority: 0.8 },
        { url: `${BASE}/pricing`, changeFrequency: 'monthly', priority: 0.7 },
        { url: `${BASE}/analyze`, changeFrequency: 'monthly', priority: 0.8 },
        { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.2 },
        ...champions.map((c: any) => ({
            url: `${BASE}/champions/${c.id}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        })),
    ];
}
