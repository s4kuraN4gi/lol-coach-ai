// loading.tsx - Shows immediately while page loads (Streaming SSR)
import DashboardLayout from "@/app/Components/layout/DashboardLayout";
import MatchSkeleton from "../../components/skeletons/MatchSkeleton";

export default function MatchLoading() {
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                {/* Header breadcrumb skeleton */}
                <div className="flex items-center gap-4 mb-8 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-24"></div>
                    <div className="h-4 bg-slate-600 rounded w-2"></div>
                    <div className="h-4 bg-slate-800 rounded w-48"></div>
                </div>
                <MatchSkeleton />
            </div>
        </DashboardLayout>
    );
}
