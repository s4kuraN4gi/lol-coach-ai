"use client";

import { useTranslation } from "@/contexts/LanguageContext";

export default function NoSummonerMessage() {
    const { t } = useTranslation();
    return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">
                {t('championDetail.noSummoner.title')}
            </h2>
            <p className="text-slate-400 mb-4">
                {t('championDetail.noSummoner.desc')}
            </p>
            <a
                href="/dashboard/account"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
            >
                {t('championDetail.noSummoner.link')}
            </a>
        </div>
    );
}
