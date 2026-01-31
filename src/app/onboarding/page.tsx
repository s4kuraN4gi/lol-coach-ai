"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
    lookupSummoner,
    verifyAndAddSummoner,
    registerVerificationTimeout,
    getActiveSummoner 
} from "../actions/profile";
import LoadingAnimation from "../Components/LoadingAnimation";
import { useAuth } from "../Providers/AuthProvider";
import { signOut } from "../actions/auth";
import Footer from "../Components/layout/Footer";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function OnboardingPage() {
  const router = useRouter();
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
            setNotification({ type: 'error', message: t('onboardingPage.error') + res.error });
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
              setNotification({ type: 'error', message: res.error });
              // Fatal errors logic
              if (res.error.includes("有効期限") || 
                  res.error.includes("無効です") || 
                  res.error.includes("ロックしました")) {
                  handleCancel();
              }
              return;
          }
          
          // Success!
          setNotification({ type: 'success', message: t('onboardingPage.verifySuccess') });
          setTimeout(() => {
              window.location.href = "/dashboard"; // Hard reload to force context updates
          }, 1500);
      });
  }

  const handleTimeout = useCallback(() => {
      startTransition(async () => {
          try {
            const res = await registerVerificationTimeout();
            if(res.message) setNotification({ type: 'error', message: res.message });
          } catch(e) {
            console.error(e);
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
                        WELCOME, SUMMONER
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
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Enter Riot ID</label>
                                <input
                                    type="text"
                                    placeholder="GameName #TagLine"
                                    value={inputName}
                                    onChange={(e) => setInputName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    {t('onboardingPage.jpOnly')}
                                </p>
                            </div>
                            
                            <button
                                onClick={handleSearch}
                                disabled={isPending || !inputName.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center"
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
                                            <img src={`https://ddragon.leagueoflegends.com/cdn/15.24.1/img/profileicon/${candidate?.profileIconId}.png`} className="w-full h-full rounded-full" />
                                        </div>
                                        <span className="text-xs text-slate-500">Current</span>
                                    </div>
                                    <div className="text-2xl text-blue-500">→</div>
                                    <div className="flex flex-col items-center relative">
                                        <div className="w-20 h-20 rounded-full border-4 border-blue-500 shadow-[0_0_20px_blue] overflow-hidden mb-2">
                                            <img src={`https://ddragon.leagueoflegends.com/cdn/15.24.1/img/profileicon/${candidate?.targetIconId}.png`} className="w-full h-full" />
                                        </div>
                                        <span className="text-xs text-blue-400 font-bold">New Icon</span>
                                        <div className="absolute -top-1 -right-2 bg-blue-600 text-[10px] px-1.5 py-0.5 rounded text-white font-bold">Target</div>
                                    </div>
                                </div>

                                <Timer expiresAt={candidate?.expiresAt} onExpire={handleTimeout} />
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
                
                <div className="mt-8 text-center">
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
        <Footer />
    </div>
  );
}

function Timer({ expiresAt, onExpire }: { expiresAt: number, onExpire?: () => void }) {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(0);
    const hasExpiredRef = React.useRef(false);

    useEffect(() => {
        if(!expiresAt) return;
        hasExpiredRef.current = false;
        
        const update = () => {
            const val = Math.max(0, expiresAt - Date.now());
            setTimeLeft(val);
            if (val <= 0 && !hasExpiredRef.current) {
                hasExpiredRef.current = true;
                if(onExpire) onExpire();
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
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-950/50 rounded px-4 py-2 inline-block border border-slate-800">
            <span className="text-slate-500 text-xs mr-2">{t('onboardingPage.timeRemaining')}</span>
            <span className={`font-mono font-bold ${timeLeft < 60000 ? 'text-red-400' : 'text-slate-200'}`}>
                {format(timeLeft)}
            </span>
        </div>
    );
}


