// Server Component - SSR prefetch for instant first paint
// - Server: Auth + summoner + stats prefetch (parallel)
// - Client: SWR uses SSR data as fallback, revalidates in background

import { redirect } from "next/navigation";
import { getUser } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import { getCachedStats, getCachedEnhancedData } from "./lib/cachedData";
import DashboardLayout from "../components/layout/DashboardLayout";
import DashboardContent from "./components/DashboardContent";

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // 1. Auth check (fast - cached per request via React.cache)
    const user = await getUser();

    if (!user) {
        redirect('/login');
    }

    // 2. Get active summoner (fast - single DB query)
    const activeSummoner = await getActiveSummoner();

    if (!activeSummoner?.puuid) {
        redirect('/onboarding');
    }

    const puuid = activeSummoner.puuid;

    // 3. SSR prefetch: stats + enhanced data in parallel
    const [initialStats, initialEnhancedData] = await Promise.all([
        getCachedStats(puuid).catch(() => null),
        getCachedEnhancedData(puuid).catch(() => null),
    ]);

    const summoner = {
        name: activeSummoner.summoner_name,
        tagLine: activeSummoner.tag_line || "",
        profileIconId: activeSummoner.profile_icon_id || 29,
        summonerLevel: activeSummoner.summoner_level || 0,
        puuid,
    };

    return (
        <DashboardLayout>
            <DashboardContent
                summoner={summoner}
                initialStats={initialStats}
                initialEnhancedData={initialEnhancedData}
            />
        </DashboardLayout>
    );
}
