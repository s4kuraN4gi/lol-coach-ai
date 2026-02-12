import { Metadata } from "next";
import { fetchRunesReforged } from "@/app/actions/riot";
import RuneGuideClient from "./RuneGuideClient";

export const metadata: Metadata = {
    title: "Rune Guide - LoL Coach AI | All League of Legends Runes",
    description: "Browse all League of Legends runes. Explore Precision, Domination, Sorcery, Resolve, and Inspiration trees with keystones and secondary runes.",
    openGraph: {
        title: "Rune Guide - LoL Coach AI",
        description: "Complete League of Legends rune reference. All 5 rune trees, keystones, and secondary runes explained.",
    },
};

export default async function RuneGuidePage() {
    const result = await fetchRunesReforged("ja");
    return <RuneGuideClient runeData={result?.runes || []} />;
}
