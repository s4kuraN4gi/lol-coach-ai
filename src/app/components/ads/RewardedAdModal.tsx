"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdComplete: () => void;
  analysisType: 'macro' | 'micro';
}

export default function RewardedAdModal({ isOpen, onClose, onAdComplete, analysisType }: Props) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(5);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adCompleted, setAdCompleted] = useState(false);
  const [adTimedOut, setAdTimedOut] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const rewardedSlotId = process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT;

  // Focus trap + Escape key
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setAdLoaded(false);
      setAdCompleted(false);
      setAdTimedOut(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Only proceed if ad slot is configured
    if (!rewardedSlotId || !process.env.NEXT_PUBLIC_ADSENSE_ID) {
      return;
    }

    // Request ad load
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      return;
    }

    // Wait for actual ad render (iframe inserted into the ins element) before starting countdown
    const insEl = adRef.current?.querySelector('ins.adsbygoogle');
    if (!insEl) return;

    const observer = new MutationObserver(() => {
      // AdSense inserts an iframe or fills content when the ad renders
      const hasAdContent = insEl.querySelector('iframe') ||
        insEl.getAttribute('data-ad-status') === 'filled';
      if (hasAdContent) {
        observer.disconnect();
        setAdLoaded(true);

        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              setAdCompleted(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    });

    observer.observe(insEl, { childList: true, attributes: true, subtree: true });

    // Timeout: if no ad renders within 10s, disconnect observer and allow skip
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      setAdTimedOut(true);
    }, 10000);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, rewardedSlotId]);

  const handleComplete = () => {
    onAdComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewarded-ad-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h3 id="rewarded-ad-title" className="text-lg font-bold text-white mb-1">
            {t('analyzePage.rewardAd.title')}
          </h3>
          <p className="text-sm text-slate-400">
            {t('analyzePage.rewardAd.description')}
          </p>
        </div>

        {/* Ad area */}
        <div
          ref={adRef}
          className="bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center min-h-[250px] mb-4"
        >
          {rewardedSlotId && process.env.NEXT_PUBLIC_ADSENSE_ID ? (
            <ins
              className="adsbygoogle"
              style={{ display: "block", width: "100%", height: "250px" }}
              data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
              data-ad-slot={rewardedSlotId}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : (
            <div className="text-center p-4">
              <p className="text-slate-400 text-sm">
                {t('analyzePage.rewardAd.unavailable', '広告は現在利用できません')}
              </p>
            </div>
          )}
        </div>

        {/* Countdown / Complete button */}
        <div className="flex flex-col items-center gap-3">
          {!adCompleted ? (
            <>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>{t('analyzePage.rewardAd.watching')}</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {countdown}
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <button
              onClick={handleComplete}
              className="w-full py-3 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition"
            >
              {t('analyzePage.rewardAd.complete')}
            </button>
          )}

          {/* Ad timed out without loading: allow proceeding */}
          {adTimedOut && !adCompleted && (
            <button
              onClick={handleComplete}
              className="w-full py-3 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition"
            >
              {t('analyzePage.rewardAd.complete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
