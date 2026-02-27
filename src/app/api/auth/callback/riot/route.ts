import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  // CSRF validation: verify state parameter matches the cookie
  const storedState = request.cookies.get("rso_state")?.value;
  if (!stateParam || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(new URL("/login?error=csrf_validation_failed", request.url));
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

    // 3. Supabase Integration — use Service Role for admin user management
    const supabase = await createClient();
    const adminClient = createServiceRoleClient();

    const rsoEmail = `rso_${puuid}@lolcoach.ai`;
    let userId: string;

    // Generate a cryptographically secure random password for new/reset users
    const securePassword = randomBytes(32).toString('base64url');

    // Try to create the user first (will fail if already exists)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: rsoEmail,
        password: securePassword,
        email_confirm: true,
        user_metadata: {
            rso_puuid: puuid,
            full_name: `${gameName}#${tagLine}`,
        },
    });

    if (!createError && newUser.user) {
        // New user created — sign in with the new credentials
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: rsoEmail,
            password: securePassword,
        });
        if (signInError) {
            throw new Error("Failed to sign in newly created RSO user");
        }
        userId = newUser.user.id;
    } else {
        // User already exists — reset password and sign in
        // Find the existing user by email
        const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1 });
        // listUsers doesn't filter by email, so use a workaround: update by looking up via profiles
        // Actually, we can just reset their password and sign in
        const { data: profileData } = await adminClient
            .from('profiles')
            .select('id')
            .eq('email', rsoEmail)
            .single();

        // If we can't find by profiles, try signInWithPassword with a reset approach
        // The most reliable approach: reset password via admin, then sign in
        if (profileData) {
            await adminClient.auth.admin.updateUserById(profileData.id, {
                password: securePassword,
            });
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: rsoEmail,
                password: securePassword,
            });
            if (signInError) {
                throw new Error("Failed to authenticate existing RSO user");
            }
            userId = profileData.id;
        } else {
            // Fallback: try generateLink for magic link
            const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
                type: 'magiclink',
                email: rsoEmail,
            });
            if (linkError || !linkData.user) {
                throw new Error("Failed to generate magic link for RSO user");
            }
            // Use the token from generateLink to verify OTP and create session
            const token = linkData.properties?.hashed_token;
            if (token) {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                    type: 'email',
                    token_hash: token,
                });
                if (verifyError) {
                    throw new Error("Failed to verify RSO user session");
                }
            }
            userId = linkData.user.id;
        }
    }
    
    // Check if summoner exists (use adminClient to bypass RLS)
    const { data: existingSummoner } = await adminClient
        .from('summoners')
        .select('*')
        .eq('puuid', puuid)
        .single();

    if (existingSummoner) {
        // Ensure it's linked to this user (might be a re-login or takeover)
        if(existingSummoner.user_id !== userId) {
             await adminClient.from('summoners').update({ user_id: userId }).eq('puuid', puuid);
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
            await adminClient.from('summoners').insert({
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

    // Redirect to dashboard (clear state cookie)
    const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
    redirectResponse.cookies.delete("rso_state");
    return redirectResponse;

  } catch (error) {
    console.error("RSO Error:", error);
    const errorResponse = NextResponse.redirect(new URL("/login?error=rso_failed", request.url));
    errorResponse.cookies.delete("rso_state");
    return errorResponse;
  }
}
