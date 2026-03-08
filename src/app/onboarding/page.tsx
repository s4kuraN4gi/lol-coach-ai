"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
    lookupSummoner,
    verifyAndAddSummoner,
    registerVerificationTimeout,
    getActiveSummoner 
} from "../actions/profile";
import LoadingAnimation from "../components/LoadingAnimation";
import { useAuth } from "../providers/AuthProvider";
import { signOut } from "../actions/auth";
import Footer from "../components/layout/Footer";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useDDragonVersion } from "@/hooks/useDDragonVersion";
import { logger } from "@/lib/logger";
import VerificationTimer from "../components/VerificationTimer";

export default function OnboardingPage() {
  const router = useRouter();
  const ddVersion = useDDragonVersion();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [initLoading, setInitLoading] = useState(true);

  // Verification States
  const [inputName, setInputName] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [candidate, setCandidate] = useState<any>(null);
  const [notification, setNotification] = useState<{type: 'success'|'error', message: string} | null>(null);
  
  const [isPending, startTransition] = useTransition();

  // Check if already onboarded
  useEffect(() => {
    if(authLoading) return;
    if(!user) {
        router.push("/login");
        return;
    }

    // Check if user already has an active summoner
    const checkStatus = async () => {
        const active = await getActiveSummoner();
        if(active) {
            router.push("/dashboard"); // Already done
        } else {
            setInitLoading(false);
        }
    };
    checkStatus();
  }, [user, authLoading, router]);

  // Step 1: Search
  const handleSearch = () => {
    setNotification(null);
    if (!inputName.trim()) return;
    if (!inputName.includes('#')) {
        setNotification({ type: 'error', message: t('onboardingPage.riotIdFormat') });
        return;
    }

    startTransition(async () => {
        setCandidate(null);

        const res = await lookupSummoner(inputName.trim());
        if(res.error) {
            let errorMsg = t(`verification.errors.${res.error}`, res.error);
            if (res.error === 'VERIFICATION_LOCKED' && 'meta' in res && res.meta?.lockedUntil) {
                errorMsg += `\n${t('accountPage.messages.unlockAt', '解除日時')}: ${res.meta.lockedUntil}`;
            }
            setNotification({ type: 'error', message: errorMsg });
            return;
        }
        // Success
        setCandidate(res.data);
        setStep(2);
    });
  };

  // Step 2: Verify Icon
  const handleVerify = () => {
      if(!candidate) return;

      startTransition(async () => {
          const res = await verifyAndAddSummoner(candidate);
          if(res.error) {
              let errorMsg = t(`verification.errors.${res.error}`, res.error);
              if (res.error === 'ICON_NOT_CHANGED' && 'meta' in res && res.meta) {
                  errorMsg += `\n(${t('accountPage.verification.current', '現在')}: ${res.meta.current} / ${t('accountPage.verification.target', '指定')}: ${res.meta.target})`;
                  errorMsg += `\n${t('accountPage.messages.remainingAttempts', '残り試行回数')}: ${res.meta.remaining}`;
              }
              setNotification({ type: 'error', message: errorMsg });
              // Fatal errors -> Close verification screen
              const FATAL_ERRORS = ['SESSION_EXPIRED', 'INVALID_SESSION', 'LOCKED_TRIPLE_FAIL', 'VERIFICATION_LOCKED'];
              if (FATAL_ERRORS.includes(res.error)) {
                  handleCancel();
              }
              return;
          }

          // Success!
          setNotification({ type: 'success', message: t('onboardingPage.verifySuccess') });
          setTimeout(() => {
              window.location.href = "/dashboard?welcome=1"; // Hard reload to force context updates
          }, 1500);
      });
  }

  const handleTimeout = useCallback(() => {
      startTransition(async () => {
          try {
            const res = await registerVerificationTimeout();
            if (res.errorCode) {
                let errorMsg = t(`verification.errors.${res.errorCode}`, res.errorCode);
                if (res.errorCode === 'TIMEOUT' && 'meta' in res && res.meta?.remaining != null) {
                    errorMsg += `\n${t('accountPage.messages.remainingAttempts', '残り試行回数')}: ${res.meta.remaining}`;
                }
                setNotification({ type: 'error', message: errorMsg });
            } else if (res.error) {
                const errorMsg = t(`verification.errors.${res.error}`, res.error);
                setNotification({ type: 'error', message: errorMsg });
            }
          } catch(e) {
            logger.error(e);
          } finally {
            handleCancel();
          }
      })
  }, []);

  const handleCancel = () => {
      setCandidate(null);
      setStep(1);
      setNotification(null);
  }


  if (authLoading || initLoading) {
     return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <LoadingAnimation />
        </div>
     )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20">
            <LanguageSwitcher />
        </div>
        {/* Background Glow */}
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-foreground mb-2">
                        {t('onboardingPage.welcomeTitle')}
                    </h1>
                    <p className="text-slate-400">
                        {t('onboardingPage.welcome')}
                    </p>
                </div>

                {/* Notification */}
                {notification && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 shadow-lg animate-fadeIn ${notification.type === 'error' ? 'bg-red-900/40 border-red-500/50 text-red-100' : 'bg-green-900/40 border-green-500/50 text-green-100'}`}>
                        <span className="text-xl mt-0.5">{notification.type === 'error' ? '🚫' : '✅'}</span>
                        <div className="flex-1 text-sm whitespace-pre-wrap">{notification.message}</div>
                    </div>
                )}

                {/* Validation Logic reused from AccountPage but styled for Onboarding */}
                <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-8 rounded-2xl shadow-2xl">
                    {step === 1 ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">{t('onboardingPage.enterRiotId')}</label>
                                <input
                                    type="text"
                                    placeholder="GameName #TagLine"
                                    value={inputName}
                                    onChange={(e) => setInputName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <div className="mt-3 flex items-center gap-2 bg-amber-900/30 border border-amber-600/40 rounded-lg px-3 py-2">
                                    <span className="text-amber-400 text-sm">⚠️</span>
                                    <p className="text-xs text-amber-300/90 font-medium">
                                        {t('onboardingPage.jpOnly')}
                                    </p>
                                </div>
                            </div>
                            
                            <button
                                onClick={handleSearch}
                                disabled={isPending || !inputName.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center"
                            >
                                {isPending ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : t('onboardingPage.startLink')}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white mb-2">{t('onboardingPage.verifyTitle')}</h3>
                                <p className="text-sm text-slate-400 mb-4">
                                    {t('onboardingPage.verifyInstruction')}
                                </p>
                                
                                <div className="flex items-center justify-center gap-6 mb-6">
                                    {/* Arrow */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center grayscale opacity-50 mb-2">
                                            <img src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${candidate?.profileIconId}.png`} className="w-full h-full rounded-full" />
                                        </div>
                                        <span className="text-xs text-slate-400">{t('onboardingPage.currentIcon')}</span>
                                    </div>
                                    <div className="text-2xl text-blue-500">→</div>
                                    <div className="flex flex-col items-center relative">
                                        <div className="w-20 h-20 rounded-full border-4 border-blue-500 shadow-[0_0_20px_blue] overflow-hidden mb-2">
                                            <img src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${candidate?.targetIconId}.png`} className="w-full h-full" />
                                        </div>
                                        <span className="text-xs text-blue-400 font-bold">{t('onboardingPage.newIcon')}</span>
                                        <div className="absolute -top-1 -right-2 bg-blue-600 text-[10px] px-1.5 py-0.5 rounded text-white font-bold">{t('onboardingPage.targetBadge')}</div>
                                    </div>
                                </div>

                                <VerificationTimer expiresAt={candidate?.expiresAt} onExpire={handleTimeout} compact />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleCancel}
                                    disabled={isPending}
                                    className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition"
                                >
                                    {t('onboardingPage.cancel')}
                                </button>
                                <button
                                    onClick={handleVerify}
                                    disabled={isPending}
                                    className="flex-[2] bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-500/20 transition flex justify-center items-center gap-2"
                                >
                                    {isPending ? (
                                        <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                        {t('onboardingPage.checking')}
                                        </>
                                    ) : (
                                        <>
                                        <span>✅</span> {t('onboardingPage.changed')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="mt-6 text-center space-y-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 transition"
                    >
                        {t('onboardingPage.skipForNow')}
                    </button>
                    <div>
                        <button
                            onClick={async () => {
                                await signOut();
                            }}
                            className="text-xs text-slate-600 hover:text-slate-400 underline"
                        >
                            {t('onboardingPage.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <Footer />
    </div>
  );
}



