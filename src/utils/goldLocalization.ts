import { Language } from "@/contexts/LanguageContext";

/** Gold constant item — flexible shape from gold_constants.json */
export interface GoldItem {
    name?: string;
    name_jp?: string;
    name_ko?: string;
    tooltip?: Record<string, unknown>;
    buff_value?: Record<string, unknown>;
    icon_url?: string;
    base_gold?: number;
    gold?: number;
    global_gold?: number;
    local_gold?: number;
    growth?: number;
    tier?: string | number;
    [key: string]: unknown;
}

/**
 * Get localized name from gold_constants item
 * Supports both old format (name/name_jp) and new format (name: { ja, en, ko })
 */
export function getLocalizedName(item: GoldItem, language: Language): string {
    if (!item) return "";

    // New format: name is an object with language keys (handled via [key: string])
    const nameVal = item.name as unknown;
    if (typeof nameVal === 'object' && nameVal !== null) {
        const nameObj = nameVal as Record<string, string>;
        return nameObj[language] || nameObj.en || nameObj.ja || "";
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
export function getLocalizedTooltip(item: GoldItem, language: Language): { what: string; why: string; how: string } | null {
    if (!item?.tooltip) return null;

    const tip = item.tooltip as Record<string, Record<string, string> | string>;

    // New format: tooltip has language keys at top level
    if (tip[language] && typeof tip[language] === 'object') {
        return tip[language] as unknown as { what: string; why: string; how: string };
    }

    // Old format: tooltip has what/why/how directly (Japanese)
    if (tip.what || tip.why || tip.how) {
        return {
            what: (tip.what as string) || "",
            why: (tip.why as string) || "",
            how: (tip.how as string) || ""
        };
    }

    return null;
}

/**
 * Get localized buff description and educational note
 */
export function getLocalizedBuffValue(item: GoldItem, language: Language): {
    buff_description: string;
    educational_note: string;
} | null {
    if (!item?.buff_value) return null;

    const bv = item.buff_value as Record<string, string | Record<string, string>>;

    // New format: buff_value has language-specific descriptions
    if (bv.buff_description && typeof bv.buff_description === 'object') {
        const desc = bv.buff_description as Record<string, string>;
        const note = bv.educational_note as Record<string, string> | undefined;
        return {
            buff_description: desc[language] || desc.ja || "",
            educational_note: note?.[language] || note?.ja || ""
        };
    }

    // Old format: single language (Japanese)
    return {
        buff_description: (bv.buff_description as string) || "",
        educational_note: (bv.educational_note as string) || ""
    };
}
