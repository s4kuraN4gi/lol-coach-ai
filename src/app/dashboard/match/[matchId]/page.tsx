// Server Component - Minimal server work, data fetching on client with SWR
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import MatchClientPage from "./components/MatchClientPage";

// Force dynamic rendering for match-specific data
export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ matchId: string }>;
};

export default async function MatchDetailsPage({ params }: Props) {
    const { matchId } = await params;

    // 1. Auth check (fast)
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

    // 3. Pass only matchId and puuid - data fetching handled by SWR on client
    return (
        <DashboardLayout>
            <MatchClientPage matchId={matchId} puuid={activeSummoner.puuid} />
        </DashboardLayout>
    );
}
