"use client";

// error.tsx - Error boundary for coach page
// Must be a client component to handle errors

import { useEffect } from "react";
import { FaExclamationTriangle, FaRedo, FaHome } from "react-icons/fa";
import Link from "next/link";

export default function CoachError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console (could also send to error tracking service)
        console.error("[CoachPage Error]", error);
    }, [error]);

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex items-center justify-center">
            <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                    <FaExclamationTriangle className="text-3xl text-red-500" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                    エラーが発生しました
                </h2>

                <p className="text-slate-400 text-sm mb-4">
                    ページの読み込み中に問題が発生しました。
                    もう一度お試しいただくか、ダッシュボードに戻ってください。
                </p>

                {/* Error details (development only) */}
                {process.env.NODE_ENV === "development" && (
                    <details className="mb-4 text-left">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                            エラー詳細を表示
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-950 rounded text-xs text-red-400 overflow-x-auto">
                            {error.message}
                            {error.digest && `\nDigest: ${error.digest}`}
                        </pre>
                    </details>
                )}

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition"
                    >
                        <FaRedo /> 再試行
                    </button>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition"
                    >
                        <FaHome /> ダッシュボード
                    </Link>
                </div>
            </div>
        </div>
    );
}
