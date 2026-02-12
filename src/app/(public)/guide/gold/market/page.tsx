import { Metadata } from "next";
import GoldMarketContent from "@/components/guide/gold/GoldMarketContent";

export const metadata: Metadata = {
    title: "Gold Sources Catalog - LoL Coach AI",
    description: "Complete League of Legends gold source reference. Browse gold values for minions, jungle camps, dragons, baron, turrets, and all objectives.",
    openGraph: {
        title: "Gold Sources Catalog - LoL Coach AI",
        description: "Complete LoL gold source reference: minions, jungle camps, dragons, baron, turrets, and all objectives.",
    },
};

export default function GoldMarketGuidePage() {
    return <GoldMarketContent basePath="/guide/gold" />;
}
