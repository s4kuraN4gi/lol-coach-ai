import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const RSO_CLIENT_ID = process.env.RIOT_RSO_CLIENT_ID;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/riot`
    : "http://localhost:3000/api/auth/callback/riot";

  if (!RSO_CLIENT_ID) {
    return NextResponse.json({ error: "RSO Config Missing" }, { status: 500 });
  }

  // Generate CSRF state token
  const state = randomBytes(32).toString('hex');

  const authorizedUrl = new URL("https://auth.riotgames.com/authorize");
  authorizedUrl.searchParams.append("client_id", RSO_CLIENT_ID);
  authorizedUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authorizedUrl.searchParams.append("response_type", "code");
  authorizedUrl.searchParams.append("scope", "openid offline_access");
  authorizedUrl.searchParams.append("state", state);

  const response = NextResponse.redirect(authorizedUrl.toString());

  // Store state in HttpOnly cookie for validation in callback
  response.cookies.set("rso_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
