"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[App Error]", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
            <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                    <span className="text-3xl">!</span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                    エラーが発生しました
                </h2>

                <p className="text-slate-400 text-sm mb-6">
                    予期しないエラーが発生しました。もう一度お試しください。
                </p>

                {process.env.NODE_ENV === "development" && (
                    <details className="mb-4 text-left">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                            エラー詳細
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
                        再試行
                    </button>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition"
                    >
                        トップページ
                    </Link>
                </div>
            </div>
        </div>
    );
}
