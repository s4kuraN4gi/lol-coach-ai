import { toast } from "sonner";

type TranslationFn = (key: string, fallback?: string) => string;

export async function triggerStripeCheckout(tier: 'premium' | 'extra' = 'premium', t?: TranslationFn, billing: 'monthly' | 'annual' = 'monthly') {
    try {
        let priceId: string | undefined;
        if (tier === 'extra') {
            priceId = billing === 'annual'
                ? process.env.NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID
                : process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
        } else {
            priceId = billing === 'annual'
                ? process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID
                : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
        }

        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId,
            }),
        });

        if (!response.ok) {
            toast.error(t?.('checkoutErrors.failed', 'Checkout failed. Please try again.') ?? 'Checkout failed. Please try again.');
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
            toast.error(t?.('checkoutErrors.failed', 'Checkout failed. Please try again.') ?? 'Checkout failed. Please try again.');
        }
    } catch {
        toast.error(t?.('checkoutErrors.error', 'An error occurred. Please try again.') ?? 'An error occurred. Please try again.');
    }
}

export async function triggerStripePortal(t?: TranslationFn) {
    try {
        const response = await fetch('/api/billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            toast.error(t?.('checkoutErrors.portalFailed', 'Failed to open billing portal.') ?? 'Failed to open billing portal.');
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
            toast.error(t?.('checkoutErrors.portalFailed', 'Failed to open billing portal.') ?? 'Failed to open billing portal.');
        }
    } catch {
        toast.error(t?.('checkoutErrors.error', 'An error occurred. Please try again.') ?? 'An error occurred. Please try again.');
    }
}
