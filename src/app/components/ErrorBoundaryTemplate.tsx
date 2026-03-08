"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

interface ErrorBoundaryTemplateProps {
    error: Error & { digest?: string };
    reset: () => void;
    titleKey: string;
    descriptionKey: string;
    backHref: string;
    backLabelKey: string;
    wrapperClassName: string;
}

export default function ErrorBoundaryTemplate({
    error,
    reset,
    titleKey,
    descriptionKey,
    backHref,
    backLabelKey,
    wrapperClassName,
}: ErrorBoundaryTemplateProps) {
    const { t } = useTranslation();
    const [eventId, setEventId] = useState<string | null>(null);

    useEffect(() => {
        const id = Sentry.captureException(error);
        setEventId(id);
    }, [error]);

    return (
        <div className={wrapperClassName}>
            <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                    <span className="text-3xl text-red-500">!</span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                    {t(titleKey)}
                </h2>

                <p className="text-slate-400 text-sm mb-6">
                    {t(descriptionKey)}
                </p>

                {process.env.NODE_ENV === "development" && eventId && (
                    <p className="text-xs text-slate-600 mb-4">
                        Error ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{eventId}</code>
                    </p>
                )}

                {process.env.NODE_ENV === "development" && (
                    <details className="mb-4 text-left">
                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-400">
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
                        href={backHref}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition"
                    >
                        {t(backLabelKey)}
                    </Link>
                </div>
            </div>
        </div>
    );
}
