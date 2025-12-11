import { fetchMatchDetail, fetchMatchTimeline } from "@/app/actions/riot";
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import Timeline from "./components/Timeline";

// This is a Server Component
export default async function MatchDetailsPage({ params }: { params: { matchId: string } }) {
    const { matchId } = params;

    // Fetch data in parallel
    const [matchRes, timelineRes] = await Promise.all([
        fetchMatchDetail(matchId),
        fetchMatchTimeline(matchId)
    ]);

    if (!matchRes.success || !matchRes.data) {
        return notFound(); // Or a custom error UI
    }

    const match = matchRes.data;
    const timeline = timelineRes.data;

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeIn">
                {/* Header / Nav */}
                <div className="flex items-center gap-4 mb-8 text-sm text-slate-400">
                    <Link href="/dashboard" className="hover:text-blue-400 transition flex items-center gap-1">
                        ← Back to Dashboard
                    </Link>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-200 font-mono">{matchId}</span>
                </div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    {/* Header Info (To be expanded) */}
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold italic tracking-tighter text-white">
                            MATCH ANALYSIS <span className="text-blue-500">AI</span>
                        </h1>
                        <div className="text-xs font-mono text-slate-500 border border-slate-700 px-2 py-1 rounded">
                            PATCH {match.info.gameVersion.split('.').slice(0, 2).join('.')}
                        </div>
                    </div>

                    {/* Timeline Component */}
                    {timeline ? (
                         <div className="glass-panel p-1 rounded-xl overflow-hidden shadow-2xl shadow-blue-900/10">
                            <Timeline match={match} timeline={timeline} />
                         </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                            Timeline data not available for this match.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
