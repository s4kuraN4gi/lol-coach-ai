import { Language } from "@/contexts/LanguageContext";

/**
 * Get localized name from gold_constants item
 * Supports both old format (name/name_jp) and new format (name: { ja, en, ko })
 */
export function getLocalizedName(item: any, language: Language): string {
    if (!item) return "";
    
    // New format: name is an object with language keys
    if (typeof item.name === 'object' && item.name !== null) {
        return item.name[language] || item.name.en || item.name.ja || "";
    }
    
    // Old format: separate name and name_jp fields
    if (language === 'ja' && item.name_jp) {
        return item.name_jp;
    }
    if (language === 'ko' && item.name_ko) {
        return item.name_ko;
    }
    
    // Fallback to English name
    return item.name || "";
}

/**
 * Get localized tooltip from gold_constants item
 * Supports both old format (tooltip.what/why/how in one language) 
 * and new format (tooltip: { ja: {...}, en: {...}, ko: {...} })
 */
export function getLocalizedTooltip(item: any, language: Language): { what: string; why: string; how: string } | null {
    if (!item?.tooltip) return null;
    
    // New format: tooltip has language keys at top level
    if (item.tooltip[language] && typeof item.tooltip[language] === 'object') {
        return item.tooltip[language];
    }
    
    // Old format: tooltip has what/why/how directly (Japanese)
    if (item.tooltip.what || item.tooltip.why || item.tooltip.how) {
        // For non-Japanese, we'd need translations - for now return Japanese as fallback
        return {
            what: item.tooltip.what || "",
            why: item.tooltip.why || "",
            how: item.tooltip.how || ""
        };
    }
    
    return null;
}

/**
 * Get localized buff description and educational note
 */
export function getLocalizedBuffValue(item: any, language: Language): { 
    buff_description: string; 
    educational_note: string;
} | null {
    if (!item?.buff_value) return null;
    
    const bv = item.buff_value;
    
    // New format: buff_value has language-specific descriptions
    if (bv.buff_description && typeof bv.buff_description === 'object') {
        return {
            buff_description: bv.buff_description[language] || bv.buff_description.ja || "",
            educational_note: bv.educational_note?.[language] || bv.educational_note?.ja || ""
        };
    }
    
    // Old format: single language (Japanese)
    return {
        buff_description: bv.buff_description || "",
        educational_note: bv.educational_note || ""
    };
}
