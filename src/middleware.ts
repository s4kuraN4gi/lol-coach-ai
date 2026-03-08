import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

// --- Distributed rate limiter via Supabase RPC ---
// Works across Vercel serverless instances (replaces in-memory Map)
async function isRateLimited(ip: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return true // fail-closed: block when env is missing

  try {
    const res = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ p_ip: ip, p_max_attempts: 10, p_window_seconds: 60 }),
    })

    if (!res.ok) return true // fail-closed: block when RPC fails
    return (await res.json()) === true
  } catch {
    return true // fail-closed: block when DB is unreachable
  }
}

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'
  const supabaseHost = supabaseUrl.replace('https://', '')
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  const sentryOrigin = sentryDsn
    ? `https://${new URL(sentryDsn).hostname}`
    : 'https://*.sentry.io'

  const directives = [
    "default-src 'self'",
    // nonce-based: 'unsafe-inline' is a fallback for CSP1 browsers (ignored when nonce is present in CSP2+)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://pagead2.googlesyndication.com https://challenges.cloudflare.com ${sentryOrigin}`,
    // CSP3 split: <style> tags require nonce, inline style="" attrs allowed (required by React/Framer Motion)
    // style-src with nonce as CSP2 fallback (CSP3 browsers use style-src-elem/attr instead)
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: https://ddragon.leagueoflegends.com https://raw.communitydragon.org ${supabaseUrl}`,
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} wss://${supabaseHost} https://api.stripe.com https://pagead2.googlesyndication.com https://challenges.cloudflare.com ${sentryOrigin}`,
    "frame-src https://js.stripe.com https://accounts.google.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]

  return directives.join('; ')
}

export async function middleware(request: NextRequest) {
  // Rate limit auth endpoints (login, signup, reset-password)
  const pathname = request.nextUrl.pathname
  const isAuthEndpoint = pathname === '/login' || pathname === '/signup' || pathname === '/reset-password'
  if (isAuthEndpoint && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('cf-connecting-ip')
      || 'unknown'
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Pass nonce via request header so server components can read it via headers()
  const response = await updateSession(request, { 'x-nonce': nonce })

  // Set CSP header on response for browser enforcement
  response.headers.set('Content-Security-Policy', buildCSP(nonce))

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/webhooks (webhook endpoints — they verify signatures, not sessions)
     * - public files (files ending in .svg, .png, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
