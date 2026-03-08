"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { logger } from "@/lib/logger";

export async function getReferralInfo() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  // Get referral code
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  if (!profile?.referral_code) return null;

  // Get referral stats
  const { count: totalReferrals } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", user.id);

  const { count: rewardedReferrals } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", user.id)
    .eq("status", "rewarded");

  return {
    referralCode: profile.referral_code,
    totalReferrals: totalReferrals || 0,
    rewardedReferrals: rewardedReferrals || 0,
  };
}

export async function processReferralSignup(referralCode: string) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("process_referral", {
    p_referral_code: referralCode,
    p_referred_user_id: user.id,
  });

  if (error) {
    logger.error("[Referral] process_referral error:", error);
    return { error: "REFERRAL_FAILED" };
  }
  return data as { success: boolean; error?: string };
}
