import { Metadata } from "next";
import GoldAssetDetailContent from "@/components/guide/gold/GoldAssetDetailContent";
import goldConstants from "@/data/gold_constants.json";
import { getLocalizedName } from "@/utils/goldLocalization";

export function generateStaticParams() {
    return [
        "dragon_infernal", "dragon_mountain", "dragon_ocean", "dragon_cloud",
        "dragon_hextech", "dragon_chemtech",
        "baron", "herald", "void_grubs"
    ].map(id => ({ id }));
}

function getAssetName(id: string): string {
    if (id.startsWith("dragon_")) {
        const dragonKey = id.replace("dragon_", "");
        // @ts-ignore
        const dragon = goldConstants.objectives.dragons[dragonKey];
        return dragon ? getLocalizedName(dragon, "en") : id;
    }
    // @ts-ignore
    const asset = goldConstants.objectives[id];
    return asset ? getLocalizedName(asset, "en") : id;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const name = getAssetName(id);
    return {
        title: `${name} - Gold Guide | LoL Coach AI`,
        description: `Learn about ${name} in League of Legends: gold value, buff effects, tactical advice, and how to secure or contest this objective.`,
        openGraph: {
            title: `${name} - Gold Guide | LoL Coach AI`,
            description: `${name} gold value, buff effects, and tactical guide for League of Legends.`,
        },
    };
}

export default async function GoldAssetDetailGuidePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <GoldAssetDetailContent id={id} basePath="/guide/gold" />;
}
