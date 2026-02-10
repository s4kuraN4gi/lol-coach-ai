export async function triggerStripeCheckout(tier: 'premium' | 'extra' = 'premium') {
    try {
        const priceId = tier === 'extra'
            ? process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID
            : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

        console.log(`[CheckoutClient] tier=${tier}, priceId=${priceId}, envExtra=${process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID}, envPremium=${process.env.NEXT_PUBLIC_STRIPE_PRICE_ID}`);

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
            alert('決済の開始に失敗しました。');
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
             console.error('No checkout URL returned');
             alert('決済URLの取得に失敗しました。');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('エラーが発生しました。');
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
            alert(`ポータルの起動に失敗しました: ${errText}`);
            return;
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
             console.error('No portal URL returned');
             alert('ポータルURLの取得に失敗しました。');
        }
    } catch (error) {
        console.error('Portal error:', error);
        alert('エラーが発生しました。');
    }
}
