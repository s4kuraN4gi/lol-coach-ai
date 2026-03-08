"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

async function checkServerActionRateLimit(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return true; // fail-closed

  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headerStore.get('cf-connecting-ip')
    || 'unknown';

  try {
    const res = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ p_ip: ip, p_max_attempts: 10, p_window_seconds: 60 }),
    });
    if (!res.ok) return true; // fail-closed
    return (await res.json()) === true;
  } catch {
    return true; // fail-closed
  }
}

export async function loginWithPassword(email: string, password: string): Promise<{ error?: string }> {
  // Server Action rate limiting (bypasses middleware)
  if (await checkServerActionRateLimit()) {
    return { error: 'RATE_LIMITED' };
  }

  // Pre-check: block RSO synthetic emails before attempting sign-in
  if (email.trim().toLowerCase().endsWith('@lolcoach.ai')) {
    return { error: 'RSO_BLOCKED' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { error: 'INVALID_CREDENTIALS' };
  }

  // Atomic server-side check: if RSO user somehow bypassed the email check, revoke immediately
  if (data.user?.app_metadata?.auth_method === 'rso') {
    await supabase.auth.signOut();
    return { error: 'RSO_BLOCKED' };
  }

  // Check email verification
  if (data.user && !data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return { error: 'EMAIL_NOT_VERIFIED' };
  }

  return {};
}
