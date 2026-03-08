/**
 * Email text constants for all transactional emails (3 languages: ja/en/ko)
 */

export const TRIAL_EMAIL_TEXTS = {
    ja: {
        subject: '⏰ トライアル期間が終了します — LoL Coach AI',
        heading: (name: string) => `${name}さん、トライアル期間が終了します`,
        body: (trialEnd: string) => `ご利用中のトライアルは <strong style="color:#f59e0b;">${trialEnd}</strong> に終了します。トライアル終了後は自動的に有料プランへ移行します。`,
        cancelNote: '継続をご希望でない場合は、終了日までにアカウント設定からキャンセルしてください。',
        cta: 'アカウント設定を確認 →',
        footer: '© LoL Coach AI — トライアル終了のお知らせです。',
        soon: '間もなく',
    },
    en: {
        subject: '⏰ Your trial is ending soon — LoL Coach AI',
        heading: (name: string) => `${name}, your trial is ending soon`,
        body: (trialEnd: string) => `Your trial ends on <strong style="color:#f59e0b;">${trialEnd}</strong>. After the trial ends, your plan will automatically convert to a paid subscription.`,
        cancelNote: 'If you don\'t wish to continue, please cancel from your account settings before the trial ends.',
        cta: 'Check Account Settings →',
        footer: '© LoL Coach AI — Trial ending reminder.',
        soon: 'soon',
    },
    ko: {
        subject: '⏰ 체험판이 곧 종료됩니다 — LoL Coach AI',
        heading: (name: string) => `${name}님, 체험판이 곧 종료됩니다`,
        body: (trialEnd: string) => `이용 중인 체험판은 <strong style="color:#f59e0b;">${trialEnd}</strong>에 종료됩니다. 체험판 종료 후 자동으로 유료 플랜으로 전환됩니다.`,
        cancelNote: '계속 이용을 원하지 않으시면 종료일까지 계정 설정에서 취소해 주세요.',
        cta: '계정 설정 확인 →',
        footer: '© LoL Coach AI — 체험판 종료 안내입니다.',
        soon: '곧',
    },
} as const;

export const DUNNING_EMAIL_TEXTS = {
    ja: {
        subject: '⚠️ お支払いに失敗しました — LoL Coach AI',
        heading: (name: string) => `${name}さん、お支払いに問題がありました`,
        body: 'ご登録のお支払い方法での決済に失敗しました。サービスの継続利用には、お支払い情報の更新をお願いいたします。',
        updateCta: 'お支払い情報を更新',
        note: 'お支払いが確認できない場合、プレミアム機能が制限される場合があります。',
        footer: '© LoL Coach AI — お支払い情報更新のご案内です。',
    },
    en: {
        subject: '⚠️ Payment Failed — LoL Coach AI',
        heading: (name: string) => `${name}, your payment could not be processed`,
        body: 'We were unable to process your payment. Please update your payment method to continue using premium features.',
        updateCta: 'Update Payment Method',
        note: 'If payment is not resolved, your premium features may be restricted.',
        footer: '© LoL Coach AI — Payment update notification.',
    },
    ko: {
        subject: '⚠️ 결제에 실패했습니다 — LoL Coach AI',
        heading: (name: string) => `${name}님, 결제에 문제가 발생했습니다`,
        body: '등록된 결제 수단으로 결제에 실패했습니다. 서비스를 계속 이용하시려면 결제 정보를 업데이트해 주세요.',
        updateCta: '결제 정보 업데이트',
        note: '결제가 확인되지 않으면 프리미엄 기능이 제한될 수 있습니다.',
        footer: '© LoL Coach AI — 결제 정보 업데이트 안내입니다.',
    },
} as const;

export const WINBACK_EMAIL_TEXTS = {
    ja: {
        subject: '💙 またお会いできることを願っています — LoL Coach AI',
        heading: (name: string) => `${name}さん、ご利用ありがとうございました`,
        body: 'サブスクリプションが解約されました。AIコーチングや詳細分析など、プレミアム機能がご利用いただけなくなります。',
        benefit: 'いつでもプランを再開して、AIによるゲーム分析を再びご活用いただけます。',
        cta: 'プランを確認する →',
        footer: '© LoL Coach AI — サブスクリプション解約のお知らせです。',
    },
    en: {
        subject: '💙 We hope to see you again — LoL Coach AI',
        heading: (name: string) => `${name}, thank you for being a subscriber`,
        body: 'Your subscription has been canceled. You will no longer have access to premium features like AI coaching and detailed analysis.',
        benefit: 'You can resubscribe anytime to unlock AI-powered game analysis again.',
        cta: 'View Plans →',
        footer: '© LoL Coach AI — Subscription cancellation notice.',
    },
    ko: {
        subject: '💙 다시 만나뵙기를 바랍니다 — LoL Coach AI',
        heading: (name: string) => `${name}님, 이용해 주셔서 감사합니다`,
        body: '구독이 해지되었습니다. AI 코칭 및 상세 분석 등 프리미엄 기능을 더 이상 이용하실 수 없습니다.',
        benefit: '언제든지 플랜을 재개하여 AI 게임 분석을 다시 활용하실 수 있습니다.',
        cta: '플랜 확인하기 →',
        footer: '© LoL Coach AI — 구독 해지 안내입니다.',
    },
} as const;
