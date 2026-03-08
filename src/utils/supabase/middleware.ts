import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>,
) {
  // Merge extra headers (e.g. x-nonce) so server components can read them via headers()
  const requestHeaders = new Headers(request.headers)
  if (extraRequestHeaders) {
    for (const [key, value] of Object.entries(extraRequestHeaders)) {
      requestHeaders.set(key, value)
    }
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Create a Supabase client that uses the request cookies for auth
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
    }
  )

  // Check for the user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ROUTE PROTECTION LOGIC

  // Protected routes that require authentication
  const protectedPaths = ['/dashboard', '/api/chat', '/api/checkout', '/api/billing']
  const isProtectedRoute = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (!user && isProtectedRoute) {
    // API routes return 401 JSON, page routes redirect to login
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. If user IS logged in and tries to access /login, redirect to /dashboard
  // if (user && request.nextUrl.pathname.startsWith('/login')) {
  //    const url = request.nextUrl.clone()
  //    url.pathname = '/dashboard'
  //    return NextResponse.redirect(url)
  // }

  return supabaseResponse
}
