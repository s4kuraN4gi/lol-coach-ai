import type { Metadata } from "next";
import { fetchAllChampions } from "@/app/actions/riot";
import ChampionListClient from "./ChampionListClient";

export const metadata: Metadata = {
    title: "Champion Database - LoL Coach AI | All League of Legends Champions",
    description:
        "Browse all 160+ League of Legends champions. View stats, abilities, lore, and tips. Free champion database powered by LoL Coach AI.",
    openGraph: {
        title: "Champion Database - LoL Coach AI",
        description: "Browse all 160+ League of Legends champions with stats, abilities, and lore.",
        type: "website",
    },
};

export default async function ChampionsPage() {
    const result = await fetchAllChampions("ja");
    const version = result?.version || "14.24.1";
    const champions = result?.champions || [];

    return (
        <ChampionListClient champions={champions} version={version} />
    );
}
