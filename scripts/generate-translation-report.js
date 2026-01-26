/**
 * Translation Comparison Report Generator
 * Creates a markdown file showing all translations side-by-side for review
 * 
 * Usage: node scripts/generate-translation-report.js
 */

const fs = require('fs');
const path = require('path');

const LANGUAGES = ['ja', 'en', 'ko'];
const LANGUAGE_NAMES = { ja: '🇯🇵 日本語', en: '🇺🇸 English', ko: '🇰🇷 한국어' };

// Load the JSON file
const jsonPath = path.join(__dirname, '../src/data/gold_constants.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let report = [];

report.push('# 🌐 翻訳比較レポート (Translation Comparison Report)');
report.push('');
report.push('このレポートは自動生成されました。各翻訳が意味的に正しいか確認してください。');
report.push('');
report.push('---');
report.push('');

/**
 * Add a section to the report
 */
function addSection(title, items) {
    report.push(`## ${title}`);
    report.push('');
    
    for (const item of items) {
        report.push(`### ${item.name}`);
        report.push('');
        
        for (const field of item.fields) {
            report.push(`#### ${field.label}`);
            report.push('');
            report.push('| 言語 | テキスト |');
            report.push('|------|----------|');
            
            for (const lang of LANGUAGES) {
                const text = field.values[lang] || '❌ (なし)';
                const escapedText = text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
                report.push(`| ${LANGUAGE_NAMES[lang]} | ${escapedText} |`);
            }
            report.push('');
        }
        report.push('---');
        report.push('');
    }
}

/**
 * Extract multi-language field
 */
function extractMultiLang(obj) {
    if (!obj) return { ja: '', en: '', ko: '' };
    if (typeof obj === 'string') return { ja: obj, en: '', ko: '' };
    return {
        ja: obj.ja || '',
        en: obj.en || '',
        ko: obj.ko || ''
    };
}

/**
 * Extract tooltip fields
 */
function extractTooltip(tooltip) {
    if (!tooltip) return null;
    
    // New format: tooltip.ja.what, tooltip.en.what, etc.
    if (tooltip.ja || tooltip.en || tooltip.ko) {
        return {
            what: {
                ja: tooltip.ja?.what || '',
                en: tooltip.en?.what || '',
                ko: tooltip.ko?.what || ''
            },
            why: {
                ja: tooltip.ja?.why || '',
                en: tooltip.en?.why || '',
                ko: tooltip.ko?.why || ''
            },
            how: {
                ja: tooltip.ja?.how || '',
                en: tooltip.en?.how || '',
                ko: tooltip.ko?.how || ''
            }
        };
    }
    
    // Old format: tooltip.what directly
    return {
        what: { ja: tooltip.what || '', en: '', ko: '' },
        why: { ja: tooltip.why || '', en: '', ko: '' },
        how: { ja: tooltip.how || '', en: '', ko: '' }
    };
}

// Process Dragons
const dragonItems = [];
for (const [key, dragon] of Object.entries(data.objectives.dragons)) {
    const fields = [];
    
    // Name
    fields.push({
        label: '名前 (Name)',
        values: {
            ja: dragon.name_jp || '',
            en: dragon.name || '',
            ko: dragon.name_ko || ''
        }
    });
    
    // Buff Description
    if (dragon.buff_value) {
        fields.push({
            label: 'バフ説明 (Buff Description)',
            values: extractMultiLang(dragon.buff_value.buff_description)
        });
        
        if (dragon.buff_value.educational_note) {
            fields.push({
                label: '教育的ノート (Educational Note)',
                values: extractMultiLang(dragon.buff_value.educational_note)
            });
        }
    }
    
    // Tooltip
    const tooltip = extractTooltip(dragon.tooltip);
    if (tooltip) {
        fields.push({ label: 'What (概要)', values: tooltip.what });
        fields.push({ label: 'Why (重要性)', values: tooltip.why });
        fields.push({ label: 'How (獲得方法)', values: tooltip.how });
    }
    
    dragonItems.push({
        name: `🐉 ${dragon.name_jp || dragon.name} (${key})`,
        fields
    });
}
addSection('ドラゴン (Dragons)', dragonItems);

// Process Objectives (Baron, Herald, Void Grubs)
const objectiveItems = [];
for (const key of ['baron', 'herald', 'void_grubs']) {
    const obj = data.objectives[key];
    if (!obj) continue;
    
    const fields = [];
    
    // Name
    fields.push({
        label: '名前 (Name)',
        values: {
            ja: obj.name_jp || '',
            en: obj.name || '',
            ko: obj.name_ko || ''
        }
    });
    
    // Buff Description
    if (obj.buff_value) {
        fields.push({
            label: 'バフ説明 (Buff Description)',
            values: extractMultiLang(obj.buff_value.buff_description)
        });
        
        if (obj.buff_value.educational_note) {
            fields.push({
                label: '教育的ノート (Educational Note)',
                values: extractMultiLang(obj.buff_value.educational_note)
            });
        }
    }
    
    // Tooltip
    const tooltip = extractTooltip(obj.tooltip);
    if (tooltip) {
        fields.push({ label: 'What (概要)', values: tooltip.what });
        fields.push({ label: 'Why (重要性)', values: tooltip.why });
        fields.push({ label: 'How (獲得方法)', values: tooltip.how });
    }
    
    objectiveItems.push({
        name: `⚔️ ${obj.name_jp || obj.name} (${key})`,
        fields
    });
}
addSection('オブジェクト (Objectives)', objectiveItems);

// Write report
const reportPath = path.join(__dirname, '../docs/translation-report.md');
const docsDir = path.dirname(reportPath);

if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  📄 翻訳比較レポート生成完了');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  出力ファイル: ${reportPath}`);
console.log('');
console.log('  このレポートを確認して、翻訳の意味が正しいか検証してください。');
console.log('═══════════════════════════════════════════════════════════════');
