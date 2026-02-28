"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useTranslation();

    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
            <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                    <span className="text-3xl">!</span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                    {t('errorBoundary.title')}
                </h2>

                <p className="text-slate-400 text-sm mb-6">
                    {t('errorBoundary.descriptionGeneric')}
                </p>

                {process.env.NODE_ENV === "development" && (
                    <details className="mb-4 text-left">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                            {t('errorBoundary.errorDetails')}
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-950 rounded text-xs text-red-400 overflow-x-auto">
                            {error.message}
                        </pre>
                    </details>
                )}

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition"
                    >
                        {t('errorBoundary.retry')}
                    </button>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition"
                    >
                        {t('errorBoundary.topPage')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
