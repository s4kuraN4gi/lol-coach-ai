// Server Component - Minimal server work, data fetching on client with SWR
// - Server: Auth check only (fast)
// - Client: SWR fetches data, caches it, instant on subsequent visits
// Note: Both free and premium users can use this page (with different segment limits)

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import CoachClientPage from "./components/CoachClientPage";

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic';

export default async function CoachPage() {
    // 1. Authentication check on server (fast)
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

    // 3. Pass only puuid - data fetching handled by SWR on client
    // Note: Free users get 3 segments, Premium users get 5 segments (handled in VideoMacroAnalysis)
    return <CoachClientPage puuid={activeSummoner.puuid} />;
}
