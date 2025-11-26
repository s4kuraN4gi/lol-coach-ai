"use client";

import { useState } from "react";
import Search from "./search";
import Button from "./button";
import Display from "./Display";
import SummonerCard from "./Components/SummonerCard";
import RoleSelect from "./Components/RoleSelect";

type MatchParticipant = {
  selectedSummoner: string;
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
  selectedSummoner: string;
  matchId: string;
  role: string;
  match: {
    info: MatchInfo;
  };
};


type HistoryItem = {
  id: string;
  date: string;
  selectedSummoner: string;
  champion: string;
  role: string;
  result: string;
  kda: string;
  aiAdvice: string;
}

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
      body: JSON.stringify({ ...data, role }),
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
    const advice = aiData.advice as string;
    setAiResult(advice);

    const newHistory: HistoryItem = {
      id: new Date().toISOString(),
      date: new Date().toLocaleString(),
      selectedSummoner: data.selectedSummoner,
      champion: data.match.info.participants[0].championName,
      role,
      result: data.match.info.participants[0].win ? "Win" : "Lose",
      kda: `${data.match.info.participants[0].kills}/${data.match.info.participants[0].deaths}/${data.match.info.participants[0].assists}`,
      aiAdvice: advice
    }

    const prev = JSON.parse(localStorage.getItem("histories") || "[]")
    const updated = [newHistory, ...prev];
    localStorage.setItem("histories", JSON.stringify(updated));

  };

  return (
    <main className="min-h-screen w-full py-12 overflow-y-auto">
      <div className="flex flex-col items-center max-w-3xl mx-auto px-4">
        <Display />
        <Search />
        <RoleSelect role={role} onChange={setRole}/>
        <Button onClick={handleClick}>Search</Button>
        {result && (
        <SummonerCard 
          selectedSummoner={result.selectedSummoner}
          championName={result.match.info.participants[0].championName}
          kills={result.match.info.participants[0].kills}
          deaths={result.match.info.participants[0].deaths}
          assists={result.match.info.participants[0].assists}
          win={result.match.info.participants[0].win}
          gameDuration={result.match.info.gameDuration}
          />
          )}
                {aiResult && (
        <div className="mt-6 p-4 bg-gray-50 border rounded-lg max-w-md text-left">
          <h4 className="font-semibold text-gray-700 mb-2">
            コーチのアドバイス
          </h4>
          {aiResult.split("\n").map((line, index) => {
            const isSectionTitle =
              line.startsWith("🏹") ||
              line.startsWith("💡") ||
              line.startsWith("🔥") ||
              line.startsWith("💬");
            return (
              <p
                key={index}
                className={`mb-2 whitespace-pre-wrap ${
                  isSectionTitle
                    ? "font-semibold text-blue-600 mt-4"
                    : "text-gray-700"
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
    </main>
  );
}

