"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ja">
            <body className="bg-[#0a0e1a]">
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                            <span className="text-3xl text-red-500">!</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            予期しないエラーが発生しました
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">
                            問題が解決しない場合は、ページを再読み込みしてください。
                        </p>
                        <button
                            onClick={reset}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition"
                        >
                            再読み込み
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
