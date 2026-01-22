/**
 * Translation Validation Script
 * Checks gold_constants.json for translation consistency across ja/en/ko
 * 
 * Usage: node scripts/validate-translations.js
 */

const fs = require('fs');
const path = require('path');

const LANGUAGES = ['ja', 'en', 'ko'];
const LANGUAGE_NAMES = { ja: '日本語', en: 'English', ko: '한국어' };

// Load the JSON file
const jsonPath = path.join(__dirname, '../src/data/gold_constants.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let issues = [];
let stats = {
    totalFields: 0,
    missingTranslations: 0,
    emptyTranslations: 0,
    lengthWarnings: 0
};

/**
 * Check if a value is a multi-language object
 */
function isMultiLangObject(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    return LANGUAGES.some(lang => lang in obj);
}

/**
 * Validate a multi-language field
 */
function validateMultiLangField(obj, path) {
    stats.totalFields++;
    
    for (const lang of LANGUAGES) {
        if (!(lang in obj)) {
            issues.push({
                type: 'MISSING',
                path: path,
                language: lang,
                message: `❌ 欠落: ${LANGUAGE_NAMES[lang]} の翻訳がありません`
            });
            stats.missingTranslations++;
        } else if (!obj[lang] || obj[lang].trim() === '') {
            issues.push({
                type: 'EMPTY',
                path: path,
                language: lang,
                message: `⚠️ 空: ${LANGUAGE_NAMES[lang]} の翻訳が空です`
            });
            stats.emptyTranslations++;
        }
    }
    
    // Check length discrepancy (translations should be roughly similar length)
    const lengths = LANGUAGES.map(lang => (obj[lang] || '').length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    
    for (let i = 0; i < LANGUAGES.length; i++) {
        const ratio = lengths[i] / avgLength;
        // If a translation is less than 30% or more than 300% of average, warn
        if (ratio < 0.3 || ratio > 3.0) {
            if (lengths[i] > 0) { // Only warn if not empty (empty is caught above)
                issues.push({
                    type: 'LENGTH',
                    path: path,
                    language: LANGUAGES[i],
                    message: `📏 長さ警告: ${LANGUAGE_NAMES[LANGUAGES[i]]} の翻訳が他と大きく異なります (${lengths[i]}文字 vs 平均${Math.round(avgLength)}文字)`
                });
                stats.lengthWarnings++;
            }
        }
    }
}

/**
 * Validate tooltip object (should have ja/en/ko with what/why/how)
 */
function validateTooltip(tooltip, path) {
    if (!tooltip) return;
    
    // Check if tooltip is in new format (language keys at top level)
    if (isMultiLangObject(tooltip)) {
        // New format: tooltip.ja.what, tooltip.en.what, etc.
        for (const lang of LANGUAGES) {
            if (!(lang in tooltip)) {
                issues.push({
                    type: 'MISSING',
                    path: `${path}.${lang}`,
                    language: lang,
                    message: `❌ 欠落: ${LANGUAGE_NAMES[lang]} のtooltipがありません`
                });
                stats.missingTranslations++;
            } else {
                const langTooltip = tooltip[lang];
                for (const key of ['what', 'why', 'how']) {
                    if (!langTooltip[key]) {
                        issues.push({
                            type: 'MISSING',
                            path: `${path}.${lang}.${key}`,
                            language: lang,
                            message: `❌ 欠落: ${LANGUAGE_NAMES[lang]} の ${key} がありません`
                        });
                        stats.missingTranslations++;
                    }
                }
            }
        }
    } else if (tooltip.what || tooltip.why || tooltip.how) {
        // Old format: tooltip.what directly (Japanese only)
        issues.push({
            type: 'OLD_FORMAT',
            path: path,
            language: 'all',
            message: `🔄 旧形式: tooltipが多言語形式に変換されていません (日本語のみ)`
        });
    }
}

/**
 * Recursively scan the JSON for translation fields
 */
function scanObject(obj, currentPath = '') {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (key === 'buff_description' || key === 'educational_note') {
            if (isMultiLangObject(value)) {
                validateMultiLangField(value, newPath);
            } else if (typeof value === 'string') {
                issues.push({
                    type: 'OLD_FORMAT',
                    path: newPath,
                    language: 'all',
                    message: `🔄 旧形式: ${key} が多言語形式に変換されていません`
                });
            }
        } else if (key === 'tooltip') {
            validateTooltip(value, newPath);
        } else if (key === 'name_jp' || key === 'name_ko') {
            // Check that corresponding translations exist
            const parent = obj;
            if (key === 'name_jp' && !parent.name_ko && parent.name) {
                // Only flag if it's an item that should have translations
                // (has name_jp but missing name_ko)
            }
        } else if (typeof value === 'object') {
            scanObject(value, newPath);
        }
    }
}

// Run validation
console.log('═══════════════════════════════════════════════════════════════');
console.log('  🌐 翻訳検証スクリプト - Translation Validation Script');
console.log('═══════════════════════════════════════════════════════════════\n');

scanObject(data);

// Output results
if (issues.length === 0) {
    console.log('✅ すべての翻訳が正常です！問題は見つかりませんでした。\n');
} else {
    console.log(`⚠️ ${issues.length} 件の問題が見つかりました:\n`);
    
    // Group by type
    const grouped = {};
    for (const issue of issues) {
        if (!grouped[issue.type]) grouped[issue.type] = [];
        grouped[issue.type].push(issue);
    }
    
    for (const type of Object.keys(grouped)) {
        console.log(`\n【${type}】`);
        for (const issue of grouped[type]) {
            console.log(`  ${issue.message}`);
            console.log(`    パス: ${issue.path}`);
        }
    }
}

console.log('\n───────────────────────────────────────────────────────────────');
console.log('  📊 統計サマリー');
console.log('───────────────────────────────────────────────────────────────');
console.log(`  翻訳フィールド総数: ${stats.totalFields}`);
console.log(`  欠落した翻訳: ${stats.missingTranslations}`);
console.log(`  空の翻訳: ${stats.emptyTranslations}`);
console.log(`  長さの警告: ${stats.lengthWarnings}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Exit with error code if issues found
process.exit(issues.length > 0 ? 1 : 0);
