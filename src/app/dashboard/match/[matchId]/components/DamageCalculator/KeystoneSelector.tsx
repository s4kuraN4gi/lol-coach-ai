"use client";

import { keystoneData } from "@/data/damageCalc/keystones";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  selectedId: string | null;
  onChange: (id: string | null) => void;
};

export default function KeystoneSelector({ selectedId, onChange }: Props) {
  const { language } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      {/* None option */}
      <button
        onClick={() => onChange(null)}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
          selectedId === null
            ? "bg-slate-600 text-white"
            : "bg-slate-800 text-slate-500 hover:bg-slate-700"
        }`}
      >
        {language === "ja" ? "なし" : language === "ko" ? "없음" : "None"}
      </button>

      {keystoneData.map((ks) => {
        const isSelected = selectedId === ks.id;
        const name = ks.name[language] || ks.name.en;

        return (
          <button
            key={ks.id}
            onClick={() => onChange(isSelected ? null : ks.id)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              isSelected
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent"
            }`}
            title={ks.description[language] || ks.description.en}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
