"use client";

import React from "react";
import { upgradeToPremium } from "@/app/actions/analysis";

type Props = {
    isPremium: boolean;
    children: React.ReactNode;
    fallbackDescription?: string;
    blurAmount?: "sm" | "md" | "lg";
};

export default function PremiumFeatureGate({ 
    isPremium, 
    children, 
    fallbackDescription = "この機能を利用するにはプレミアムプランへのアップグレードが必要です。",
    blurAmount = "md"
}: Props) {
    
    const handleUpgrade = async () => {
        if (!confirm("【モック】プレミアムプラン(月額980円)に登録しますか？")) return;
        const res = await upgradeToPremium();
        if (res.success) {
            alert("プレミアムプランに登録しました！ページを更新してください。");
            window.location.reload();
        }
    };

    if (isPremium) {
        return <>{children}</>;
    }

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* Blurred Content */}
            <div className={`filter ${
                blurAmount === 'sm' ? 'blur-sm' : 
                blurAmount === 'md' ? 'blur-md' : 'blur-lg'
            } pointer-events-none select-none opacity-50 transition-all duration-500`}>
                {children}
            </div>

            {/* Lock Overlay */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-900/60 backdrop-blur-[2px]">
                <div className="bg-slate-900 border border-indigo-500/50 p-6 rounded-2xl shadow-2xl max-w-sm text-center transform transition-all hover:scale-105 duration-300">
                    <div className="mb-4 text-4xl animate-bounce">💎</div>
                    <h3 className="text-xl font-black text-white mb-2 italic">PREMIUM FEATURE</h3>
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                        {fallbackDescription}
                    </p>
                    <button
                        onClick={handleUpgrade}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                    >
                        UNLOCK NOW
                    </button>
                </div>
            </div>
        </div>
    );
}
