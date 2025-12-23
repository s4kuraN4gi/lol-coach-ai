export async function triggerStripeCheckout() {
    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Price ID is handled server-side via env var, but we can pass it if we have multiple plans.
                // For now, let's keep it simple as the API route reads from ENV by default if not passed,
                // OR we pass it explicitly if we want to be safe.
                // The current API route implementation *requires* priceId in body or logic to read it.
                // Let's pass the env var here to match previous implementation.
                priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
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
