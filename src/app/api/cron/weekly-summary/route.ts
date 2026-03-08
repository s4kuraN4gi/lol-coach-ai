import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[WeeklySummary] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    logger.error('[WeeklySummary] RESEND_API_KEY not configured');
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createServiceRoleClient();

  // Fetch premium users with email
  const { data: premiumUsers, error: fetchError } = await supabase
    .from('profiles')
    .select('id, summoner_name, weekly_analysis_count, subscription_tier, language_preference')
    .eq('is_premium', true)
    .in('subscription_status', ['active', 'trialing']);

  if (fetchError) {
    logger.error('[WeeklySummary] Failed to fetch premium users:', fetchError.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  if (!premiumUsers || premiumUsers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Pre-fetch aggregated counts to avoid N+1 queries
  let sentCount = 0;
  const fromAddress = process.env.EMAIL_FROM || 'LoL Coach AI <noreply@lolcoachai.com>';
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString();
  const userIds = premiumUsers.map(u => u.id);

  // Batch fetch: match analysis counts per user (single query)
  const matchCountMap = new Map<string, number>();
  const { data: matchCounts } = await supabase
    .from('match_analyses')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', weekAgoISO);
  if (matchCounts) {
    for (const row of matchCounts) {
      matchCountMap.set(row.user_id, (matchCountMap.get(row.user_id) || 0) + 1);
    }
  }

  // Batch fetch: video analysis counts per user (single query)
  const videoCountMap = new Map<string, number>();
  const { data: videoCounts } = await supabase
    .from('video_analyses')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', weekAgoISO);
  if (videoCounts) {
    for (const row of videoCounts) {
      videoCountMap.set(row.user_id, (videoCountMap.get(row.user_id) || 0) + 1);
    }
  }

  // Batch fetch ALL user emails from auth.users (single scan, shared by premium + free)
  const emailMap = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (listError || !users || users.length === 0) break;
    for (const u of users) {
      if (u.email) {
        emailMap.set(u.id, u.email);
      }
    }
    hasMore = users.length === perPage;
    page++;
  }

  for (let i = 0; i < premiumUsers.length; i += BATCH_SIZE) {
    const batch = premiumUsers.slice(i, i + BATCH_SIZE);

    for (const profile of batch) {
      try {
        const email = emailMap.get(profile.id);
        if (!email) continue;
        const name = profile.summoner_name || 'Summoner';
        const analysisCount = profile.weekly_analysis_count || 0;
        const tier = profile.subscription_tier === 'extra' ? 'Extra' : 'Premium';
        const lang = (profile.language_preference || 'ja') as 'ja' | 'en' | 'ko';
        const texts = CRON_EMAIL_TEXTS[lang];

        await resend.emails.send({
          from: fromAddress,
          to: email,
          subject: texts.premiumSubject(escapeHtml(name)),
          html: buildEmailHtml({
            name,
            tier,
            analysisCount,
            matchCount: matchCountMap.get(profile.id) || 0,
            videoCount: videoCountMap.get(profile.id) || 0,
            texts,
          }),
        });

        sentCount++;
      } catch (err) {
        logger.error(`[WeeklySummary] Failed to send to ${profile.id}:`, err);
      }
    }
  }

  // --- Free user re-engagement emails ---
  let freeCount = 0;
  const { data: freeUsers } = await supabase
    .from('profiles')
    .select('id, summoner_name, weekly_analysis_count, language_preference')
    .eq('is_premium', false)
    .not('summoner_name', 'is', null);

  if (freeUsers && freeUsers.length > 0) {
    // emailMap already populated from single auth.admin.listUsers() scan above
    for (let i = 0; i < freeUsers.length; i += BATCH_SIZE) {
      const batch = freeUsers.slice(i, i + BATCH_SIZE);
      for (const profile of batch) {
        try {
          const email = emailMap.get(profile.id);
          if (!email) continue;
          const name = profile.summoner_name || 'Summoner';
          const lang = (profile.language_preference || 'ja') as 'ja' | 'en' | 'ko';
          const texts = CRON_EMAIL_TEXTS[lang];

          await resend.emails.send({
            from: fromAddress,
            to: email,
            subject: texts.freeSubject(escapeHtml(name)),
            html: buildFreeEmailHtml({ name, texts }),
          });
          freeCount++;
        } catch (err) {
          logger.error(`[WeeklySummary] Failed to send free email to ${profile.id}:`, err);
        }
      }
    }
  }

  return NextResponse.json({ sent: sentCount, freeSent: freeCount, total: (premiumUsers?.length || 0) + (freeUsers?.length || 0) });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

type CronEmailTexts = typeof CRON_EMAIL_TEXTS[keyof typeof CRON_EMAIL_TEXTS];

const CRON_EMAIL_TEXTS = {
  ja: {
    premiumSubject: (name: string) => `📊 ${name}さんの週次レポート — LoL Coach AI`,
    freeSubject: (name: string) => `🔄 ${name}さん、今週の分析枠がリセットされました — LoL Coach AI`,
    lang: 'ja',
    greeting: (name: string) => `${name}さん、お疲れさまです！`,
    summary: '今週のパフォーマンスサマリーをお届けします。',
    aiAnalysis: 'AI分析回数',
    matchAnalysis: '試合分析',
    videoAnalysis: '動画分析',
    openDashboard: 'ダッシュボードを開く →',
    premiumFooter: '© LoL Coach AI — このメールはPremium/Extra会員限定の週次レポートです。',
    freeGreeting: (name: string) => `${name}さん、今週もお疲れさまです！`,
    freeBody: '今週の無料分析枠がリセットされました。<br/>AI分析を使って試合を振り返り、ランクアップを目指しましょう！',
    freeQuotaLabel: '今週の分析枠',
    freeQuota: '3回',
    freeQuotaPer: '/ 週',
    premiumUpsell: 'Premiumなら週20回まで分析可能。動画分析・AIコーチングも使えます。',
    viewPlans: 'プランを見る →',
    freeFooter: '© LoL Coach AI — 無料ユーザー向け週次リマインドです。',
  },
  en: {
    premiumSubject: (name: string) => `📊 ${name}'s Weekly Report — LoL Coach AI`,
    freeSubject: (name: string) => `🔄 ${name}, your weekly analysis credits have been reset — LoL Coach AI`,
    lang: 'en',
    greeting: (name: string) => `Great work this week, ${name}!`,
    summary: 'Here is your weekly performance summary.',
    aiAnalysis: 'AI Analyses',
    matchAnalysis: 'Match Reviews',
    videoAnalysis: 'Video Reviews',
    openDashboard: 'Open Dashboard →',
    premiumFooter: '© LoL Coach AI — This email is for Premium/Extra members only.',
    freeGreeting: (name: string) => `Hey ${name}, great week!`,
    freeBody: 'Your free weekly analysis credits have been reset.<br/>Use AI analysis to review your matches and climb the ranks!',
    freeQuotaLabel: 'Weekly Credits',
    freeQuota: '3',
    freeQuotaPer: '/ week',
    premiumUpsell: 'With Premium, get up to 20 analyses per week. Plus video analysis & AI coaching.',
    viewPlans: 'View Plans →',
    freeFooter: '© LoL Coach AI — Weekly reminder for free users.',
  },
  ko: {
    premiumSubject: (name: string) => `📊 ${name}님의 주간 리포트 — LoL Coach AI`,
    freeSubject: (name: string) => `🔄 ${name}님, 이번 주 분석 크레딧이 초기화되었습니다 — LoL Coach AI`,
    lang: 'ko',
    greeting: (name: string) => `${name}님, 이번 주도 수고하셨습니다!`,
    summary: '이번 주 퍼포먼스 요약을 보내드립니다.',
    aiAnalysis: 'AI 분석 횟수',
    matchAnalysis: '경기 분석',
    videoAnalysis: '영상 분석',
    openDashboard: '대시보드 열기 →',
    premiumFooter: '© LoL Coach AI — Premium/Extra 회원 전용 주간 리포트입니다.',
    freeGreeting: (name: string) => `${name}님, 이번 주도 화이팅!`,
    freeBody: '이번 주 무료 분석 크레딧이 초기화되었습니다.<br/>AI 분석으로 경기를 되돌아보고 랭크업을 목표로 하세요!',
    freeQuotaLabel: '이번 주 분석 크레딧',
    freeQuota: '3회',
    freeQuotaPer: '/ 주',
    premiumUpsell: 'Premium이라면 주 20회까지 분석 가능. 영상 분석 & AI 코칭도 이용 가능합니다.',
    viewPlans: '플랜 보기 →',
    freeFooter: '© LoL Coach AI — 무료 사용자를 위한 주간 알림입니다.',
  },
} as const;

function buildEmailHtml(data: {
  name: string;
  tier: string;
  analysisCount: number;
  matchCount: number;
  videoCount: number;
  texts: CronEmailTexts;
}) {
  const { analysisCount, matchCount, videoCount, texts } = data;
  const name = escapeHtml(data.name);
  const tier = escapeHtml(data.tier);

  return `
<!DOCTYPE html>
<html lang="${texts.lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:24px;font-weight:900;font-style:italic;letter-spacing:-0.05em;margin:0;">
        LoL<span style="color:#3b82f6;">Coach</span>AI
      </h1>
      <p style="color:#94a3b8;font-size:13px;margin-top:4px;">Weekly Performance Report</p>
    </div>

    <!-- Greeting -->
    <div style="background:linear-gradient(135deg,#1e1b4b20,#312e8120);border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:16px;">
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px 0;">
        ${texts.greeting(name)}
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0;">
        ${texts.summary}
      </p>
      <span style="display:inline-block;margin-top:8px;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#f59e0b;background:#f59e0b20;border:1px solid #f59e0b30;">
        ${tier} Member
      </span>
    </div>

    <!-- Stats Grid -->
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;text-align:center;">
        <div style="color:#22d3ee;font-size:32px;font-weight:900;">${analysisCount}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${texts.aiAnalysis}</div>
      </div>
      <div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;text-align:center;">
        <div style="color:#a78bfa;font-size:32px;font-weight:900;">${matchCount}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${texts.matchAnalysis}</div>
      </div>
      <div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;text-align:center;">
        <div style="color:#34d399;font-size:32px;font-weight:900;">${videoCount}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${texts.videoAnalysis}</div>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://lolcoachai.com/dashboard" style="display:inline-block;padding:12px 32px;background:linear-gradient(90deg,#2563eb,#06b6d4);color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;">
        ${texts.openDashboard}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;border-top:1px solid #1e293b;padding-top:24px;margin-top:32px;">
      <p style="color:#475569;font-size:11px;margin:0;">
        ${texts.premiumFooter}
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildFreeEmailHtml(data: { name: string; texts: CronEmailTexts }) {
  const name = escapeHtml(data.name);
  const { texts } = data;

  return `
<!DOCTYPE html>
<html lang="${texts.lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:24px;font-weight:900;font-style:italic;letter-spacing:-0.05em;margin:0;">
        LoL<span style="color:#3b82f6;">Coach</span>AI
      </h1>
    </div>

    <!-- Greeting -->
    <div style="background:linear-gradient(135deg,#1e1b4b20,#312e8120);border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:16px;">
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px 0;">
        ${texts.freeGreeting(name)}
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0;">
        ${texts.freeBody}
      </p>
    </div>

    <!-- Free tier info -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="color:#22d3ee;font-size:14px;font-weight:700;margin-bottom:8px;">${texts.freeQuotaLabel}</div>
      <div style="color:#fff;font-size:28px;font-weight:900;">${texts.freeQuota} <span style="color:#94a3b8;font-size:14px;font-weight:400;">${texts.freeQuotaPer}</span></div>
    </div>

    <!-- Premium upsell -->
    <div style="background:linear-gradient(135deg,#1e3a5f20,#1e1b4b20);border:1px solid #3b82f640;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="color:#f59e0b;font-size:13px;font-weight:700;margin-bottom:4px;">Premium</div>
      <p style="color:#cbd5e1;font-size:13px;margin:0 0 12px 0;">
        ${texts.premiumUpsell}
      </p>
      <a href="https://lolcoachai.com/pricing" style="display:inline-block;padding:10px 24px;background:linear-gradient(90deg,#2563eb,#06b6d4);color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:13px;">
        ${texts.viewPlans}
      </a>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="https://lolcoachai.com/dashboard" style="display:inline-block;padding:12px 32px;background:#1e293b;color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px;border:1px solid #334155;">
        ${texts.openDashboard}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;border-top:1px solid #1e293b;padding-top:24px;margin-top:32px;">
      <p style="color:#475569;font-size:11px;margin:0;">
        ${texts.freeFooter}
      </p>
    </div>
  </div>
</body>
</html>`;
}
