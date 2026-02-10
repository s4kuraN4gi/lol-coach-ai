import { createClient } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import { redirect } from "next/navigation";
import ChampionDetailView from "./ChampionDetailView";
import NoSummonerMessage from "./NoSummonerMessage";

export default async function ChampionPage({ params }: { params: Promise<{ name: string }> }) {
    const { name } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Use centralized logic to get the active summoner
    const activeSummoner = await getActiveSummoner();
    const puuid = activeSummoner?.puuid;

    if (!puuid) {
         return <NoSummonerMessage />;
    }

    return (
        <ChampionDetailView puuid={puuid} championName={decodeURIComponent(name)} />
    );
}
