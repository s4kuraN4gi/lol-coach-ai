import { Metadata } from "next";
import GoldEconomyContent from "@/components/guide/gold/GoldEconomyContent";

export const metadata: Metadata = {
    title: "Gold Economy Guide - LoL Coach AI",
    description: "Learn League of Legends gold economy fundamentals. Understand the value of CS, kills, objectives, and how to maximize your gold income every game.",
    openGraph: {
        title: "Gold Economy Guide - LoL Coach AI",
        description: "Master LoL gold economy: CS value, kill gold, objective rewards, and income optimization strategies.",
    },
};

export default function GoldGuidePage() {
    return <GoldEconomyContent basePath="/guide/gold" />;
}
