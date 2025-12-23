"use client";

import React, { useState, useTransition, useEffect } from "react";
import { downgradeToFree, type AnalysisStatus, getAnalysisStatus } from "@/app/actions/analysis";
import { triggerStripeCheckout, triggerStripePortal } from "@/lib/checkout";

type Props = {
    initialStatus: AnalysisStatus | null;
    onStatusUpdate?: (newStatus: AnalysisStatus) => void;
};

export default function PremiumPromoCard({ initialStatus, onStatusUpdate }: Props) {
    const [status, setStatus] = useState<AnalysisStatus | null>(initialStatus);
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(false); // Local loading state for checkout redirect

    // Sync state with prop updates (e.g. initial fetch from parent)
    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const isPremium = status?.is_premium;

    // Loading State (Skeleton) - Prevents "Free" flicker
    if (status === null) {
        return (
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 animate-pulse relative overflow-hidden h-[200px]">
                <div className="h-6 w-3/4 bg-slate-800 rounded mb-4"></div>
                <div className="h-4 w-full bg-slate-800 rounded mb-2"></div>
                <div className="h-4 w-5/6 bg-slate-800 rounded mb-6"></div>
                <div className="h-10 w-full bg-slate-800 rounded"></div>
            </div>
        )
    }

    const handleUpgrade = async () => {
        setIsLoading(true);
        try {
          await triggerStripeCheckout();
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDowngrade = async () => {
        // Confirmation is good, but Portal handles it too. Let's redirect directly or confirm before redirect.
        // Confirming before redirecting is safer UX.
        if (!confirm("契約管理（解約・プラン変更）画面へ移動しますか？")) return;
    
        startTransition(async () => {
           await triggerStripePortal();
        });
    };

    return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-violet-900 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
                <span className="text-6xl">💎</span>
            </div>
          <h3 className="font-black text-xl mb-2 italic">UNLOCK PREMIUM</h3>
          <p className="text-indigo-200 text-sm mb-6 leading-relaxed">
            AIコーチの無制限分析、詳細データのアンロック、優先処理など、上達のための全機能を開放しましょう。
          </p>
          {!isPremium ? (
            <button
              onClick={handleUpgrade}
              disabled={isPending || isLoading}
              className="w-full bg-white text-indigo-900 font-black py-3 rounded-lg hover:bg-indigo-50 transition shadow-lg disabled:opacity-50"
            >
              {isPending || isLoading ? "PROCESSING..." : "UPGRADE NOW"}
            </button>
          ) : (
            <div className="text-center">
              <div className="font-bold bg-white/20 py-2 rounded border border-white/30 backdrop-blur mb-2">
                ACTIVE MEMBER 💎
              </div>
              {status?.subscription_end_date && (
                  <p className="text-xs text-indigo-200 mb-2">
                      Active until: {new Date(status.subscription_end_date).toLocaleDateString()}
                  </p>
              )}
              <button
                   onClick={handleDowngrade}
                   disabled={isPending}
                   className="w-full mt-2 bg-white/5 text-indigo-200 border border-white/10 text-xs font-bold py-2 rounded hover:bg-white/10 transition flex justify-center items-center gap-2"
               >
                   <span>⚙️</span> {status?.auto_renew === false ? "Restore / Billing" : "Manage Subscription"}
               </button>
               {status?.auto_renew === false && (
                   <p className="text-xs text-amber-300 font-bold mt-2">
                       Auto-Renew OFF
                   </p>
               )}
            </div>
          )}
        </div>
    );
}
