"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { getWeeklyLimit, EXTRA_WEEKLY_ANALYSIS_LIMIT, type AnalysisStatus } from "../constants";
import { refreshAnalysisStatus } from "./status";

// プレミアムプランの自動更新停止（解約予約）
export async function downgradeToFree() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // 即時解約ではなく、自動更新をOFFにするだけ
  const { error } = await supabase.rpc('downgrade_to_free', {
    p_user_id: user.id,
  });

  if (error) return { error: "Failed to cancel subscription" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// 1日1回の広告リワード（クレジット付与）— アトミックRPC版
export async function claimDailyReward() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: newCredits, error } = await supabase.rpc('claim_daily_reward', {
    p_user_id: user.id,
  });

  if (error) return { error: "Failed to claim reward." };
  if (newCredits === -1) return { error: "Already claimed today." };

  revalidatePath("/dashboard", "layout");
  return { success: true, newCredits };
}

// 強制的にStripeの最新ステータスと同期する
// カスタマーの全アクティブサブスクリプションを確認し、最上位tierを適用
export async function syncSubscriptionStatus() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, stripe_customer_id, subscription_tier")
    .eq("id", user.id)
    .single();

  try {
      const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;

      // If no customer ID in DB, search Stripe by email to find the customer
      let customerId = profile?.stripe_customer_id;
      if (!customerId && user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      if (!customerId && !profile?.stripe_subscription_id) {
        return { error: "No subscription info found" };
      }

      let bestSubscription: Stripe.Subscription | null = null;
      let bestTier: 'free' | 'premium' | 'extra' = 'free';

      // If customer ID exists, list all active subscriptions to find the best one
      const allActiveSubs: Stripe.Subscription[] = [];
      if (customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 10,
        });
        allActiveSubs.push(...subs.data);

        for (const sub of subs.data) {
          const priceId = sub.items.data[0]?.price?.id;
          const tier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

          // Pick the highest tier subscription (extra > premium)
          if (!bestSubscription || (tier === 'extra' && bestTier !== 'extra')) {
            bestSubscription = sub;
            bestTier = tier;
          }
        }

        // Also check trialing subscriptions
        if (!bestSubscription) {
          const trialingSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: 'trialing',
            limit: 10,
          });
          if (trialingSubs.data.length > 0) {
            allActiveSubs.push(...trialingSubs.data);
            bestSubscription = trialingSubs.data[0];
            const priceId = bestSubscription.items.data[0]?.price?.id;
            bestTier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';
          }
        }

        // Cancel duplicate subscriptions (keep only the best one)
        if (bestSubscription && allActiveSubs.length > 1) {
          for (const sub of allActiveSubs) {
            if (sub.id !== bestSubscription.id) {
              try {
                await stripe.subscriptions.cancel(sub.id);
              } catch (cancelErr) {
                logger.error("[Sync] Failed to cancel duplicate subscription");
              }
            }
          }
        }
      }

      // Fallback: use stored subscription ID directly
      if (!bestSubscription && profile?.stripe_subscription_id) {
        bestSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const priceId = bestSubscription.items.data[0]?.price?.id;
        bestTier = (EXTRA_PRICE_ID && priceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';
      }

      if (!bestSubscription) {
        return { error: "No active subscription found on Stripe" };
      }

      const periodEnd = bestSubscription.items?.data?.[0]?.current_period_end;
      let endDate = null;
      if (periodEnd) {
          try {
              endDate = new Date(periodEnd * 1000).toISOString();
          } catch (e) {
              logger.warn("Invalid date in sync:", periodEnd);
          }
      }

      const isActive = bestSubscription.status === 'active' || bestSubscription.status === 'trialing';

      const updateData: Record<string, string | boolean | null> = {
        stripe_subscription_id: bestSubscription.id,
        subscription_status: bestSubscription.status,
        is_premium: isActive,
        subscription_tier: isActive ? bestTier : 'free',
        subscription_end_date: endDate,
        auto_renew: !bestSubscription.cancel_at_period_end,
      };

      // Use RPC to update subscription fields (SECURITY DEFINER bypasses RLS)
      const { error: updateError } = await supabase.rpc('sync_subscription_status', {
        p_user_id: user.id,
        p_stripe_subscription_id: updateData.stripe_subscription_id,
        p_subscription_status: updateData.subscription_status,
        p_is_premium: updateData.is_premium,
        p_subscription_tier: updateData.subscription_tier,
        p_subscription_end_date: updateData.subscription_end_date,
        p_auto_renew: updateData.auto_renew,
        p_stripe_customer_id: (customerId && !profile?.stripe_customer_id) ? customerId : null,
      });

      if (updateError) {
        logger.error("[Sync] DB update failed:", updateError.message);
      }

      revalidatePath("/dashboard", "layout");

      return { success: !updateError, tier: updateData.subscription_tier };
  } catch (e) {
      logger.error("Sync Error:", e);
      return { error: "Subscription sync failed. Please try again later." };
  }
}

// ============================================================
// WEEKLY ANALYSIS LIMIT HELPERS
// ============================================================

/**
 * Check if user can perform analysis (within weekly limit)
 * Returns: { canAnalyze: boolean, remaining: number, resetDate: string }
 */
export async function checkWeeklyLimit(): Promise<{
    canAnalyze: boolean;
    remaining: number;
    used: number;
    limit: number;
    resetDate: string;
    isPremium: boolean;
}> {
    const status = await refreshAnalysisStatus();

    if (!status) {
        return {
            canAnalyze: false,
            remaining: 0,
            used: 0,
            limit: 0,
            resetDate: '',
            isPremium: false
        };
    }

    const limit = getWeeklyLimit(status);
    const remaining = limit - (status.weekly_analysis_count || 0);
    return {
        canAnalyze: remaining > 0,
        remaining: Math.max(0, remaining),
        used: status.weekly_analysis_count || 0,
        limit,
        resetDate: status.weekly_reset_date || '',
        isPremium: status.is_premium
    };
}

/**
 * Increment weekly analysis count for premium users
 * Or decrement credits for free users (atomic operations)
 */
export async function incrementAnalysisCount(userId: string, isPremium: boolean): Promise<boolean> {
    const supabase = await createClient();

    // Verify the caller is the actual user (prevent IDOR)
    const user = await getUser();
    if (!user || user.id !== userId) return false;

    if (isPremium) {
        // Premium user: atomic increment with limit check
        const { data, error } = await supabase.rpc('increment_weekly_count', {
            p_user_id: user.id,
            p_limit: EXTRA_WEEKLY_ANALYSIS_LIMIT
        });
        return !error && data !== -1;
    } else {
        // Free user: atomic credit decrement
        const { data, error } = await supabase.rpc('decrement_analysis_credits', {
            p_user_id: user.id
        });
        return !error && data !== -1;
    }
}
