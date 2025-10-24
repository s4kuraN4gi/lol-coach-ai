"use client";

import { useState } from "react";
import Search from "./search";
import Button from "./button";
import Display from "./Display";

type MatchParticipant = {
  summonerName: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
};

type MatchInfo = {
  gameDuration: number;
  participants: MatchParticipant[];
};

type MatchResult = {
  summonerName: string;
  matchId: string;
  role: string;
  match: {
    info: MatchInfo;
  };
};

export default function Home() {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [role, setRole] = useState("Top");
  const handleClick = async () => {
    const res = await fetch("/api/riot"); //仮通信用でまだ作ってない
    const data = await res.json();
    setResult(data);

    const aiRes = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...data, role}),
    });
    
    if (!aiRes.ok) {
      // ここで2行に分けているのはjsonで失敗した場合は空のオブジェクトを返すようにしている
      // これを1行でまとめるとsetAiResultで失敗して全体が落ちる
      // setAiResult(`AIエラー: ${(await aiRes.json()).error ?? aiRes.status}`)
      const e = await aiRes.json().catch(() => ({}));
      setAiResult(`AIエラー: ${e?.error ?? aiRes.status}`);
      return;
    }
    const aiData = await aiRes.json();
    setAiResult(aiData.advice);
  };

  return (
    <main
      className="min-h-screen w-full py-12 overflow-y-auto"
    >
      <div className="flex flex-col items-center max-w-3xl mx-auto px-4">
      <Display />
      <Search />
      <div className="mt-4 mb-4">
        <label htmlFor="role" className="mr-2 font-semibold text-white-700">ロールを選択</label>
        <select
         id="role"
         value={role}
         onChange={(e) => setRole(e.target.value)}
         className="border border-gray-400 rounded-mb px-3 py-1 bg-white shadow-sm text-black"
        >
            <option value="Top">Top</option>
            <option value="Jungle">Jungle</option>
            <option value="Mid">Mid</option>
            <option value="ADC">ADC</option>
            <option value="Support">Support</option>

        </select>

      </div>
      <Button onClick={handleClick}>Search</Button>
      <div id="result" style={{ color: "#000000ff" }}>
        {result && (
          <div className="p-4 rounded-lg shadow-md border border-gray-300 bg-white text-center">
            <h3 className="text-lg font-semibold mb-2">
              {result.summonerName} の戦績
            </h3>
            <p>
              チャンピオン: {result.match.info.participants[0].championName}
            </p>
            <p>
              KDA: {result.match.info.participants[0].kills}/
              {result.match.info.participants[0].deaths}/
              {result.match.info.participants[0].assists}
            </p>
            <p>
              勝敗:{" "}
              {result.match.info.participants[0].win ? "🏆 勝利" : "❌ 敗北"}
            </p>
            <p>試合時間: {Math.floor(result.match.info.gameDuration / 60)}分</p>
          </div>
        )}
        {aiResult && (
          <div className="mt-6 p-4 bg-gray-50 border rounded-lg max-w-md text-left">
            <h4 className="font-semibold text-gray-700 mb-2">コーチのアドバイス</h4>
            {aiResult.split("\n").map((line, index) => {
              const isSectionTitle = line.startsWith("🏹") || line.startsWith("💡") || line.startsWith("🔥") || line.startsWith("💬");
              return (
                <p
                  key={index}
                  className={`mb-2 whitespace-pre-wrap ${
                    isSectionTitle ? "font-semibold text-blue-600 mt-4" : "text-gray-700"
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        )}
        {/* Additional content can go here */}
      </div>
    </div>
    </main>
  );
}

