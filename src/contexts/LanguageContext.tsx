"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import jaLocale from '@/locales/ja.json';
import enLocale from '@/locales/en.json';
import koLocale from '@/locales/ko.json';

// Supported languages
export type Language = 'ja' | 'en' | 'ko';

export const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

// Locale data mapping
const locales: Record<Language, typeof jaLocale> = {
    ja: jaLocale,
    en: enLocale,
    ko: koLocale,
};

// Context type
interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper to get nested value from object by dot notation
function getNestedValue(obj: any, path: string): string | undefined {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            return undefined;
        }
    }
    return typeof result === 'string' ? result : undefined;
}

// Provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('ja');
    const [isHydrated, setIsHydrated] = useState(false);

    // Load language from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('language') as Language | null;
        if (stored && ['ja', 'en', 'ko'].includes(stored)) {
            setLanguageState(stored);
        }
        setIsHydrated(true);
    }, []);

    // Save language to localStorage when changed
    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    // Translation function
    const t = (key: string, fallback?: string): string => {
        const value = getNestedValue(locales[language], key);
        if (value) return value;
        
        // Fallback to Japanese if key not found
        const jaValue = getNestedValue(locales.ja, key);
        if (jaValue) return jaValue;
        
        // Return fallback or key if nothing found
        return fallback || key;
    };

    // Prevent hydration mismatch by using default language until hydrated
    const contextValue: LanguageContextType = {
        language: isHydrated ? language : 'ja',
        setLanguage,
        t,
    };

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
}

// Hook to use language context
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Shorthand hook for translation only
export function useTranslation() {
    const { t, language } = useLanguage();
    return { t, language };
}
