'use client'

import { useState, useEffect } from "react";

const LOADING_TEXTS = [
    "サモナー情報を同期中...",
    "リフトのデータを解析中...",
    "ミニオンウェーブを計算中...",
    "勝利へのルートを検索中...",
    "AIコーチを召喚中...",
    "ジャングルルートを偵察中...",
    "アイテムビルドを最適化中..."
];

export default function LoadingAnimation() {
    const [textIndex, setTextIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTextIndex(prev => (prev + 1) % LOADING_TEXTS.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
            <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-12 animate-pulse">
                LOL COACH AI
            </h2>
            
            <div className="relative w-24 h-24 mb-8">
                {/* Outer Ring */}
                <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                
                {/* Spinning Rings */}
                <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-4 border-cyan-400 rounded-full animate-spin-reverse"></div>
                <div className="absolute inset-4 border-b-4 border-purple-500 rounded-full animate-spin duration-700"></div>
                
                {/* Center Core */}
                <div className="absolute inset-0 m-auto w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse"></div>
            </div>
            
            <div className="h-6 overflow-hidden relative">
                 <p key={textIndex} className="text-slate-400 font-mono tracking-widest animate-slideUpFade">
                    {LOADING_TEXTS[textIndex]}
                 </p>
            </div>
            
            {/* Fake progress bar */}
            <div className="w-48 h-1 bg-slate-800 mt-4 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-purple-400 animate-progress"></div>
            </div>
        </div>
    );
}
