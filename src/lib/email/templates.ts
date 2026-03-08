/**
 * HTML email template builders for transactional emails.
 * All templates share the same base layout with LoLCoachAI branding.
 */
import { TRIAL_EMAIL_TEXTS, DUNNING_EMAIL_TEXTS, WINBACK_EMAIL_TEXTS } from './texts';

export function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function detectLang<T extends Record<string, unknown>>(texts: T, textsMap: { en: unknown; ko: unknown }): string {
    if (texts === textsMap.en) return 'en';
    if (texts === textsMap.ko) return 'ko';
    return 'ja';
}

function emailHeader(): string {
    return `
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:24px;font-weight:900;font-style:italic;letter-spacing:-0.05em;margin:0;">
        LoL<span style="color:#3b82f6;">Coach</span>AI
      </h1>
    </div>`;
}

function emailFooter(footerText: string): string {
    return `
    <div style="text-align:center;border-top:1px solid #1e293b;padding-top:24px;margin-top:32px;">
      <p style="color:#475569;font-size:11px;margin:0;">${footerText}</p>
    </div>`;
}

function emailWrapper(lang: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    ${emailHeader()}
    ${content}
  </div>
</body>
</html>`;
}

export function buildTrialReminderHtml(data: { name: string; trialEnd: string; texts: (typeof TRIAL_EMAIL_TEXTS)[keyof typeof TRIAL_EMAIL_TEXTS] }): string {
    const name = escapeHtml(data.name);
    const trialEnd = escapeHtml(data.trialEnd);
    const { texts } = data;
    const lang = detectLang(texts, TRIAL_EMAIL_TEXTS);

    const content = `
    <div style="background:linear-gradient(135deg,#1e1b4b20,#312e8120);border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:16px;">
      <h2 style="color:#fff;font-size:18px;margin:0 0 12px 0;">
        ${texts.heading(name)}
      </h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
        ${texts.body(trialEnd)}
      </p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
        ${texts.cancelNote}
      </p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://lolcoachai.com/account" style="display:inline-block;padding:12px 32px;background:linear-gradient(90deg,#2563eb,#06b6d4);color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">
        ${texts.cta}
      </a>
    </div>
    ${emailFooter(texts.footer)}`;

    return emailWrapper(lang, content);
}

export function buildDunningEmailHtml(data: { name: string; texts: (typeof DUNNING_EMAIL_TEXTS)[keyof typeof DUNNING_EMAIL_TEXTS] }): string {
    const name = escapeHtml(data.name);
    const { texts } = data;
    const lang = detectLang(texts, DUNNING_EMAIL_TEXTS);

    const content = `
    <div style="background:linear-gradient(135deg,#7f1d1d20,#451a0320);border:1px solid #dc262640;border-radius:16px;padding:24px;margin-bottom:16px;">
      <h2 style="color:#fca5a5;font-size:18px;margin:0 0 8px 0;">
        ${texts.heading(name)}
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 16px 0;">
        ${texts.body}
      </p>
      <a href="https://lolcoachai.com/account" style="display:inline-block;padding:12px 32px;background:linear-gradient(90deg,#dc2626,#f97316);color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">
        ${texts.updateCta}
      </a>
    </div>
    <p style="color:#64748b;font-size:12px;text-align:center;margin:16px 0;">
      ${texts.note}
    </p>
    ${emailFooter(texts.footer)}`;

    return emailWrapper(lang, content);
}

export function buildWinbackEmailHtml(data: { name: string; texts: (typeof WINBACK_EMAIL_TEXTS)[keyof typeof WINBACK_EMAIL_TEXTS] }): string {
    const name = escapeHtml(data.name);
    const { texts } = data;
    const lang = detectLang(texts, WINBACK_EMAIL_TEXTS);

    const content = `
    <div style="background:linear-gradient(135deg,#1e3a5f20,#1e40af20);border:1px solid #3b82f640;border-radius:16px;padding:24px;margin-bottom:16px;">
      <h2 style="color:#93c5fd;font-size:18px;margin:0 0 8px 0;">
        ${texts.heading(name)}
      </h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 12px 0;">
        ${texts.body}
      </p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
        ${texts.benefit}
      </p>
      <a href="https://lolcoachai.com/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(90deg,#2563eb,#06b6d4);color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">
        ${texts.cta}
      </a>
    </div>
    ${emailFooter(texts.footer)}`;

    return emailWrapper(lang, content);
}
