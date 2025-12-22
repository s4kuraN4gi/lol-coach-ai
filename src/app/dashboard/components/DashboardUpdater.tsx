"use client";

import { useState, useEffect } from "react";
import { checkForUpdates, performFullUpdate } from "@/app/actions/stats";
import { useRouter } from "next/navigation";

export default function DashboardUpdater({ puuid }: { puuid: string }) {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [newGameCount, setNewGameCount] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;

        const check = async () => {
            try {
                const res = await checkForUpdates(puuid);
                if (mounted && res.hasUpdates) {
                    setUpdateAvailable(true);
                    setNewGameCount(res.newGameCount);
                }
            } catch (e) {
                console.error("Background Update Check Warning:", e);
            }
        };

        // Run check after a short delay to prioritize initial render
        const timer = setTimeout(check, 2000);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [puuid]);

    const handleUpdate = async () => {
        setIsUpdating(true);
        try {
            await performFullUpdate(puuid);
            setUpdateAvailable(false);
            router.refresh(); // Refresh Server Components / Data
            // Since we are in a client component fetching data manually, we might need to trigger parent re-fetch.
            // But router.refresh() updates Server Actions cache? 
            // If parent uses `useEffect` fetching, `router.refresh` might not re-trigger it unless dependencies change?
            // Actually, if we use router.refresh(), it re-renders Server Components.
            // But our Dashboard IS a Client Component.
            // So we need a way to tell Dashboard to re-fetch.
            // For now, we reload the page or we expose a "onUpdate" prop.
            location.reload(); // Simplest way to ensure full sync for now
        } catch (e) {
            console.error("Update Failed:", e);
        } finally {
            setIsUpdating(false);
        }
    };

    if (!updateAvailable) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
            <div className="bg-slate-900 text-white rounded-lg shadow-2xl p-4 flex items-center gap-4 border border-blue-500/50 ring-1 ring-blue-500/20 backdrop-blur-xl">
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-blue-100 flex items-center gap-2">
                        <span className="animate-spin text-blue-400">⚡</span> 最新データがあります
                    </span>
                    <span className="text-xs text-blue-200/70 mt-0.5">{newGameCount} 件の新しい対戦が見つかりました</span>
                </div>
                <button 
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="bg-blue-600 text-white hover:bg-blue-500 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-blue-500/20 whitespace-nowrap"
                >
                    {isUpdating ? "更新中..." : "更新する"}
                </button>
            </div>
        </div>
    );
}
