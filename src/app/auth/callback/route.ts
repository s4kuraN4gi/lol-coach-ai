import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Validate "next" param to prevent open redirect (block protocol-relative, backslash, and non-path URLs)
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = /^\/[a-zA-Z0-9\-_/?.=#&%]+$/.test(nextParam) ? nextParam : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // Whitelist check to prevent open redirect via x-forwarded-host spoofing
        const allowedHosts = [
          'lolcoachai.com',
          'www.lolcoachai.com',
          new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://lolcoachai.com').host,
        ]
        if (allowedHosts.includes(forwardedHost)) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        }
        // Untrusted host — fall back to origin
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
