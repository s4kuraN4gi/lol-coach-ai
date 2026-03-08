import { logger } from "@/lib/logger";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if verification passes or if Turnstile is not configured (graceful degradation).
 */
export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  // Fail-closed: reject all requests if Turnstile is not configured
  if (!TURNSTILE_SECRET_KEY) {
    logger.error("[Turnstile] TURNSTILE_SECRET_KEY not configured. Rejecting request.");
    return false;
  }
  if (!token) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    logger.error("[Turnstile] Verification request failed");
    // Fail-closed: if verification request fails or times out, reject
    return false;
  }
}
