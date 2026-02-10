"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

declare global {
  interface Window {
    adsbygoogle: any[];
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
  const adRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const rewardedSlotId = process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT;

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setAdLoaded(false);
      setAdCompleted(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Try to load rewarded ad
    if (rewardedSlotId && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ADSENSE_ID) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setAdLoaded(true);
      } catch (e) {
        console.error("[RewardedAd] Failed to load ad:", e);
        // Fall through to countdown fallback
      }
    }

    // Fallback countdown timer (always runs as backup)
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

    return () => {
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white mb-1">
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
              <p className="text-xs font-mono text-slate-500 mb-2">AD SPACE</p>
              <p className="text-slate-400 text-sm">
                {t('analyzePage.rewardAd.watching')}
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

          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-400 transition"
          >
            {t('analyzePage.rewardAd.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
