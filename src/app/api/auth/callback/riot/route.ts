import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  const RSO_CLIENT_ID = process.env.RIOT_RSO_CLIENT_ID;
  const RSO_CLIENT_SECRET = process.env.RIOT_RSO_CLIENT_SECRET;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/riot`
    : "http://localhost:3000/api/auth/callback/riot";

  if (!RSO_CLIENT_ID || !RSO_CLIENT_SECRET) {
    return NextResponse.json({ error: "RSO Config Missing" }, { status: 500 });
  }

  try {
    // 1. Exchange Code for Tokens
    const tokenRes = await fetch("https://auth.riotgames.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(RSO_CLIENT_ID + ":" + RSO_CLIENT_SECRET).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
        throw new Error("Failed to exchange token: " + await tokenRes.text());
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    // const refreshToken = tokens.refresh_token; 
    // const idToken = tokens.id_token; // Contains sub (puuid)

    // 2. Fetch User Info (Account-v1) allows fetching by access token usually, but RSO has a specific UserInfo endpoint
    // Actually, RSO standard is: https://auth.riotgames.com/userinfo
    const userInfoRes = await fetch("https://auth.riotgames.com/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if(!userInfoRes.ok) {
        throw new Error("Failed to fetch user info: " + await userInfoRes.text());
    }

    const userInfo = await userInfoRes.json();
    // userInfo contains: sub (puuid), jti, etc. 
    // It DOES NOT contain GameName/TagLine usually unless specific scopes are used or we call AccountAPI.
    // However, with RSO, we trust the 'sub'.
    // We need to fetch the GameName/TagLine from Account-V1 API using the access token or PUUID.
    // Actually, let's use the standard Riot API with our API Key using the PUUID (sub).
    
    const puuid = userInfo.sub;
    const RIOT_API_KEY = process.env.RIOT_API_KEY!;
    
    // Fetch Account Data to get Name#Tag
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`, {
        headers: { "X-Riot-Token": RIOT_API_KEY }
    });
    if(!accountRes.ok) {
         throw new Error("Failed to fetch account data from Riot API");
    }
    const accountData = await accountRes.json();
    const gameName = accountData.gameName;
    const tagLine = accountData.tagLine;

    // 3. Supabase Integration
    const supabase = await createClient();
    
    // Check if user exists by tracking a metadata field or specific table.
    // Ideally we linked RSO PUUID to auth.users. 
    // For now, simpler approach:
    // We will generate a consistent email for RSO users OR allow them to be new users.
    // Easiest for now: Create a user if not exists based on PUUID (rso_<puuid>@lolcoach.ai)
    
    const rsoEmail = `rso_${puuid}@lolcoach.ai`;
    // Secure random password (they won't use it)
    const dummyPassword = Buffer.from(puuid + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toString('base64'); 

    // Try to sign in or sign up
    // Ideally we use admin client to get user by metadata, but we only have anon/cookie client usually in route handlers unless we use service role.
    // We will create a fresh Client with Service Role for Admin ops to ensure we can Find-Or-Create.
    // NOTE: Using Service Role here requires SUPABASE_SERVICE_ROLE_KEY env var.
    
    // Fallback: Since we might not have Service Key ready in env, we can use the client-side flow? No, must be server.
    // Let's assume we use the standard auth.signInWithPassword if they exist? No password is unknown if we just made it.
    
    // Let's rely on Supabase Auth Admin.
    // We need 'supabase-js' import for admin if 'utils/supabase/server' doesn't export admin.
    // If we cannot perform Admin ops, this approach is tricky.
    // ALTERNATIVE: Use the manual 'signInWithOtp' or just create a session?
    // Supabase can issue a session if we have the secret.
    
    // Let's try to verify if we can access the Service Role.
    // If not, we might need the user to set it.
    
    // SIMPLIFIED APPROACH for MVP:
    // We are trusting the RSO. We want to log them in.
    // If we can't create a session easily, we might need to guide them to "Link Account" page? 
    // No, "Sign in with Riot" implies auto-login.
    
    // We'll create a user with a deterministic email/pass.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: rsoEmail,
        password: dummyPassword
    });

    let session = signInData.session;

    if (signInError) {
        // Assume user doesn't exist, try to sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: rsoEmail,
            password: dummyPassword,
            options: {
                data: {
                    rso_puuid: puuid,
                    full_name: `${gameName}#${tagLine}`
                }
            }
        });
        
        if(signUpError) {
             throw new Error("Supabase SignUp Failed: " + signUpError.message);
        }
        session = signUpData.session;
    }

    if(!session) {
        return NextResponse.redirect(new URL("/login?error=session_creation_failed", request.url));
    }

    // 4. Update Summoners Table (Auto-Link)
    // Now that we have a session, we can write to the DB as the user (RLS permits it usually).
    // Or we stick to the Service Key if available.
    // Let's try standard client with the new session.
    
    // Re-create client with new session if needed, but `signInWithPassword` sets the cookie on the response usually? 
    // Wait, route handlers don't automatically set cookies on the `response` object unless we manipulate it.
    // `utils/supabase/server.ts` usually handles cookies -> request/response.
    
    // IMPORTANT: In Next.js Route Handlers, `supabase.auth.signInWithPassword` updates the cookies on the `supabase` instance,
    // but we need to ensure those cookies are passed to the browser.
    // The `createClient` in server.ts usually uses `cookies()` from `next/headers`. 
    // Setting cookies there works for Server Actions, but in Route Handlers we often need to be careful.
    // However, if we utilize the default `utils/supabase/server`, it should work if we await the response.
    
    // Actually, `signInWithPassword` returns a session. We might need to manually set the cookies if the standard util doesn't auto-flush to response.
    // But typically `createClient` with `cookieStore` works.
    
    // Let's update the Profile/Summoner Data.
    const userId = session.user.id;
    
    // Check if summoner exists
    const { data: existingSummoner } = await supabase
        .from('summoners')
        .select('*')
        .eq('puuid', puuid)
        .single();
        
    if (existingSummoner) {
        // Ensure it's linked to this user (might be a re-login or takeover)
        if(existingSummoner.user_id !== userId) {
            // Update owner
             await supabase.from('summoners').update({ user_id: userId }).eq('puuid', puuid);
        }
    } else {
        // Create new summoner entry
        // We need profileIconId etc to be perfect. 
        // We fetched minimal account data. We might want SummonerV4 data for icon/level.
        const summonerRes = await fetch(`https://jp1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
            headers: { "X-Riot-Token": RIOT_API_KEY }
        });
        if(summonerRes.ok) {
            const sumData = await summonerRes.json();
            await supabase.from('summoners').insert({
                user_id: userId,
                puuid: puuid,
                summoner_id: sumData.id,
                account_id: sumData.accountId,
                name: gameName,
                tag_line: tagLine,
                profile_icon_id: sumData.profileIconId,
                summoner_level: sumData.summonerLevel,
                region: 'jp1' // Fixed for now based on user context
            });
        }
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));

  } catch (error) {
    console.error("RSO Error:", error);
    return NextResponse.redirect(new URL(`/login?error=rso_failed&details=${encodeURIComponent(String(error))}`, request.url));
  }
}
