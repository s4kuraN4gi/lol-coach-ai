"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { useMatchData } from "@/hooks/useMatchData";
import { getAnalysisStatus } from "@/app/actions/analysis";
import TeamOverviewCard from "./TeamOverviewCard";
import DamageCalculator from "./DamageCalculator/DamageCalculator";
import { MatchContentSkeleton } from "./MatchContent";

type Props = {
    matchId: string;
    puuid: string;
};

export default function MatchClientPage({ matchId, puuid }: Props) {
    // SWR hook - fetches data on client, caches for instant subsequent visits
    const { matchData, ddVersion, isLoading, isValidating } = useMatchData(matchId);

    // Fetch subscription status for Extra tier check
    const { data: analysisStatus } = useSWR('analysis-status', () => getAnalysisStatus(), {
        dedupingInterval: 60000,
        revalidateOnFocus: false,
    });
    const isExtra = analysisStatus?.subscription_tier === 'extra';

    // Show skeleton while loading
    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link
                        href="/dashboard/stats"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                    >
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Stats
                    </Link>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Loading...
                        </span>
                    </div>
                </div>
                <MatchContentSkeleton />
            </div>
        );
    }

    // Error state
    if (!matchData) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <div className="p-10 text-center text-red-400">
                    <h2 className="text-2xl font-bold mb-4">Error Loading Match</h2>
                    <p className="font-mono bg-slate-900 border border-slate-800 p-4 rounded inline-block text-left text-sm max-w-2xl whitespace-pre-wrap">
                        <span className="text-slate-500">ID:</span> {matchId}<br />
                        <span className="text-slate-500">Error:</span> Failed to load match details.
                    </p>
                    <div className="mt-6">
                        <Link href="/dashboard/stats" className="text-blue-400 hover:underline">
                            Return to Stats
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const participant = matchData.info.participants.find((p: any) => p.puuid === puuid) || null;
    const summonerName = participant?.summonerName || "Unknown";
    const championName = participant?.championName || "Unknown";
    const kda = participant ? `${participant.kills}/${participant.deaths}/${participant.assists}` : "0/0/0";
    const win = participant?.win || false;

    const team100 = matchData.info.participants.filter((p: any) => p.teamId === 100) || [];
    const team200 = matchData.info.participants.filter((p: any) => p.teamId === 200) || [];
    const team100Win = team100[0]?.win;
    const team200Win = team200[0]?.win;

    return (
        <div className="animate-fadeIn">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                {/* Back Link */}
                <div className="flex items-center justify-between mb-6">
                    <Link
                        href="/dashboard/stats"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                    >
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Stats
                    </Link>
                    {isValidating && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Syncing...
                        </span>
                    )}
                </div>

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
            </div>

            {/* Damage Calculator - wider container for browser panel */}
            <div className="px-4 md:px-8 pb-4 md:pb-8 mt-6">
                <DamageCalculator
                    matchData={matchData}
                    puuid={puuid}
                    ddVersion={ddVersion}
                    isExtra={isExtra}
                />
            </div>
        </div>
    );
}
