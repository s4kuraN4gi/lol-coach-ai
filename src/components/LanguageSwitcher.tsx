"use client";

import { useLanguage, LANGUAGES, Language } from "@/contexts/LanguageContext";
import { LuGlobe } from "react-icons/lu";

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-primary/50 transition text-sm text-slate-300 hover:text-white">
                <LuGlobe className="w-4 h-4" />
                <span>{LANGUAGES.find(l => l.code === language)?.nativeName}</span>
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {/* Dropdown */}
            <div className="absolute top-full right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
                {LANGUAGES.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition first:rounded-t-lg last:rounded-b-lg ${
                            language === lang.code
                                ? "text-primary bg-slate-800/50"
                                : "text-slate-300"
                        }`}
                    >
                        {lang.nativeName}
                    </button>
                ))}
            </div>
        </div>
    );
}
