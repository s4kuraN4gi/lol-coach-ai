"use client";

import ErrorBoundaryTemplate from "@/app/components/ErrorBoundaryTemplate";

export default function DashboardError({
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
            descriptionKey="errorBoundary.description"
            backHref="/dashboard"
            backLabelKey="errorBoundary.dashboard"
            wrapperClassName="max-w-7xl mx-auto h-[calc(100vh-100px)] flex items-center justify-center p-4"
        />
    );
}
