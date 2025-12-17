"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "./Components/layout/Footer";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "bg-slate-900/90 backdrop-blur shadow-lg py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-amber-300">
              LoL Coach AI
            </span>
          </div>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-lg shadow-blue-500/30"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            AIで<br className="md:hidden" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-200">
              レートをぶち上げろ
            </span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            あなたのプレイデータをAIが分析し、
            <br className="hidden md:block" />
            プロ級の具体的なコーチングアドバイスを即座に提供します。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              className="px-8 py-4 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full hover:scale-105 transition duration-300 shadow-xl shadow-blue-500/20 border border-blue-400/30"
            >
              今すぐAIコーチングを受ける
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-lg font-medium text-gray-300 hover:text-white flex items-center gap-2 group"
            >
              ログイン
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Stats / Mock UI Preview */}
          <div className="mt-20 relative mx-auto max-w-5xl rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-slate-800/50 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
            
            {/* Mock Dashboard UI Component */}
            <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80">
                {/* Mock Card 1 */}
                <div className="bg-slate-800 p-4 rounded-lg border border-white/5">
                    <div className="h-4 w-24 bg-blue-500/20 rounded mb-4 animate-pulse"></div>
                    <div className="h-32 w-full bg-slate-700/30 rounded flex items-center justify-center text-slate-500 text-sm">
                        Win Rate Graph
                    </div>
                </div>
                 {/* Mock Card 2 (Main) */}
                 <div className="md:col-span-2 bg-slate-800 p-6 rounded-lg border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-300 font-bold">AI</div>
                        <div className="text-left">
                            <div className="font-bold text-white">AI Coach Analysis</div>
                            <div className="text-xs text-gray-400">Just now</div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-3 bg-gray-600/50 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-600/50 rounded w-full"></div>
                        <div className="h-3 bg-gray-600/50 rounded w-5/6"></div>
                    </div>
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-sm text-green-300 text-left">
                        &quot;素晴らしい視界管理です！次はバロン前のセットアップを意識しましょう&quot;
                    </div>
                </div>
            </div>
            
             <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900 to-transparent z-20 flex items-end justify-center pb-4">
                <span className="text-sm text-gray-500 font-mono">DASHBOARD PREVIEW</span>
             </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-slate-900 relative">
        <div className="container mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    最強のパートナーを手に入れろ
                </h2>
                <p className="text-gray-400">
                    最新のAI技術とRiot APIを駆使して、あなたのプレイを徹底解剖します。
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="bg-slate-800/50 p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 transition hover:-translate-y-1">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center text-2xl mb-6">
                        📊
                    </div>
                    <h3 className="text-xl font-bold mb-3">戦績詳細分析</h3>
                    <p className="text-gray-400 leading-relaxed">
                        KDAやCSだけでなく、視界スコアやダメージ効率など、勝利に直結する重要指標を可視化します。
                    </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-slate-800/50 p-8 rounded-2xl border border-white/5 hover:border-amber-500/30 transition hover:-translate-y-1">
                    <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center text-2xl mb-6">
                        🤖
                    </div>
                    <h3 className="text-xl font-bold mb-3">AIコーチング</h3>
                    <p className="text-gray-400 leading-relaxed">
                        あなたの苦手なマッチアップや、改善すべき立ち回りをAIが特定し、具体的なアドバイスを提供します。
                    </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-slate-800/50 p-8 rounded-2xl border border-white/5 hover:border-purple-500/30 transition hover:-translate-y-1">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center text-2xl mb-6">
                        🎥
                    </div>
                    <h3 className="text-xl font-bold mb-3">リプレイ動画解析</h3>
                    <p className="text-gray-400 leading-relaxed">
                        動画URLやクリップを読み込ませるだけで、集団戦のポジショニングミスなどをAIが指摘します。
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/10 -z-10" />
         <div className="container mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-8">
                今すぐ、次のランクへ。
            </h2>
            <Link
              href="/signup"
              className="inline-block px-12 py-5 text-xl font-bold bg-white text-slate-900 rounded-full hover:bg-gray-100 transition shadow-xl"
            >
              無料でアカウント作成
            </Link>
            <p className="mt-6 text-sm text-gray-500">
                クレジットカード不要 &middot; Riot ID連携のみで開始
            </p>
         </div>
      </section>

      {/* Footer */}
      {/* Footer */}
      <Footer />
    </div>
  );
}
