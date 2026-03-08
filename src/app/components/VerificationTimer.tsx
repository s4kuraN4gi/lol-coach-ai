"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

interface VerificationTimerProps {
    expiresAt: number;
    onExpire?: () => void;
    /** Compact style for onboarding page */
    compact?: boolean;
}

export default function VerificationTimer({ expiresAt, onExpire, compact }: VerificationTimerProps) {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(0);
    const hasExpiredRef = useRef(false);

    useEffect(() => {
        if (!expiresAt) return;
        hasExpiredRef.current = false;

        const update = () => {
            const val = Math.max(0, expiresAt - Date.now());
            setTimeLeft(val);
            if (val <= 0 && !hasExpiredRef.current) {
                hasExpiredRef.current = true;
                if (onExpire) onExpire();
            }
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);

    const format = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    if (compact) {
        return (
            <div className="bg-slate-950/50 rounded px-4 py-2 inline-block border border-slate-800">
                <span className="text-slate-400 text-xs mr-2">{t("onboardingPage.timeRemaining")}</span>
                <span className={`font-mono font-bold ${timeLeft < 60000 ? "text-red-400" : "text-slate-200"}`}>
                    {format(timeLeft)}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 rounded p-3 inline-block">
            <p className="text-xs text-slate-400 mb-1">{t("accountPage.verification.timeLimit")}</p>
            <p className={`text-xl font-mono font-bold tracking-widest ${timeLeft < 60000 ? "text-red-500 animate-pulse" : "text-slate-200"}`}>
                {format(timeLeft)}
            </p>
            <p className="text-[10px] text-slate-600">{t("accountPage.verification.verifyWithin")}</p>
        </div>
    );
}
