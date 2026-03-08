"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingAnimation from "../components/LoadingAnimation";
import { useSummoner } from "../providers/SummonerProvider";
import { 
    lookupSummoner,
    verifyAndAddSummoner,
    getSummoners, 
    removeSummoner, 
    switchSummoner, 
    registerVerificationTimeout,
    type SummonerAccount 
} from "../actions/profile";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/LanguageContext";
import { useDDragonVersion } from "@/hooks/useDDragonVersion";
import { logger } from "@/lib/logger";
import VerificationTimer from "../components/VerificationTimer";

export default function AccountPage() {
  const ddVersion = useDDragonVersion();
  const [inputName, setInputName] = useState("");
  const { activeSummoner, refreshSummoner } = useSummoner();
  const [myAccounts, setMyAccounts] = useState<SummonerAccount[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  
  // Verification States
  const [step, setStep] = useState<1 | 2>(1);
  const [candidate, setCandidate] = useState<any>(null);
  const [notification, setNotification] = useState<{type: 'success'|'error', message: string} | null>(null);

  const router = useRouter();

  // アカウント一覧の取得
  const fetchAccounts = useCallback(async () => {
      try {
          const data = await getSummoners();
          setMyAccounts(data);
      } catch (e) {
          logger.error("Failed to fetch accounts", e);
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => {
      fetchAccounts();
  }, [fetchAccounts, activeSummoner]);


  // Step 1: Search
  const handleSearch = () => {
    setNotification(null);
    if (!inputName.trim()) return;
    if (!inputName.includes('#')) {
        toast.warning(t('accountPage.messages.formatError'));
        return;
    }

    startTransition(async () => {
        // Clear previous state
        setCandidate(null);

        const res = await lookupSummoner(inputName.trim());
        if(res.error) {
            let errorMsg = t(`verification.errors.${res.error}`, res.error);
            if (res.error === 'VERIFICATION_LOCKED' && 'meta' in res && res.meta?.lockedUntil) {
                errorMsg += `\n${t('accountPage.messages.unlockAt', '解除日時')}: ${res.meta.lockedUntil}`;
            }
            toast.error(errorMsg);
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
          // No code needed, just verify the icon change
          const res = await verifyAndAddSummoner(candidate);
          if(res.error) {
              let errorMsg = t(`verification.errors.${res.error}`, res.error);
              if (res.error === 'ICON_NOT_CHANGED' && 'meta' in res && res.meta) {
                  errorMsg += `\n(${t('accountPage.verification.current', '現在')}: ${res.meta.current} / ${t('accountPage.verification.target', '指定')}: ${res.meta.target})`;
                  errorMsg += `\n${t('accountPage.messages.remainingAttempts', '残り試行回数')}: ${res.meta.remaining}`;
              }
              toast.error(errorMsg);
              // Fatal errors -> Close verification screen
              const FATAL_ERRORS = ['SESSION_EXPIRED', 'INVALID_SESSION', 'LOCKED_TRIPLE_FAIL', 'VERIFICATION_LOCKED'];
              if (FATAL_ERRORS.includes(res.error)) {
                  handleCancel();
              }
              return;
          }
          toast.success(t('accountPage.messages.verificationSuccess'));
          // Reset
          setInputName("");
          setCandidate(null);
          setStep(1);

          await Promise.all([refreshSummoner(), fetchAccounts()]);
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
            setNotification({ type: 'error', message: t('accountPage.messages.unexpectedError') });
          } finally {
            handleCancel();
          }
      })
  }, []);

  const handleCancel = () => {
      setCandidate(null);
      setStep(1);
  }

  // 切り替え
  const handleSwitch = (id: string) => {
      startTransition(async () => {
          const res = await switchSummoner(id);
          if(res.error) {
              toast.error(t('accountPage.messages.switchFailed') + res.error);
              return;
          }
          await refreshSummoner();
      });
  }

  // ... (handlers)

  // 削除
  const handleDelete = (id: string, name: string) => {
      if(!confirm(t('accountPage.messages.deleteConfirm').replace('{name}', name))) return;
      
      startTransition(async () => {
          const res = await removeSummoner(id);
          if(res.error) {
              toast.error(t('accountPage.messages.deleteFailed') + res.error);
              return;
          }
          await Promise.all([refreshSummoner(), fetchAccounts()]);
      });
  }

  if (loading) {
     return (
        <DashboardLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingAnimation />
            </div>
        </DashboardLayout>
     )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
        <h1 className="text-3xl font-black text-foreground mb-8 italic tracking-tighter">
            {t('accountPage.title')}
        </h1>

        {notification && (
            <div className={`mb-8 p-4 rounded-xl border flex items-start gap-4 shadow-lg animate-fadeIn ${notification.type === 'error' ? 'bg-red-900/40 border-red-500/50 text-red-100' : 'bg-green-900/40 border-green-500/50 text-green-100'}`}>
                <span className="text-2xl mt-0.5">{notification.type === 'error' ? '⚠️' : '✅'}</span>
                <div className="flex-1">
                    <p className="font-bold mb-1">{notification.type === 'error' ? t('accountPage.notice') : t('accountPage.success')}</p>
                    <p className="whitespace-pre-wrap text-sm opacity-90">{notification.message}</p>
                </div>
                <button onClick={() => setNotification(null)} className="text-white/50 hover:text-white transition" aria-label={t('common.close', 'Close')}>✕</button>
            </div>
        )}

        {/* 追加フォーム (Wizard) */}
        <div className="glass-panel p-8 rounded-xl mb-8 transition-all duration-500">
          <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
              {t('accountPage.newSummonerLink')}
          </h2>
          
          {step === 1 ? (
              <div className="space-y-4 animate-fadeIn">
                  <p className="text-sm text-slate-400">
                      {t('accountPage.inputDescription')}
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder={t('accountPage.inputPlaceholder')}
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition"
                      disabled={isPending}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                      className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition transform active:scale-95 min-w-[100px]"
                      onClick={handleSearch}
                      disabled={isPending || !inputName.trim()}
                    >
                      {isPending ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full mx-auto" /> : t('accountPage.search')}
                    </button>
                  </div>
              </div>
          ) : (
              <div className="space-y-6 animate-fade-in-up">
                  {/* Instructions */}
                  <div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-lg text-center space-y-4">
                      <h3 className="text-slate-200 font-bold mb-2">{t('accountPage.verification.title')}</h3>
                      <p className="text-sm text-slate-400">
                          {t('accountPage.verification.instruction')}
                      </p>
                      
                      <div className="flex items-center justify-center gap-8 py-4">
                          {/* Current */}
                          <div className="relative opacity-50 grayscale">
                              <img 
                                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${candidate?.profileIconId}.png`} 
                                  alt="current"
                                  className="w-20 h-20 rounded-full border-2 border-slate-600"
                              />
                              <p className="text-xs text-slate-400 mt-2 font-mono">{t('accountPage.verification.current')}</p>
                          </div>

                          <div className="text-2xl text-blue-500 animate-pulse">➡️</div>

                          {/* Target */}
                          <div className="relative">
                              <img 
                                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${candidate?.targetIconId}.png`} 
                                  alt="target"
                                  className="w-24 h-24 rounded-full border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                              />
                              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow border border-blue-400">
                                  {t('accountPage.verification.target')}
                              </div>
                              <p className="text-xs text-blue-400 mt-2 font-mono font-bold">{t('accountPage.verification.changeToThis')}</p>
                              <p className="text-[10px] text-slate-600 font-mono">ID: {candidate?.targetIconId ?? 'NULL'}</p>
                          </div>
                      </div>

                      <VerificationTimer expiresAt={candidate?.expiresAt} onExpire={handleTimeout} />

                      {(candidate?.failedCount || 0) > 0 && (
                          <div className="mt-4 text-xs font-bold text-red-400 bg-red-900/20 py-1 px-3 rounded-full inline-flex items-center gap-2">
                              <span>⚠️</span> 
                              <span>{t('accountPage.verification.failedAttempts')}: {candidate.failedCount} / 3</span>
                          </div>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                       <button
                          className="flex-1 bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-lg hover:bg-slate-600 transition"
                          onClick={handleCancel}
                          disabled={isPending}
                        >
                          {t('accountPage.buttons.cancel')}
                        </button>
                        <button
                          className="flex-[2] bg-green-600 text-white font-bold px-4 py-3 rounded-lg hover:bg-green-500 shadow-lg shadow-green-900/20 disabled:opacity-50 transition transform active:scale-95 flex items-center justify-center gap-2"
                          onClick={handleVerify}
                          disabled={isPending}
                        >
                          {isPending ? (
                              <>
                                  <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                  {t('accountPage.buttons.checking')}
                              </>
                          ) : (
                              <>
                                  <span>✅</span> {t('accountPage.buttons.iChangedIt')}
                              </>
                          )}
                        </button>
                  </div>
              </div>
          )}
        </div>



        {/* 一覧 */}
        <div className="glass-panel rounded-xl overflow-hidden">
            <h2 className="text-lg font-bold p-6 border-b border-slate-700 text-slate-200 flex items-center justify-between">
                <span>{t('accountPage.linkedAccounts')}</span>
                <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded">{myAccounts.length}</span>
            </h2>
            <ul>
                {myAccounts.length === 0 && (
                    <li className="p-8 text-center text-slate-400 italic">{t('accountPage.noAccountsLinked')}</li>
                )}
                {myAccounts.map(acc => {
                    const isActive = activeSummoner?.id === acc.id;
                    return (
                        <li key={acc.id} className={`flex items-center justify-between p-5 border-b border-slate-800 last:border-b-0 transition-colors ${isActive ? 'bg-blue-900/10' : 'hover:bg-slate-800/30'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isActive ? 'bg-green-400 text-green-400' : 'bg-slate-600 text-slate-600'}`} />
                                <div>
                                    <p className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-400'}`}>{acc.summoner_name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{acc.region}</span>
                                        {isActive && <span className="text-xs text-blue-300 font-bold border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full">{t('accountPage.active')}</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                {!isActive && (
                                    <button 
                                        onClick={() => handleSwitch(acc.id)}
                                        className="text-sm border border-slate-600 text-slate-400 font-bold px-4 py-2 rounded-lg hover:bg-slate-800 hover:text-white hover:border-slate-500 transition"
                                        disabled={isPending}
                                    >
                                        {t('accountPage.buttons.switch')}
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDelete(acc.id, acc.summoner_name)}
                                    className="text-sm text-red-400/70 hover:text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg transition"
                                    disabled={isPending}
                                >
                                    {t('accountPage.buttons.remove')}
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
        
        {activeSummoner && (
             <div className="mt-8 text-right">
                 <button 
                    onClick={() => router.push('/dashboard')}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center justify-end gap-2 ml-auto hover:gap-3 transition-all"
                 >
                     {t('accountPage.buttons.goToDashboard')} <span>→</span>
                 </button>
             </div>
        )}

      </div>
    </DashboardLayout>
  );
}


