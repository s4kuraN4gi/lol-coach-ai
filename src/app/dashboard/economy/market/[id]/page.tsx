"use client";

import { use } from "react";
import DashboardLayout from "../../../../Components/layout/DashboardLayout";
import goldConstants from "@/data/gold_constants.json";
import Link from "next/link";
import { LuBookOpen, LuTarget, LuCoins, LuInfo } from "react-icons/lu";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedName, getLocalizedTooltip, getLocalizedBuffValue } from "@/utils/goldLocalization";

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { t, language } = useLanguage();
  
  // Get localized content helpers
  const getName = (item: any) => getLocalizedName(item, language);
  const getTooltip = (item: any) => getLocalizedTooltip(item, language);
  const getBuffValue = (item: any) => getLocalizedBuffValue(item, language);
  
  // Logic to find the asset in goldConstants
  let asset: any = null;
  let category = "";
  
  if (id.startsWith("dragon_")) {
      const dragonKey = id.replace("dragon_", "");
      // @ts-ignore
      asset = goldConstants.objectives.dragons[dragonKey];
      category = t('detail.category.dragon');
  } else if (id === "baron" || id === "herald" || id === "void_grubs") {
      // @ts-ignore
      asset = goldConstants.objectives[id];
      category = t('detail.category.objective');
  }

  if (!asset) {
      return (
          <DashboardLayout>
              <div className="p-8 text-center text-slate-500">Asset Not Found: {id}</div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout>
      <div className="animate-fadeIn pb-20 max-w-6xl mx-auto">
        
        <Link href="/dashboard/economy/market" className="text-slate-400 hover:text-white text-sm mb-6 inline-block transition">
            {t('common.backToList')}
        </Link>
        
        {/* Main Guide Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            
            {/* Header */}
            <div className="bg-slate-800 p-8 flex flex-col md:flex-row gap-8 items-center border-b border-slate-700">
                <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center border-2 border-primary/20 p-4 shrink-0 relative">
                    {asset.tier && (
                        <div className="absolute -top-2 -right-2 z-10 group cursor-help">
                            <div className="bg-gradient-to-br from-amber-300 to-amber-500 text-black font-black text-xl w-10 h-10 flex items-center justify-center rounded-full border-2 border-white shadow-lg">
                                {asset.tier}
                            </div>
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-900 border border-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
                                {t('common.priority')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                            </div>
                        </div>
                    )}
                    {asset.icon_url ? (
                            <img 
                            src={asset.icon_url} 
                            alt={asset.name} 
                            className="w-full h-full object-contain"
                            />
                    ) : (
                            <span className="text-5xl">🐉</span>
                    )}
                </div>
                
                <div className="text-center md:text-left flex-grow">
                    <div className="text-xs font-bold text-primary tracking-widest mb-1">{category}</div>
                    <h1 className="text-3xl font-black text-foreground mb-2">{getName(asset)}</h1>
                    <div className="text-slate-400 font-mono text-sm mb-4">{asset.name}</div>
                    
                    <div className="inline-flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-white/10">
                        <LuCoins className="text-amber-400" />
                        <span className="text-slate-300 text-sm">{t('common.goldReward')}:</span>
                        <span className="text-amber-400 font-bold">{asset.global_gold || asset.local_gold}g</span>
                        <span className="text-slate-500 text-xs ml-1">{t('common.buffEffect')}</span>
                    </div>
                </div>
            </div>

            <div className="p-8 pb-16 grid gap-8">
                
                 <section>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                        <LuBookOpen className="text-primary" />
                        {t('detail.sections.whatWhy')}
                    </h2>
                    <div className="bg-slate-800/50 p-6 rounded-lg text-slate-300 leading-relaxed space-y-4">
                        <p>
                            <strong className="text-white block mb-1">{t('detail.sections.basicEffect')}</strong>
                            {getBuffValue(asset)?.buff_description || getTooltip(asset)?.what}
                        </p>
                        <p>
                            <strong className="text-white block mb-1">{t('detail.sections.whyImportant')}</strong>
                            {getTooltip(asset)?.why || t('detail.defaultWhy')}
                        </p>
                    </div>
                </section>

                {/* 2. Concrete Value Example (Full Width) */}
                {getBuffValue(asset)?.educational_note && (
                    <section>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                            <LuInfo className="text-blue-400" />
                            {t('detail.sections.concreteValue')}
                        </h2>
                        <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-lg text-slate-300 leading-relaxed">
                            <p className="font-mono text-sm text-blue-300 mb-2">{t('detail.sections.csItemExample')}</p>
                            {getBuffValue(asset)?.educational_note}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 3. Tactical Advice (How) */}
                    <section>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                            <LuTarget className="text-green-400" />
                            {t('detail.sections.howToSecure')}
                        </h2>
                        <div className="bg-slate-800/50 p-6 rounded-lg text-slate-300 leading-relaxed h-full">
                            {getTooltip(asset)?.how || t('detail.defaultHow')}
                        </div>
                    </section>
                    
                    {/* 4. Value Scaling (Multiplier) - Only show for Dragons */}
                    <section>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                            <LuInfo className="text-blue-400" />
                             {t('detail.sections.scaling')}
                        </h2>
                        <div className="bg-slate-800/50 p-6 rounded-lg text-sm text-slate-400 h-full flex flex-col justify-center">
                            {id.startsWith("dragon_") ? (
                                <>
                                    <p className="mb-4">
                                        <strong className="text-primary block mb-1">{t('detail.scalingDragon.title')}</strong>
                                        {t('detail.scalingDragon.description')}
                                    </p>
                                    <p>
                                        {t('detail.scalingDragon.note')}
                                    </p>
                                </>
                            ) : (
                                <p>
                                    <strong className="text-primary block mb-1">{t('detail.scalingFixed.title')}</strong>
                                    {t('detail.scalingFixed.description')}
                                </p>
                            )}
                        </div>
                    </section>
                </div>

            </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
