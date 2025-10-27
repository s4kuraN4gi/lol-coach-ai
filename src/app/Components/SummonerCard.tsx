import React from "react";

type SummonerCardProps = {
  summonerName: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  gameDuration: number;
};

export default function SummonerCard({
  summonerName,
  championName,
  kills,
  deaths,
  assists,
  win,
  gameDuration,
}: SummonerCardProps) {
  return (
    <div id="result" style={{ color: "#000000ff" }}>
        <div className="p-4 rounded-lg shadow-md border border-gray-300 bg-white text-center">
          <h3 className="text-lg font-semibold mb-2">{summonerName} の戦績</h3>
          <p>チャンピオン: {championName}</p>
          <p>KDA: {kills}/{deaths}/{assists}</p>
          <p>勝敗:{" "}{win ? "🏆 勝利" : "❌ 敗北"}</p>
          <p>試合時間: {Math.floor(gameDuration / 60)}分</p>
        </div>
    </div>
  );
}
