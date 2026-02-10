"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/LanguageContext";
import { useSummoner } from "@/app/Providers/SummonerProvider";
import DashboardUpdater from "./DashboardUpdater";

type Props = {
    puuid: string;
};

export default function DashboardHeader({ puuid }: Props) {
    const { t } = useTranslation();
    const router = useRouter();
    const { refreshSummoner } = useSummoner();
    const [isPending, startTransition] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleManualRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const { performFullUpdate } = await import('@/app/actions/stats');
            await performFullUpdate(puuid);
            await refreshSummoner();
            startTransition(() => {
                router.refresh();
            });
        } catch (e) {
            console.error(e);
        }
        setIsRefreshing(false);
    }, [puuid, refreshSummoner, router]);

    const isFetching = isRefreshing || isPending;

    return (
        <>
            <DashboardUpdater puuid={puuid} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold font-display uppercase tracking-wider text-white">
                        {t('dashboard.title')}
                    </h1>
                    <p className="text-slate-400 text-sm">{t('dashboard.subtitle')}</p>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleManualRefresh}
                        className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg transition shadow-lg hover:shadow-blue-500/10 flex items-center gap-2"
                        disabled={isFetching}
                    >
                        {isFetching ? (
                            <>
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                                {t('dashboard.refreshing')}
                            </>
                        ) : (
                            `↻ ${t('dashboard.refresh')}`
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
