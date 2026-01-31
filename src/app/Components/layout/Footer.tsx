"use client";

import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Footer() {
    const { t } = useTranslation();
    
    return (
        <footer className="w-full py-6 px-4 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 text-center">
                
                {/* Links (Optional, good for SEO/Trust) */}
                <div className="flex gap-6 text-sm text-slate-400">
                    <Link href="/terms" className="hover:text-primary-400 transition-colors">{t('footer.terms')}</Link>
                    <Link href="/privacy" className="hover:text-primary-400 transition-colors">{t('footer.privacy')}</Link>
                    <Link href="/contact" className="hover:text-primary-400 transition-colors">{t('footer.contact')}</Link>
                </div>

                {/* Riot Games Disclaimer (Legal Jibber Jabber) */}
                <div className="max-w-3xl text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                    <p>
                        {t('footer.riotDisclaimer')}
                    </p>
                </div>
                
                {/* Copyright */}
                <div className="text-[10px] text-slate-600">
                    {t('footer.copyright').replace('{year}', new Date().getFullYear().toString())}
                </div>
            </div>
        </footer>
    );
}
