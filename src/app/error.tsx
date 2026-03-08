"use client";

import ErrorBoundaryTemplate from "@/app/components/ErrorBoundaryTemplate";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorBoundaryTemplate
            error={error}
            reset={reset}
            titleKey="errorBoundary.title"
            descriptionKey="errorBoundary.descriptionGeneric"
            backHref="/"
            backLabelKey="errorBoundary.topPage"
            wrapperClassName="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4"
        />
    );
}
