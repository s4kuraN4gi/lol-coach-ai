import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { TRIAL_EMAIL_TEXTS, DUNNING_EMAIL_TEXTS, WINBACK_EMAIL_TEXTS } from '@/lib/email/texts';
import { buildTrialReminderHtml, buildDunningEmailHtml, buildWinbackEmailHtml } from '@/lib/email/templates';

/** Determine Extra vs Premium tier from the Stripe Price ID */
function determineTier(subscribedPriceId: string | undefined): 'extra' | 'premium' {
    const extraPriceIds = [
        process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID,
        process.env.NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID,
    ].filter(Boolean);
    return extraPriceIds.includes(subscribedPriceId ?? '') ? 'extra' : 'premium';
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabase: SupabaseClient) {
    if (!session.subscription) return;

    const userId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!userId) {
        logger.error("[Webhook] Missing userId in session client_reference_id");
        return;
    }

    const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

    if (selectError || !existingProfile) {
        logger.error(`[Webhook] User not found in profiles: ${userId}`);
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = (subscription.items?.data?.[0] as any)?.current_period_end as number | undefined
        ?? (subscription as any).current_period_end as number | undefined;

    let subscriptionEndDate: string | null = null;
    if (periodEnd && typeof periodEnd === 'number') {
        subscriptionEndDate = new Date(periodEnd * 1000).toISOString();
    }

    const subscribedPriceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionTier = determineTier(subscribedPriceId);

    const updateData = {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: subscriptionEndDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    const { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

    if (error) {
        logger.error(`[Webhook] DB Update Failed for checkout session`);
    } else if (!updatedData || updatedData.length === 0) {
        logger.error(`[Webhook] DB Update returned no data - possible RLS issue`);
    }

    // Reward referrer (non-critical, with retry)
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { error: referralError } = await supabase.rpc('reward_referral', { p_referred_user_id: userId });
            if (!referralError) break;
            logger.warn(`[Webhook] Referral reward attempt ${attempt + 1} failed`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } catch {
            logger.warn(`[Webhook] Referral reward attempt ${attempt + 1} exception`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }

    // Cancel old subscription if plan switch
    const oldSubscriptionId = session.metadata?.oldSubscriptionId;
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
        try {
            await stripe.subscriptions.cancel(oldSubscriptionId);
        } catch (cancelErr) {
            logger.error(`[Webhook] Failed to cancel old subscription`);
        }
    }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: SupabaseClient) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single();

    if (!profile) {
        logger.warn(`[Webhook] No profile found for customer: ${subscription.customer}`);
        return;
    }

    const periodEnd = (subscription.items?.data?.[0] as any)?.current_period_end
        ?? (subscription as any).current_period_end;

    let endDate = null;
    if (periodEnd) {
        endDate = new Date(periodEnd * 1000).toISOString();
    }

    const subscribedPriceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionTier = determineTier(subscribedPriceId);

    const updateData = {
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: endDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', profile.id);
    if (error) logger.error(`[Webhook] Subscription update failed`);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: SupabaseClient) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, summoner_name, language_preference')
        .eq('stripe_customer_id', subscription.customer)
        .single();

    if (!profile) return;

    await supabase.from('profiles').update({
        subscription_status: 'canceled',
        is_premium: false,
        subscription_tier: 'free',
        subscription_end_date: null,
        auto_renew: false,
    }).eq('id', profile.id);

    // Send Win-back email
    try {
        if (!process.env.RESEND_API_KEY) return;

        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        if (!authUser?.user?.email) return;

        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromAddress = process.env.EMAIL_FROM || 'LoL Coach AI <noreply@lolcoachai.com>';
        const name = profile.summoner_name || 'Summoner';
        const lang = (profile.language_preference || 'ja') as 'ja' | 'en' | 'ko';
        const texts = WINBACK_EMAIL_TEXTS[lang];

        await resend.emails.send({
            from: fromAddress,
            to: authUser.user.email,
            subject: texts.subject,
            html: buildWinbackEmailHtml({ name, texts }),
        });
    } catch (err) {
        logger.error("[Webhook] Win-back email send failed");
    }
}

export async function handleTrialWillEnd(subscription: Stripe.Subscription, supabase: SupabaseClient) {
    const customerId = subscription.customer as string;
    if (!customerId) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, summoner_name, language_preference')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!profile) {
        logger.warn(`[Webhook] No profile found for customer: ${customerId}`);
        return;
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
    if (authError || !authUser?.user?.email) {
        logger.warn(`[Webhook] Could not get email for user: ${profile.id}`);
        return;
    }

    if (!process.env.RESEND_API_KEY) {
        logger.warn('[Webhook] RESEND_API_KEY not configured, skipping trial reminder email');
        return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.EMAIL_FROM || 'LoL Coach AI <noreply@lolcoachai.com>';
    const name = profile.summoner_name || 'Summoner';
    const lang = (profile.language_preference || 'ja') as 'ja' | 'en' | 'ko';
    const localeMap: Record<string, string> = { ja: 'ja-JP', en: 'en-US', ko: 'ko-KR' };
    const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toLocaleDateString(localeMap[lang] || 'ja-JP')
        : TRIAL_EMAIL_TEXTS[lang].soon;

    const texts = TRIAL_EMAIL_TEXTS[lang];

    try {
        await resend.emails.send({
            from: fromAddress,
            to: authUser.user.email,
            subject: texts.subject,
            html: buildTrialReminderHtml({ name, trialEnd, texts }),
        });
    } catch (emailErr) {
        logger.error(`[Webhook] Trial reminder email send failed`);
    }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, supabase: SupabaseClient) {
    const customerId = invoice.customer as string;
    if (!customerId) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, subscription_status, summoner_name, language_preference')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!profile) {
        logger.warn(`[Webhook] No profile found for customer: ${customerId}`);
        return;
    }

    await supabase.from('profiles').update({
        subscription_status: 'past_due',
        auto_renew: false,
    }).eq('id', profile.id);

    // Send dunning email
    try {
        if (!process.env.RESEND_API_KEY) return;

        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        if (!authUser?.user?.email) return;

        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromAddress = process.env.EMAIL_FROM || 'LoL Coach AI <noreply@lolcoachai.com>';
        const name = profile.summoner_name || 'Summoner';
        const lang = (profile.language_preference || 'ja') as 'ja' | 'en' | 'ko';
        const texts = DUNNING_EMAIL_TEXTS[lang];

        await resend.emails.send({
            from: fromAddress,
            to: authUser.user.email,
            subject: texts.subject,
            html: buildDunningEmailHtml({ name, texts }),
        });
    } catch (err) {
        logger.error("[Webhook] Dunning email send failed");
    }
}
