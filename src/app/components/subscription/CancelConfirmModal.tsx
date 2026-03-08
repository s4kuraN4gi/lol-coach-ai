"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { type AnalysisStatus } from "@/app/actions/constants";
import { triggerStripePortal } from "@/lib/checkout";
import { toast } from "sonner";

type Props = {
    status: AnalysisStatus;
    onClose: () => void;
};

const CANCEL_REASONS = [
    "tooExpensive",
    "notUsingEnough",
    "missingFeatures",
    "foundAlternative",
    "other",
] as const;

type Step = "reason" | "pause-offer";

export default function CancelConfirmModal({ status, onClose }: Props) {
    const { t } = useTranslation();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [step, setStep] = useState<Step>("reason");
    const [isPausing, setIsPausing] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const weeklyCount = status.weekly_analysis_count || 0;

    // Focus trap + Escape to close
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, step]);

    const handleProceedToPortal = async () => {
        setIsRedirecting(true);
        await triggerStripePortal(t);
    };

    const handlePause = async (months: number) => {
        setIsPausing(true);
        try {
            const res = await fetch('/api/subscription/pause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ months }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t('cancelModal.pauseError', 'Failed to pause subscription'));
                setIsPausing(false);
                return;
            }

            const data = await res.json();
            const resumeDate = new Date(data.resumes_at).toLocaleDateString();
            toast.success(t('cancelModal.pauseSuccess', 'Subscription paused. It will resume automatically on {date}.').replace('{date}', resumeDate));
            onClose();
        } catch {
            toast.error(t('cancelModal.pauseError', 'Failed to pause subscription'));
            setIsPausing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {step === "reason" && (
                    <>
                        <h3 id="cancel-modal-title" className="text-lg font-bold text-white mb-4">
                            {t('cancelModal.title')}
                        </h3>

                        {/* Value summary */}
                        <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
                            <p className="text-sm text-slate-300 mb-3 font-bold">
                                {t('cancelModal.valueTitle')}
                            </p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>{t('cancelModal.analysisCount')}</span>
                                    <span className="font-bold text-white">{weeklyCount}{t('cancelModal.countUnit')}</span>
                                </div>
                                {status.subscription_end_date && (
                                    <div className="flex justify-between text-slate-300">
                                        <span>{t('cancelModal.nextRenewal')}</span>
                                        <span className="font-bold text-white">
                                            {new Date(status.subscription_end_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* What you lose */}
                        <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 mb-4">
                            <p className="text-sm font-bold text-red-300 mb-2">
                                {t('cancelModal.loseTitle')}
                            </p>
                            <ul className="text-xs text-red-200/80 space-y-1">
                                <li>- {t('cancelModal.loseAI')}</li>
                                <li>- {t('cancelModal.loseChat')}</li>
                                <li>- {t('cancelModal.loseMicro')}</li>
                                <li>- {t('cancelModal.losePriority')}</li>
                                {status.subscription_tier === 'extra' && (
                                    <>
                                        <li>- {t('cancelModal.loseDamage', 'AI damage analysis')}</li>
                                        <li>- {t('cancelModal.loseSegments', '5 auto-selected segments')}</li>
                                        <li>- {t('cancelModal.loseUnlimited', 'Unlimited AI analyses')}</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Cancel reason */}
                        <div className="mb-4">
                            <p className="text-sm text-slate-300 mb-2 font-bold">
                                {t('cancelModal.reasonTitle')}
                            </p>
                            <div className="space-y-1.5">
                                {CANCEL_REASONS.map((reason) => (
                                    <label
                                        key={reason}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition ${
                                            selectedReason === reason
                                                ? "bg-slate-700 text-white border border-slate-500"
                                                : "bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cancelReason"
                                            value={reason}
                                            checked={selectedReason === reason}
                                            onChange={() => setSelectedReason(reason)}
                                            className="accent-red-500"
                                        />
                                        {t(`cancelModal.reason.${reason}`)}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition"
                            >
                                {t('cancelModal.keepSubscription')}
                            </button>
                            <button
                                onClick={() => setStep("pause-offer")}
                                disabled={!selectedReason}
                                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t('cancelModal.proceed')}
                            </button>
                        </div>
                    </>
                )}

                {step === "pause-offer" && (
                    <>
                        <h3 id="cancel-modal-title" className="text-lg font-bold text-white mb-2">
                            {t('cancelModal.pauseTitle', 'Before you cancel...')}
                        </h3>

                        {/* Reason-specific retention message */}
                        {selectedReason === 'tooExpensive' && (
                            <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-3 mb-3">
                                <p className="text-sm text-amber-300 font-bold mb-1">{t('cancelModal.retention.tooExpensive.title', 'Save money with a pause')}</p>
                                <p className="text-xs text-amber-200/70">{t('cancelModal.retention.tooExpensive.desc', 'Pausing is free — no charges until you resume. Your data and history are preserved.')}</p>
                            </div>
                        )}
                        {selectedReason === 'notUsingEnough' && (
                            <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-3 mb-3">
                                <p className="text-sm text-blue-300 font-bold mb-1">{t('cancelModal.retention.notUsingEnough.title', 'Take a break, come back stronger')}</p>
                                <p className="text-xs text-blue-200/70">{t('cancelModal.retention.notUsingEnough.desc', 'Pause now and resume when the new season starts or when you have more time to play.')}</p>
                            </div>
                        )}
                        {selectedReason === 'missingFeatures' && (
                            <div className="bg-purple-950/30 border border-purple-500/20 rounded-lg p-3 mb-3">
                                <p className="text-sm text-purple-300 font-bold mb-1">{t('cancelModal.retention.missingFeatures.title', 'New features are coming!')}</p>
                                <p className="text-xs text-purple-200/70">{t('cancelModal.retention.missingFeatures.desc', 'We ship updates every week. Pause now and check back — your feedback helps us prioritize.')}</p>
                            </div>
                        )}
                        {(selectedReason === 'foundAlternative' || selectedReason === 'other') && (
                            <p className="text-sm text-slate-400 mb-3">
                                {t('cancelModal.pauseDesc', 'Would you like to pause your subscription? No charges during pause, and it will resume automatically.')}
                            </p>
                        )}
                        {!selectedReason && (
                            <p className="text-sm text-slate-400 mb-3">
                                {t('cancelModal.pauseDesc', 'Would you like to pause your subscription? No charges during pause, and it will resume automatically.')}
                            </p>
                        )}

                        <div className="space-y-2 mb-4">
                            {[1, 2, 3].map((months) => (
                                <button
                                    key={months}
                                    onClick={() => handlePause(months)}
                                    disabled={isPausing}
                                    className="w-full py-3 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-300 rounded-lg text-sm font-bold transition disabled:opacity-40"
                                >
                                    {t(`cancelModal.pause${months}Month`, `Pause for ${months} month${months > 1 ? 's' : ''}`)}
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-slate-700 pt-4 flex gap-3">
                            <button
                                onClick={() => setStep("reason")}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-sm transition"
                            >
                                {t('cancelModal.back', 'Back')}
                            </button>
                            <button
                                onClick={handleProceedToPortal}
                                disabled={isRedirecting}
                                className="flex-1 py-2.5 bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm transition disabled:opacity-40"
                            >
                                {isRedirecting ? t('cancelModal.redirecting') : t('cancelModal.skipPause', 'Cancel without pausing')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
