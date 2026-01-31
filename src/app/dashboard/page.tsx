// Server Component - Minimal server work, data fetching on client with SWR
// - Server: Auth check + summoner info only (fast)
// - Client: SWR fetches data, caches it, instant on subsequent visits

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import DashboardLayout from "../Components/layout/DashboardLayout";
import DashboardContent from "./components/DashboardContent";

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // 1. Auth check (fast - from cookie)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // 2. Get active summoner (fast - single DB query)
    const activeSummoner = await getActiveSummoner();

    if (!activeSummoner?.puuid) {
        redirect('/onboarding');
    }

    // 3. Only pass summoner info - data fetching handled by SWR on client
    const summoner = {
        name: activeSummoner.summoner_name,
        tagLine: activeSummoner.tag_line || "",
        profileIconId: activeSummoner.profile_icon_id || 29,
        summonerLevel: activeSummoner.summoner_level || 0,
        puuid: activeSummoner.puuid,
    };

    return (
        <DashboardLayout>
            <DashboardContent summoner={summoner} />
        </DashboardLayout>
    );
}
