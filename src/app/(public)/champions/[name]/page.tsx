import type { Metadata } from "next";
import { fetchAllChampions, fetchChampionDetail, fetchLatestVersion } from "@/app/actions/riot";
import ChampionDetailContent from "./ChampionDetailContent";
import JsonLd from "../../components/JsonLd";

type Props = {
    params: Promise<{ name: string }>;
};

export async function generateStaticParams() {
    const result = await fetchAllChampions("en");
    if (!result) return [];
    return result.champions.map((c: any) => ({ name: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { name } = await params;
    const detail = await fetchChampionDetail(name, "en");
    if (!detail) {
        return { title: `${name} - LoL Coach AI` };
    }
    return {
        title: `${detail.name} - ${detail.title} | LoL Coach AI Champion Database`,
        description: `${detail.name}, ${detail.title}. ${detail.blurb?.slice(0, 150)}... View stats, abilities, lore and tips.`,
        openGraph: {
            title: `${detail.name} - ${detail.title} | LoL Coach AI`,
            description: detail.blurb?.slice(0, 200),
            images: [
                {
                    url: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`,
                    width: 1215,
                    height: 717,
                },
            ],
        },
    };
}

export default async function ChampionDetailPage({ params }: Props) {
    const { name } = await params;
    const [detail, version] = await Promise.all([
        fetchChampionDetail(name, "ja"),
        fetchLatestVersion(),
    ]);

    if (!detail) {
        return (
            <div className="container mx-auto px-6 py-20 text-center">
                <h1 className="text-2xl font-bold text-white mb-4">Champion Not Found</h1>
                <p className="text-gray-400">Could not load data for &quot;{name}&quot;.</p>
            </div>
        );
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        name: `${detail.name} - ${detail.title}`,
        description: detail.blurb,
        image: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`,
        author: { "@type": "Organization", name: "LoL Coach AI" },
        publisher: { "@type": "Organization", name: "LoL Coach AI" },
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <ChampionDetailContent champion={detail} version={version} champId={name} />
        </>
    );
}
