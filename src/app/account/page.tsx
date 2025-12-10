"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import { useSummoner } from "../Providers/SummonerProvider";
import { 
    addSummoner, 
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
  }, [fetchAccounts, activeSummoner]); // activeが変わったら再取得（最新順など）

  if (loading) {
     return (
        <DashboardLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingAnimation />
            </div>
        </DashboardLayout>
     )
  }

  // 追加
  const handleAdd = () => {
    if (!inputName.trim()) return;

    if (!inputName.includes('#')) {
        alert("Riot IDは 'Name#Tag' の形式で入力してください (例: Hide on bush#KR1)");
        return;
    }

    startTransition(async () => {
        const res = await addSummoner(inputName.trim());
        if(res.error) {
            alert("エラー: " + res.error);
            return;
        }
        setInputName("");
        await Promise.all([refreshSummoner(), fetchAccounts()]);
        alert("追加しました！");
    });
  };

  // 切り替え
  const handleSwitch = (id: string) => {
      startTransition(async () => {
          const res = await switchSummoner(id);
          if(res.error) {
              alert("切り替え失敗: " + res.error);
              return;
          }
          await refreshSummoner();
          // ダッシュボードへ飛ばすか、そのままリストに残るかは選択次第。今回はそのまま。
          // router.push("/dashboard"); 
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
          // もしアクティブなものを消した場合は、refreshでnullになるはず
          await Promise.all([refreshSummoner(), fetchAccounts()]);
      });
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto mt-8 animate-fadeIn">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white mb-8 italic tracking-tighter">
            ACCOUNT SETTINGS
        </h1>

        {/* 追加フォーム */}
        <div className="glass-panel p-8 rounded-xl mb-8">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
              NEW SUMMONER
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Riot ID (e.g. Hide on bush#KR1)"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition"
              disabled={isPending}
            />
            <button
              className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition transform active:scale-95"
              onClick={handleAdd}
              disabled={isPending || !inputName.trim()}
            >
              {isPending ? "ADDING..." : "ADD"}
            </button>
          </div>
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
