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
  const [candidate, setCandidate] = useState<any>(null); // To store lookup result
  const [verificationCode, setVerificationCode] = useState("");

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
        const res = await lookupSummoner(inputName.trim());
        if(res.error) {
            alert("エラー: " + res.error);
            return;
        }
        // Success
        setCandidate(res.data);
        const code = `LCA-${Math.floor(1000 + Math.random() * 9000)}`;
        setVerificationCode(code);
        setStep(2);
    });
  };

  // Step 2: Verify
  const handleVerify = () => {
      if(!candidate || !verificationCode) return;

      startTransition(async () => {
          const res = await verifyAndAddSummoner(candidate, verificationCode);
          if(res.error) {
              alert(res.error);
              return;
          }
          alert("認証成功！アカウントを追加しました。");
          // Reset
          setInputName("");
          setCandidate(null);
          setVerificationCode("");
          setStep(1);
          
          await Promise.all([refreshSummoner(), fetchAccounts()]);
      });
  }

  const handleCancel = () => {
      setCandidate(null);
      setVerificationCode("");
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
                  {/* Found Profile */}
                  <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="relative">
                          <img 
                              src={`https://ddragon.leagueoflegends.com/cdn/14.12.1/img/profileicon/${candidate?.profileIconId}.png`} 
                              alt="icon"
                              className="w-16 h-16 rounded-full border-2 border-slate-600"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-slate-900 text-xs px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                              Lv.{candidate?.summonerLevel}
                          </span>
                      </div>
                      <div>
                          <p className="text-xl font-bold text-white">{candidate?.gameName} <span className="text-slate-500 text-sm">#{candidate?.tagLine}</span></p>
                          <p className="text-xs text-green-400 font-mono">● Found</p>
                      </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-lg space-y-4">
                      <div className="flex items-start gap-3">
                          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">STEP 1</span>
                          <p className="text-sm text-slate-300">
                              LoLクライアントを開き、<span className="text-white font-bold">「設定 (歯車) ＞ プロフィール ＞ 認証コード」</span>を開いてください。
                          </p>
                      </div>
                      <div className="flex items-start gap-3">
                          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">STEP 2</span>
                          <div className="flex-1">
                              <p className="text-sm text-slate-300 mb-2">
                                  以下のコードを入力して保存してください。
                              </p>
                              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded p-3 relative group cursor-pointer"
                                   onClick={() => {
                                       navigator.clipboard.writeText(verificationCode);
                                       alert("Copied!");
                                   }}
                              >
                                  <code className="text-xl font-mono text-cyan-400 font-bold tracking-widest">{verificationCode}</code>
                                  <span className="text-xs text-slate-500 ml-auto group-hover:text-white transition">📋 COPY</span>
                              </div>
                          </div>
                      </div>
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
                                  VERIFYING...
                              </>
                          ) : (
                              <>
                                  <span>✅</span> VERIFY & LINK
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
