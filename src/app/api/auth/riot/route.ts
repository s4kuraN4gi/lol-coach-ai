import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const RSO_CLIENT_ID = process.env.RIOT_RSO_CLIENT_ID;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/riot`
    : "http://localhost:3000/api/auth/callback/riot";

  if (!RSO_CLIENT_ID) {
    return NextResponse.json({ error: "RSO Config Missing" }, { status: 500 });
  }

  const authorizedUrl = new URL("https://auth.riotgames.com/authorize");
  authorizedUrl.searchParams.append("client_id", RSO_CLIENT_ID);
  authorizedUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authorizedUrl.searchParams.append("response_type", "code");
  authorizedUrl.searchParams.append("scope", "openid offline_access");

  return NextResponse.redirect(authorizedUrl.toString());
}
