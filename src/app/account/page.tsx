"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
import { useSummoner } from "../Providers/SummonerProvider";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const [inputName, setInputName] = useState("");
  const [accounts, setAccounts] = useState<SummonerAccount[]>([]);
  const { selectedSummoner, setSelectedSummoner } = useSummoner();
  const router = useRouter();

  const mockList = [
    { id: "1", name: "s4kuraN4gi" },
    { id: "2", name: "mimimimimi" },
  ];
  type SummonerAccount = {
    id: string;
    name: string;
  };
  //   初期表示処理
  useEffect(() => {
    const user = localStorage.getItem("LoginID");
    if (!user) return;
    const key = `accounts_${user}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setAccounts(JSON.parse(saved));
      } catch {
        console.warn("データ破損");
      }
    }
  }, []);


  //   追加処理
  const handleAdd = () => {
    if (!inputName.trim()) return;

    const findSummoner = mockList.find(
      (item) => item.name.toLowerCase() === inputName.toLowerCase()
    );
    // 誤った入力が実行された時
    if (!findSummoner) {
      confirm("サモナーが見つかりませんでした。");
      return;
    } else if (accounts.some((item) => item.name === findSummoner.name)) {
      confirm("既に登録済みのサモナーネームです。");
      setInputName("");
      return;
    }
    // 正しく入力された処理
    const newAccount = {
      id: crypto.randomUUID(),
      name: inputName.trim(),
    };
    const updated = [newAccount, ...accounts];
    setAccounts(updated);
    const user = localStorage.getItem("LoginID");
    const key = `accounts_${user}`;
    localStorage.setItem(key, JSON.stringify(updated));

    setInputName("");
  };
  // 削除処理
  const handleDelete = (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    const updated = accounts.filter((acc) => acc.id !== id);
    setAccounts(updated);

    const user = localStorage.getItem("LoginID");
    const key = `accounts_${user}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };
  console.log(selectedSummoner);

  //   アカウントの選択
  const handleChoose = (acc: SummonerAccount) => {
    setSelectedSummoner(acc);
    localStorage.setItem("selectedSummoner", JSON.stringify(acc));
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto mt-8">
        <h1 className="text-2xl font-bold mb-6">サモナーアカウント管理</h1>

        {/* 追加フォーム */}
        <div className="p-4 bg-white rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold">新しいアカウントを追加</h2>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="サモナーネーム"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2"
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={handleAdd}
            >
              追加
            </button>
          </div>
        </div>
        {/* 一覧 */}
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold">登録済みアカウント</h2>

          <ul className="space-y-2">
            {accounts.map((acc) => (
              <li
                key={acc.id}
                onClick={() => handleChoose(acc)}
                className={`flex justify-between w-full p-3 rounded-lg border 
                cursor-pointer hover:bg-blue-100 transition
                ${selectedSummoner?.id === acc.id ? "bg-blue-200 border-blue-400 font-semibold" : "bg-white border-gray-300"}`}
                >
                <span
                onClick={() => handleChoose(acc)}
                className="flex-1 cursor-pointer"
                >
                {acc.name}
                </span>

                <button
                  className=" text-red-500 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(acc.id);
                  }}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
