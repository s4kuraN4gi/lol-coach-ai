import { toast } from "sonner";

export async function triggerStripeCheckout(tier: 'premium' | 'extra' = 'premium') {
    try {
        const priceId = tier === 'extra'
            ? process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID
            : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

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
            console.error('Checkout error:', response.statusText);
            toast.error('Checkout failed. Please try again.');
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
             console.error('No checkout URL returned');
             toast.error('Checkout failed. Please try again.');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        toast.error('An error occurred. Please try again.');
    }
}

export async function triggerStripePortal() {
    try {
        const response = await fetch('/api/billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Portal error:', response.statusText, errText);
            toast.error('Failed to open billing portal.');
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
             console.error('No portal URL returned');
             toast.error('Failed to open billing portal.');
        }
    } catch (error) {
        console.error('Portal error:', error);
        toast.error('An error occurred. Please try again.');
    }
}
