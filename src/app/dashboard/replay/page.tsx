'use client'

import React, { useState, useEffect, useTransition } from 'react'
import DashboardLayout from '../../Components/layout/DashboardLayout'
import { getAnalysisStatus, startMockAnalysis, upgradeToPremium, type AnalysisStatus } from '../../actions/analysis'
import { useRouter } from 'next/navigation'

export default function ReplayPage() {
    const [status, setStatus] = useState<AnalysisStatus | null>(null)
    const [url, setUrl] = useState('')
    const [result, setResult] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [loadingInit, setLoadingInit] = useState(true)

    useEffect(() => {
        getAnalysisStatus().then(data => {
            setStatus(data)
            setLoadingInit(false)
        })
    }, [])

    const handleAnalyze = () => {
        if (!url.trim()) return;
        setResult(null);

        startTransition(async () => {
            const res = await startMockAnalysis(url);
            if (res.error) {
                if (res.code === 'NO_CREDITS') {
                    alert('クレジットが不足しています。プレミアムプランへアップグレードしてください！');
                } else {
                    alert('エラー: ' + res.error);
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
        if (!confirm('【モック】プレミアムプラン(月額980円)に登録しますか？')) return;
        
        startTransition(async () => {
            const res = await upgradeToPremium();
            if (res.success) {
                alert('プレミアムプランに登録しました！');
                const newStatus = await getAnalysisStatus();
                setStatus(newStatus);
            }
        });
    };

    if (loadingInit) return <DashboardLayout><div className="p-8">読み込み中...</div></DashboardLayout>;

    const isPremium = status?.is_premium;
    const credits = status?.analysis_credits ?? 0;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* ヘッダー・ステータス表示 */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">リプレイ動画解析 (Beta)</h1>
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-4">
                        <div>
                            <span className="text-sm text-gray-500 block">プラン</span>
                            <span className={`font-bold ${isPremium ? 'text-amber-500' : 'text-gray-700'}`}>
                                {isPremium ? '💎 Premium' : 'Free Plan'}
                            </span>
                        </div>
                        {!isPremium && (
                            <div className="border-l pl-4">
                                <span className="text-sm text-gray-500 block">残りクレジット</span>
                                <span className={`font-bold ${credits === 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                    {credits} 回
                                </span>
                            </div>
                        )}
                        {!isPremium && (
                            <button 
                                onClick={handleUpgrade}
                                disabled={isPending}
                                className="ml-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 text-sm rounded hover:opacity-90 transition shadow"
                            >
                                アップグレード
                            </button>
                        )}
                    </div>
                </div>

                {/* メインエリア */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左側: アップロードフォーム */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4">動画を解析する</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL または 質問・コンテキスト</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="動画URL、または「この集団戦を見て」などのメモ"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50 text-gray-400">
                                    <p>または動画ファイルをここにドロップ</p>
                                    <span className="text-xs">(現在はAIによる簡易解析のみ対応)</span>
                                </div>

                                <button 
                                    onClick={handleAnalyze}
                                    disabled={isPending || !url}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center"
                                >
                                    {isPending ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Gemini AIが解析中...
                                        </>
                                    ) : '解析を開始'}
                                </button>
                                {!isPremium && (
                                    <p className="text-xs text-center text-gray-500">
                                        Freeプランは残り {credits} 回まで利用可能です
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 解析結果 */}
                        {result && (
                            <div className="bg-green-50 border border-green-200 p-6 rounded-xl animate-fade-in-up">
                                <h3 className="text-green-800 font-bold mb-2 flex items-center">
                                    <span className="text-xl mr-2">🤖</span> AIコーチのアドバイス
                                </h3>
                                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                    {result}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 右側: 説明や過去の履歴（モック） */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h3 className="font-semibold mb-3">解析機能について</h3>
                            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                                <li>集団戦の立ち位置を評価します</li>
                                <li>ガンク回避のタイミングを指導します</li>
                                <li>ワードの効率的な配置を提案します</li>
                            </ul>
                        </div>
                        
                        <div className="bg-gradient-to-br from-indigo-900 to-purple-800 p-6 rounded-xl text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2">💎 Premium Plan</h3>
                            <p className="text-indigo-100 text-sm mb-4">
                                月額 980円で無制限に解析が可能。プロレベルのコーチングを受け放題です。
                            </p>
                            {!isPremium ? (
                                <button 
                                    onClick={handleUpgrade} 
                                    disabled={isPending}
                                    className="w-full bg-white text-indigo-900 font-bold py-2 rounded hover:bg-gray-100 transition"
                                >
                                    アップグレードする
                                </button>
                            ) : (
                                <div className="text-center font-bold bg-white/20 py-2 rounded">
                                    加入済み
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
