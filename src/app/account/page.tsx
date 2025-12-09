"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
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
  const router = useRouter();

  // アカウント一覧の取得
  const fetchAccounts = useCallback(async () => {
      const data = await getSummoners();
      setMyAccounts(data);
  }, []);

  useEffect(() => {
      fetchAccounts();
  }, [fetchAccounts, activeSummoner]); // activeが変わったら再取得（最新順など）

  // 追加
  const handleAdd = () => {
    if (!inputName.trim()) return;

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
      <div className="max-w-2xl mx-auto mt-8">
        <h1 className="text-2xl font-bold mb-6">アカウント設定</h1>

        {/* 追加フォーム */}
        <div className="p-6 bg-white rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-2">新しいサモナーを追加</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Riot Summoner Name"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              disabled={isPending}
            />
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleAdd}
              disabled={isPending || !inputName.trim()}
            >
              {isPending ? "処理中..." : "追加"}
            </button>
          </div>
        </div>

        {/* 一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-lg font-semibold p-4 bg-gray-50 border-b">登録済みサモナー ({myAccounts.length})</h2>
            <ul>
                {myAccounts.length === 0 && (
                    <li className="p-6 text-center text-gray-500">アカウントが登録されていません。</li>
                )}
                {myAccounts.map(acc => {
                    const isActive = activeSummoner?.id === acc.id;
                    return (
                        <li key={acc.id} className={`flex items-center justify-between p-4 border-b last:border-b-0 ${isActive ? 'bg-blue-50' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <div>
                                    <p className="font-bold text-gray-800">{acc.summoner_name}</p>
                                    <p className="text-xs text-gray-400">{acc.region}</p>
                                </div>
                                {isActive && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2">Active</span>}
                            </div>
                            
                            <div className="flex gap-2">
                                {!isActive && (
                                    <button 
                                        onClick={() => handleSwitch(acc.id)}
                                        className="text-sm border border-blue-500 text-blue-500 px-3 py-1 rounded hover:bg-blue-50"
                                        disabled={isPending}
                                    >
                                        切り替え
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDelete(acc.id, acc.summoner_name)}
                                    className="text-sm text-red-400 hover:text-red-600 px-2"
                                    disabled={isPending}
                                >
                                    削除
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
        
        {activeSummoner && (
             <div className="mt-6 text-right">
                 <button 
                    onClick={() => router.push('/dashboard')}
                    className="text-blue-600 hover:underline"
                 >
                     ダッシュボードに戻る →
                 </button>
             </div>
        )}

      </div>
    </DashboardLayout>
  );
}
