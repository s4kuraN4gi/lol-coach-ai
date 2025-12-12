import { createClient } from "@/utils/supabase/server";
import { getActiveSummoner } from "@/app/actions/profile";
import { redirect } from "next/navigation";
import ChampionDetailView from "./ChampionDetailView";

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
         return (
             <div className="p-8 text-center">
                 <h2 className="text-xl font-bold text-red-400 mb-2">サモナー情報が見つかりません</h2>
                 <p className="text-slate-400 mb-4">アカウント設定からサモナーを連携してください。</p>
                 <a href="/dashboard/account" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
                     アカウント連携へ
                 </a>
             </div>
         );
    }

    return (
        <ChampionDetailView puuid={puuid} championName={decodeURIComponent(name)} />
    );
}
