"use client";

import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
    matchId: string;
};

export default function MatchHeader({ matchId }: Props) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-4 mb-8 text-sm text-slate-400">
            <Link href="/dashboard/stats" className="hover:text-blue-400 transition flex items-center gap-1">
                {t('matchDetail.backToStats')}
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-mono">{matchId}</span>
        </div>
    );
}
