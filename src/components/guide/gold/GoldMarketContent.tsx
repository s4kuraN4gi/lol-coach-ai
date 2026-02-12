"use client";

import goldConstants from "@/data/gold_constants.json";
import Link from "next/link";
import { LuArrowUpRight, LuShield, LuSwords, LuGem } from "react-icons/lu";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedName } from "@/utils/goldLocalization";
import AdSenseBanner from "@/app/Components/ads/AdSenseBanner";

const AssetCard = ({ id, item, type, basePath, t, language }: { id: string; item: any; type: string; basePath: string; t: (key: string) => string; language: string }) => {
    const hasDetail = type === "objectives" && (id === "dragons" || id === "baron" || id === "herald" || id === "void_grubs");

    if (id === "dragons") return null;

    let valueStr = `${item.base_gold || item.gold || item.global_gold || item.local_gold}g`;

    return (
        <div className="bg-slate-900/50 border border-slate-700/50 hover:border-primary/50 transition-all p-4 rounded-xl group relative overflow-visible">
             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />

             <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    {item.icon_url ? (
                        <img src={item.icon_url} alt={item.name} className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(240,230,140,0.3)]" />
                    ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-lg text-slate-500">
                             <span className="text-xl">●</span>
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-foreground text-lg leading-none">{getLocalizedName(item, language as any)}</h3>
                        </div>
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{item.name}</span>
                    </div>
                </div>
             </div>

             <div className="flex items-end justify-between relative z-10 mt-4">
                <div>
                     <div className="text-xs text-slate-400 mb-1">{t('common.goldReward')}</div>
                     <div className="flex items-center gap-2">
                         <div className="text-2xl font-black text-primary font-numeric">{valueStr}</div>
                         {item.growth > 0 && (
                             <div className="relative group cursor-help">
                                 <span className="text-slate-500 text-sm">(?)</span>
                                 <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[200px] px-3 py-2 bg-slate-900 border border-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-xl z-50">
                                     {t('market.growthTooltip').replace('{growth}', item.growth)}
                                     <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                                 </div>
                             </div>
                         )}
                     </div>
                </div>
                {hasDetail && (
                    <Link href={`${basePath}/market/${id}`} className="text-xs bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded hover:bg-slate-600 transition border border-white/10">
                        {t('common.readMore')}
                    </Link>
                )}
             </div>
        </div>
    );
};

const DragonsSection = ({ dragons, basePath, t, language }: { dragons: any; basePath: string; t: (key: string) => string; language: string }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.entries(dragons).map(([key, dragon]: [string, any]) => (
            <Link key={key} href={`${basePath}/market/dragon_${key}`} className="block h-full">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-primary/20 hover:border-primary transition-all p-6 rounded-xl text-center relative group h-full flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />

                    <div className="mb-4 relative z-10">
                        <img
                            src={dragon.icon_url}
                            alt={dragon.name}
                            className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-300"
                        />
                    </div>

                    <h3 className="font-bold text-foreground text-xl mb-1 relative z-10">{getLocalizedName(dragon, language as any)}</h3>
                    <div className="text-xs text-slate-400 mb-3 relative z-10">{dragon.name}</div>

                    <div className="text-primary font-bold text-lg relative z-10">
                        {t('market.scaling')} <span className="text-xs font-normal text-slate-500">/ {t('market.multiplier')}</span>
                    </div>
                </div>
            </Link>
        ))}
    </div>
);

type Props = { basePath?: string };

export default function GoldMarketContent({ basePath = "/guide/gold" }: Props) {
  const { t, language } = useLanguage();

  const categories = [
      { id: "minions", title: t('market.categories.minions'), icon: <LuSwords />, data: goldConstants.minions },
      { id: "jungle", title: t('market.categories.jungle'), icon: <LuGem />, data: goldConstants.jungle.camps },
      { id: "objectives", title: t('market.categories.objectives'), icon: <LuShield />, data: goldConstants.objectives },
      { id: "structures", title: t('market.categories.structures'), icon: <LuArrowUpRight />, data: goldConstants.structures },
  ];

  return (
    <div className="animate-fadeIn pb-20 max-w-7xl mx-auto px-4">

      <AdSenseBanner className="mb-6 min-h-[90px]" />

      <header className="mb-10">
              <div className="flex items-center gap-4 mb-4">
                  <Link href={basePath} className="text-slate-400 hover:text-white transition">
                      {t('common.backToOverview')}
                  </Link>
                  <h1 className="text-3xl font-black text-foreground tracking-tight">{t('market.title')}</h1>
              </div>
              <p className="text-slate-400 max-w-2xl">
                  {t('market.description')}
              </p>
      </header>

      {/* 1. Dragons Special Section (High Value) */}
      <section className="mb-12">
          <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2 border-b border-slate-800 pb-2">
              <LuGem /> {t('market.dragonIndex')}
          </h2>
          <DragonsSection dragons={goldConstants.objectives.dragons} basePath={basePath} t={t} language={language} />
      </section>

      {/* 2. Standard Categories */}
      {categories.map((cat) => (
          <section key={cat.id} className="mb-12">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2 border-b border-slate-800 pb-2">
                  {cat.icon} {cat.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Object.entries(cat.data).map(([key, item]) => (
                      <AssetCard key={key} id={cat.id === "objectives" ? key : ""} item={item} type={cat.id} basePath={basePath} t={t} language={language} />
                  ))}
              </div>
          </section>
      ))}

      <AdSenseBanner className="mt-4 min-h-[90px]" />
    </div>
  );
}
