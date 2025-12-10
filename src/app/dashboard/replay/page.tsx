"use client";

import React, { useState, useEffect, useTransition, ChangeEvent } from "react";
import DashboardLayout from "../../Components/layout/DashboardLayout";
import {
  getAnalysisStatus,
  analyzeVideo,
  upgradeToPremium,
  type AnalysisStatus,
} from "../../actions/analysis";

export default function ReplayPage() {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    getAnalysisStatus().then((data) => {
      setStatus(data);
      setLoadingInit(false);
    });
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Client-side size check (4.5MB limit warning)
      if (file.size > 4.5 * 1024 * 1024) {
        alert("ファイルサイズが大きすぎます (4.5MB以下にしてください)");
        e.target.value = ""; // clear
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleAnalyze = () => {
    if (!description.trim() && !selectedFile) return;
    setResult(null);

    const formData = new FormData();
    formData.append("description", description);
    if (selectedFile) {
      formData.append("video", selectedFile);
    }

    startTransition(async () => {
      const res = await analyzeVideo(formData);
      if (res.error) {
        if (res.code === "NO_CREDITS") {
          alert("クレジットが不足しています。プレミアムプランへアップグレードしてください！");
        } else {
          alert("エラー: " + res.error);
        }
        return;
      }
      if (res.advice) {
        setResult(res.advice);
        // ステータス再取得してクレジット表示更新
        const newStatus = await getAnalysisStatus();
        setStatus(newStatus);
      }
    });
  };

  const handleUpgrade = () => {
    if (!confirm("【モック】プレミアムプラン(月額980円)に登録しますか？")) return;

    startTransition(async () => {
      const res = await upgradeToPremium();
      if (res.success) {
        alert("プレミアムプランに登録しました！");
        const newStatus = await getAnalysisStatus();
        setStatus(newStatus);
      }
    });
  };

  if (loadingInit)
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-slate-400">Loading Analysis...</div>
      </DashboardLayout>
    );

  const isPremium = status?.is_premium;
  const credits = status?.analysis_credits ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto animate-fadeIn">
        {/* ヘッダー・ステータス表示 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white italic tracking-tighter">
            REPLAY ANALYSIS <span className="text-base not-italic text-slate-400 font-normal align-middle ml-2 border border-slate-700 rounded px-2 py-0.5">BETA</span>
          </h1>
          <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-400 block font-bold">PLAN</span>
              <span
                className={`font-black ${
                  isPremium ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" : "text-slate-200"
                }`}
              >
                {isPremium ? "💎 PREMIUM" : "FREE AGENT"}
              </span>
            </div>
            {!isPremium && (
              <div className="border-l border-slate-700 pl-4">
                <span className="text-xs text-slate-400 block font-bold">CREDITS</span>
                <span
                  className={`font-black ${
                    credits === 0 ? "text-red-500" : "text-blue-400"
                  }`}
                >
                  {credits} <span className="text-xs text-slate-500">REMAINING</span>
                </span>
              </div>
            )}
            {!isPremium && (
              <button
                onClick={handleUpgrade}
                disabled={isPending}
                className="ml-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-1 text-sm rounded hover:opacity-90 transition shadow-[0_0_10px_rgba(245,158,11,0.3)]"
              >
                UPGRADE
              </button>
            )}
          </div>
        </div>

        {/* メインエリア */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側: アップロードフォーム */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-8 rounded-xl border border-slate-700/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
                
              <h2 className="text-xl font-bold mb-6 text-slate-200 flex items-center gap-2">
                  <span className="text-2xl">📹</span> UPLOAD & ANALYZE
              </h2>

              <div className="space-y-6 relative z-10">
                {/* File Input */}
                <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Video File (MP4/MOV, Max 4.5MB)</label>
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${selectedFile ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`}>
                        <input
                            type="file"
                            accept="video/mp4,video/quicktime"
                            onChange={handleFileChange}
                            className={`w-full h-full opacity-0 absolute inset-0 cursor-pointer ${isPending ? 'pointer-events-none' : ''}`}
                            disabled={isPending}
                        />
                         {selectedFile ? (
                            <div className="text-blue-200 font-bold flex flex-col items-center">
                                <span className="text-3xl mb-2">🎬</span>
                                {selectedFile.name}
                                <span className="text-xs text-blue-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        ) : (
                            <div className="text-slate-500 flex flex-col items-center pointer-events-none">
                                <span className="text-3xl mb-2 text-slate-600">📂</span>
                                <p className="font-bold">Click or Drag video here</p>
                                <p className="text-xs mt-1">Supports MP4, MOV (Short clips recommended)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Text/URL Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">
                    Context / Question / URL
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. 'How was my positioning in this teamfight?' or YouTube URL"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isPending || (!description && !selectedFile)}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold hover:bg-blue-500 disabled:opacity-50 disabled:grayscale transition shadow-lg shadow-blue-900/20 active:scale-95 flex justify-center items-center gap-2 group"
                >
                  {isPending ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white/50 border-t-white rounded-full"></div>
                      <span className="animate-pulse">ANALYZING VIDEO (GEMINI 1.5)...</span>
                    </>
                  ) : (
                    <>
                        <span>🚀</span> ANALYZE CLIP
                    </>
                  )}
                </button>
                {!isPremium && (
                  <p className="text-xs text-center text-slate-500 font-mono">
                    Free plan: {credits} credits remaining
                  </p>
                )}
              </div>
            </div>

            {/* 解析結果 */}
            {result && (
              <div className="glass-panel p-8 rounded-xl border border-green-500/30 bg-green-900/10 animate-fade-in-up">
                <h3 className="text-green-400 font-black text-lg mb-4 flex items-center gap-3">
                  <span className="text-2xl">🤖</span> AI COACH FEEDBACK
                </h3>
                <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
                  {result}
                </div>
              </div>
            )}
          </div>

          {/* 右側: 説明や過去の履歴（モック） */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
              <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  HOW IT WORKS
              </h3>
              <ul className="text-sm text-slate-400 space-y-3">
                <li className="flex gap-2">
                    <span className="text-blue-500 font-bold">1.</span>
                    Upload a short clip of a teamfight or laning phase.
                </li>
                <li className="flex gap-2">
                    <span className="text-blue-500 font-bold">2.</span>
                    Ask specific questions about positioning or mechanics.
                </li>
                <li className="flex gap-2">
                    <span className="text-blue-500 font-bold">3.</span>
                    Google Gemini Vision AI analyzes the visual data and gives feedback.
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-violet-900 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
                    <span className="text-6xl">💎</span>
                </div>
              <h3 className="font-black text-xl mb-2 italic">UNLOCK PREMIUM</h3>
              <p className="text-indigo-200 text-sm mb-6 leading-relaxed">
                Get unlimited video analysis, priority processing, and advanced coaching insights for just $9.99/mo.
              </p>
              {!isPremium ? (
                <button
                  onClick={handleUpgrade}
                  disabled={isPending}
                  className="w-full bg-white text-indigo-900 font-black py-3 rounded-lg hover:bg-indigo-50 transition shadow-lg"
                >
                  UPGRADE NOW
                </button>
              ) : (
                <div className="text-center font-bold bg-white/20 py-2 rounded border border-white/30 backdrop-blur">
                  ACTIVE MEMBER
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
