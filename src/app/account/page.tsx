"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import { useSummoner } from "../Providers/SummonerProvider";
import { 
    lookupSummoner,
    verifyAndAddSummoner,
    getSummoners, 
    removeSummoner, 
    switchSummoner, 
    type SummonerAccount 
} from "../actions/profile";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const [inputName, setInputName] = useState("");
  const { activeSummoner, refreshSummoner } = useSummoner();
  const [myAccounts, setMyAccounts] = useState<SummonerAccount[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  
  // Verification States
  const [step, setStep] = useState<1 | 2>(1);
  const [candidate, setCandidate] = useState<any>(null);

  const router = useRouter();

  // アカウント一覧の取得
  const fetchAccounts = useCallback(async () => {
      try {
          const data = await getSummoners();
          setMyAccounts(data);
      } catch (e) {
          console.error("Failed to fetch accounts", e);
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => {
      fetchAccounts();
  }, [fetchAccounts, activeSummoner]);

  if (loading) {
     return (
        <DashboardLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingAnimation />
            </div>
        </DashboardLayout>
     )
  }

  // Step 1: Search
  const handleSearch = () => {
    if (!inputName.trim()) return;
    if (!inputName.includes('#')) {
        alert("Riot IDは 'Name#Tag' の形式で入力してください (例: Hide on bush#KR1)");
        return;
    }

    startTransition(async () => {
        // Clear previous state
        setCandidate(null);
        
        const res = await lookupSummoner(inputName.trim());
        if(res.error) {
            alert("エラー: " + res.error);
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
              alert(res.error);
              return;
          }
          alert("認証成功！アカウントを追加しました。");
          // Reset
          setInputName("");
          setCandidate(null);
          setStep(1);
          
          await Promise.all([refreshSummoner(), fetchAccounts()]);
      });
  }

  const handleCancel = () => {
      setCandidate(null);
      setStep(1);
  }

  // 切り替え
  const handleSwitch = (id: string) => {
      startTransition(async () => {
          const res = await switchSummoner(id);
          if(res.error) {
              alert("切り替え失敗: " + res.error);
              return;
          }
          await refreshSummoner();
      });
  }

  // 削除
  const handleDelete = (id: string, name: string) => {
      if(!confirm(`${name} を削除しますか？`)) return;
      
      startTransition(async () => {
          const res = await removeSummoner(id);
          if(res.error) {
              alert("削除失敗: " + res.error);
              return;
          }
          await Promise.all([refreshSummoner(), fetchAccounts()]);
      });
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white mb-8 italic tracking-tighter">
            ACCOUNT SETTINGS
        </h1>

        {/* 追加フォーム (Wizard) */}
        <div className="glass-panel p-8 rounded-xl mb-8 transition-all duration-500">
          <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
              NEW SUMMONER LINK
          </h2>
          
          {step === 1 ? (
              <div className="space-y-4 animate-fadeIn">
                  <p className="text-sm text-slate-400">
                      Riot IDを入力して、アカウントの所有権を確認します。
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Enter Riot ID (e.g. Hide on bush#KR1)"
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
                      {isPending ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full mx-auto" /> : "SEARCH"}
                    </button>
                  </div>
              </div>
          ) : (
              <div className="space-y-6 animate-fade-in-up">
                  {/* Instructions */}
                  <div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-lg text-center space-y-4">
                      <h3 className="text-slate-200 font-bold mb-2">本人確認 (アイコン認証)</h3>
                      <p className="text-sm text-slate-400">
                          LoLクライアントで、プロフィールアイコンを<strong className="text-white">右側の指定アイコン</strong>に変更してください。
                      </p>
                      
                      <div className="flex items-center justify-center gap-8 py-4">
                          {/* Current */}
                          <div className="relative opacity-50 grayscale">
                              <img 
                                  src={`https://ddragon.leagueoflegends.com/cdn/15.24.1/img/profileicon/${candidate?.profileIconId}.png`} 
                                  alt="current"
                                  className="w-20 h-20 rounded-full border-2 border-slate-600"
                              />
                              <p className="text-xs text-slate-500 mt-2 font-mono">Current</p>
                          </div>

                          <div className="text-2xl text-blue-500 animate-pulse">➡️</div>

                          {/* Target */}
                          <div className="relative">
                              <img 
                                  src={`https://ddragon.leagueoflegends.com/cdn/15.24.1/img/profileicon/${candidate?.targetIconId}.png`} 
                                  alt="target"
                                  className="w-24 h-24 rounded-full border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                              />
                              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow border border-blue-400">
                                  TARGET
                              </div>
                              <p className="text-xs text-blue-400 mt-2 font-mono font-bold">Change to this!</p>
                          </div>
                      </div>

                      <Timer expiresAt={candidate?.expiresAt} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                       <button
                          className="flex-1 bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-lg hover:bg-slate-600 transition"
                          onClick={handleCancel}
                          disabled={isPending}
                        >
                          CANCEL
                        </button>
                        <button
                          className="flex-[2] bg-green-600 text-white font-bold px-4 py-3 rounded-lg hover:bg-green-500 shadow-lg shadow-green-900/20 disabled:opacity-50 transition transform active:scale-95 flex items-center justify-center gap-2"
                          onClick={handleVerify}
                          disabled={isPending}
                        >
                          {isPending ? (
                              <>
                                  <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                  CHECKING...
                              </>
                          ) : (
                              <>
                                  <span>✅</span> I CHANGED IT!
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
                <span>LINKED ACCOUNTS</span>
                <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded">{myAccounts.length}</span>
            </h2>
            <ul>
                {myAccounts.length === 0 && (
                    <li className="p-8 text-center text-slate-500 italic">No accounts linked yet.</li>
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
                                        <span className="text-xs text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{acc.region}</span>
                                        {isActive && <span className="text-xs text-blue-300 font-bold border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full">ACTIVE</span>}
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
                                        SWITCH
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDelete(acc.id, acc.summoner_name)}
                                    className="text-sm text-red-400/70 hover:text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg transition"
                                    disabled={isPending}
                                >
                                    REMOVE
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
                     GO TO DASHBOARD <span>→</span>
                 </button>
             </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function Timer({ expiresAt }: { expiresAt: number }) {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if(!expiresAt) return;
        
        const update = () => {
            const val = Math.max(0, expiresAt - Date.now());
            setTimeLeft(val);
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    const format = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-900/50 rounded p-3 inline-block">
            <p className="text-xs text-slate-500 mb-1">TIME LIMIT</p>
            <p className={`text-xl font-mono font-bold tracking-widest ${timeLeft < 60000 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
                {format(timeLeft)}
            </p>
            <p className="text-[10px] text-slate-600">Please verify within 10 mins.</p>
        </div>
    );
}

