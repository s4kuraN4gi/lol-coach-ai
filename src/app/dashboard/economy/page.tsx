"use client";

import DashboardLayout from "../../Components/layout/DashboardLayout";
import { LuDollarSign, LuScale, LuSwords, LuArrowRight, LuCoins } from "react-icons/lu";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

export default function GoldEconomyPage() {
  const { t } = useTranslation();

  // Educational Comparison Content (uses translation keys)
  const valueComparisons = [
      {
          title: t('economy.comparison.killEqualsCs'),
          icon: <LuSwords className="text-red-400" />,
          desc: t('economy.comparison.killEqualsCsDesc'),
          left: "1 Kill (300g)",
          right: "15 CS (~315g)"
      },
      {
          title: t('economy.comparison.plateEqualsWaves'),
          icon: <LuScale className="text-amber-400" />,
          desc: t('economy.comparison.plateEqualsWavesDesc'),
          left: "1 Plate (175g)",
          right: "1.5 Waves (~180g)"
      },
      {
          title: t('economy.comparison.dragonEqualsKill'),
          icon: <LuCoins className="text-blue-400" />,
          desc: t('economy.comparison.dragonEqualsKillDesc'),
          left: "Dragon",
          right: "Scaling %"
      }
  ];

  return (
    <DashboardLayout>
      <div className="animate-fadeIn max-w-6xl mx-auto pb-20">
        
        {/* Header - Educational Introduction */}
        <header className="mb-12 text-center">
            <h1 className="text-4xl font-black italic tracking-tighter text-foreground mb-4 flex items-center justify-center gap-3">
                <LuDollarSign className="text-primary w-10 h-10" />
                {t('economy.title')}
            </h1>
            <p className="text-xl text-primary/80 font-medium mb-6">
                {t('economy.subtitle')}
            </p>
            <div className="max-w-3xl mx-auto bg-slate-900/80 p-6 rounded-xl border border-primary/20 text-left">
                <p className="text-slate-300 leading-relaxed mb-4">
                    <strong className="text-primary">{t('economy.principle1.title')}</strong><br/>
                    {t('economy.principle1.description')}
                </p>
                <p className="text-slate-300 leading-relaxed">
                    <strong className="text-primary">{t('economy.principle2.title')}</strong><br/>
                    {t('economy.principle2.description')}
                </p>
            </div>
        </header>

        {/* 1. Value Comparison Section (The "Why") */}
        <section className="mb-16">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-8 text-foreground px-4 border-l-4 border-primary">
                {t('economy.comparison.title')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {valueComparisons.map((item, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-700 p-6 rounded-xl hover:border-primary/50 transition duration-300 group">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-slate-800 rounded-full group-hover:bg-slate-700 transition">
                                {item.icon}
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                        </div>
                        
                        {/* Visual Scale */}
                        <div className="flex items-center justify-between text-sm font-mono bg-slate-950 p-3 rounded mb-4 border border-white/5">
                            <span className="text-primary">{item.left}</span>
                            <LuArrowRight className="text-slate-500" />
                            <span className="text-slate-300">{item.right}</span>
                        </div>

                        <p className="text-sm text-slate-400 leading-relaxed">
                            {item.desc}
                        </p>
                    </div>
                ))}
            </div>
        </section>

        {/* 2. Navigation to Data Sources (The "What") */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900 border border-primary/20 p-10 text-center group">
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
            
            <h2 className="text-3xl font-black italic text-foreground mb-4 relative z-10">
                GOLD SOURCE CATALOG
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-8 relative z-10">
                {t('market.description')}
            </p>

            <Link 
                href="/dashboard/economy/market"
                className="relative z-10 inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-950 font-black text-lg rounded-full hover:scale-105 transition-all shadow-xl hover:shadow-white/20 hover:bg-slate-100"
            >
                <LuCoins className="w-6 h-6" />
                {t('economy.cta')}
            </Link>
        </section>

      </div>
    </DashboardLayout>
  );
}
