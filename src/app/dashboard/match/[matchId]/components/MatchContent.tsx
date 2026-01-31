// Async Server Component for match content
import Image from "next/image";
import Link from "next/link";
import { fetchMatchDetail, fetchLatestVersion } from "@/app/actions/riot";
import { getMatchAnalysis } from "@/app/actions/analysis";
import TeamOverviewCard from "./TeamOverviewCard";

type Props = {
    matchId: string;
    puuid: string;
};

// Skeleton for Suspense fallback
export function MatchContentSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header Info Skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <div className="w-16 h-16 bg-slate-700 rounded"></div>
                    </div>
                    <div>
                        <div className="h-8 bg-slate-800 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-slate-800 rounded w-32"></div>
                    </div>
                </div>
                <div className="h-6 bg-slate-800 rounded w-24"></div>
            </div>

            {/* Teams Overview Skeleton */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/50">
                    <div className="h-6 bg-slate-700 rounded w-32"></div>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-lg h-[300px]"></div>
                    <div className="bg-slate-800/50 rounded-lg h-[300px]"></div>
                </div>
            </div>
        </div>
    );
}

// Client wrapper for interactive parts
function MatchContentClient({
    matchData,
    ddVersion,
    participant,
}: {
    matchData: any;
    ddVersion: string;
    participant: any;
}) {
    "use client";

    const summonerName = participant?.summonerName || "Unknown";
    const championName = participant?.championName || "Unknown";
    const kda = participant ? `${participant.kills}/${participant.deaths}/${participant.assists}` : "0/0/0";
    const win = participant?.win || false;

    const team100 = matchData?.info.participants.filter((p: any) => p.teamId === 100) || [];
    const team200 = matchData?.info.participants.filter((p: any) => p.teamId === 200) || [];
    const team100Win = team100[0]?.win;
    const team200Win = team200[0]?.win;

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-2 rounded-lg relative overflow-hidden group">
                        <Image
                            src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${championName}.png`}
                            alt={championName}
                            width={64}
                            height={64}
                            className="rounded object-cover transform scale-110 group-hover:scale-100 transition duration-500"
                        />
                        <div className={`absolute inset-0 border-2 rounded-lg ${win ? 'border-blue-500/50' : 'border-red-500/50'}`}></div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-2">
                            Match Report
                            <span className="text-blue-500 text-sm font-normal py-0.5 px-2 bg-blue-500/10 rounded-full border border-blue-500/30">
                                AI Beta
                            </span>
                        </h1>
                        <div className="flex items-center gap-3 text-sm font-mono mt-1">
                            <span className={`font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
                                {win ? 'Victory' : 'Defeat'}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-300">{kda} KDA</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">{matchData.info.gameMode}</span>
                        </div>
                    </div>
                </div>

                <div className="text-xs font-mono text-slate-500 border border-slate-800 bg-slate-900/50 px-3 py-1.5 rounded-full">
                    Patch {matchData.info.gameVersion.split('.').slice(0, 2).join('.')} (View: {ddVersion})
                </div>
            </div>

            {/* Teams Overview */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <span>👥</span> Teams Overview
                    </h3>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start border-t border-slate-800">
                    <TeamOverviewCard
                        teamId={100}
                        teamName="Blue Team"
                        participants={team100}
                        win={team100Win}
                        version={ddVersion}
                    />
                    <TeamOverviewCard
                        teamId={200}
                        teamName="Red Team"
                        participants={team200}
                        win={team200Win}
                        version={ddVersion}
                    />
                </div>
            </div>

        </div>
    );
}

// Async Server Component
export async function MatchContent({ matchId, puuid }: Props) {
    // Fetch data in parallel
    const [matchRes, analysisRes, ddVersion] = await Promise.all([
        fetchMatchDetail(matchId),
        getMatchAnalysis(matchId),
        fetchLatestVersion(),
    ]);

    if (!matchRes.success || !matchRes.data) {
        return (
            <div className="p-10 text-center text-red-400">
                <h2 className="text-2xl font-bold mb-4">Error Loading Match</h2>
                <p className="font-mono bg-slate-900 border border-slate-800 p-4 rounded inline-block text-left text-sm max-w-2xl whitespace-pre-wrap">
                    <span className="text-slate-500">ID:</span> {matchId}<br />
                    <span className="text-slate-500">Error:</span> {matchRes.error || "Failed to load match details."}
                </p>
                <div className="mt-6">
                    <Link href="/dashboard/stats" className="text-blue-400 hover:underline">
                        Return to Stats
                    </Link>
                </div>
            </div>
        );
    }

    const matchData = matchRes.data;
    const participant = matchData.info.participants.find((p: any) => p.puuid === puuid) || null;

    return (
        <MatchContentClient
            matchData={matchData}
            ddVersion={ddVersion}
            participant={participant}
        />
    );
}
