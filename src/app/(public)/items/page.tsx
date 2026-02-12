import type { Metadata } from "next";
import { fetchDDItemData, fetchLatestVersion } from "@/app/actions/riot";
import ItemDatabaseClient from "./ItemDatabaseClient";

export const metadata: Metadata = {
    title: "Item Database - LoL Coach AI | All League of Legends Items",
    description:
        "Browse all League of Legends items. View stats, gold costs, build paths, and passive effects. Free item database powered by LoL Coach AI.",
    openGraph: {
        title: "Item Database - LoL Coach AI",
        description: "Browse all League of Legends items with stats, gold costs, and build paths.",
        type: "website",
    },
};

export default async function ItemsPage() {
    const [itemResult, version] = await Promise.all([
        fetchDDItemData("ja"),
        fetchLatestVersion(),
    ]);
    const itemMap = itemResult?.idMap || {};

    return (
        <ItemDatabaseClient itemDataMap={itemMap} version={version} />
    );
}
