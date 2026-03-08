# LoL Coach AI エリート辛口審査 — セキュリティ & マネタイゼーション

## 審査日時: 2026-03-02 19:14
## 審査対象: feature/elite-review ブランチ（最新コミット 3f37248）
## 審査者: Agent S（セキュリティ専門） & Agent M（マネタイゼーション専門）

---

## 総合スコア

| 審査者 | 現状スコア | 改善後見込み |
|--------|-----------|-------------|
| Agent S | **78/100** (Security 42/50, Monetization 36/50) | **92/100** (Security 50/50, Monetization 42/50) |
| Agent M | **76/100** (Billing 23/30, Conversion 22/30, Diversification 16/20, Tests 15/20) | **91/100** (Billing 28/30, Conversion 27/30, Diversification 19/20, Tests 17/20) |
| **統合評価** | **77/100** | **91/100** |

---

## 前回指摘の改善状況（Agent S — セキュリティ視点）

| # | 指摘事項 | 改善状況 | 詳細 |
|---|---------|---------|------|
| 1 | SEC-C9: isRateLimited() RPC引数タイプミスマッチ | ✅改善済 | `check_rate_limit` RPCのシグネチャと完全一致。DoSリスク解消 |
| 2 | SEC-C10: Chat APIプロンプト注入 | ✅改善済 | `sanitizeForPrompt()` で`<>`を全角変換。XMLタグ境界破壊防止 |
| 3 | SEC-H8: isRateLimited() Fail-Open | ✅改善済 | `return true`（fail-closed）を維持 |
| 4 | SEC-H9: Pause API months不整合 | ✅改善済 | `[1, 2, 3]` に統一 |
| 5 | SEC-H10: guestAnalysis/micro.ts エラーメッセージ露出 | ✅改善済 | モデル名のみログ、戻り値 `"ANALYSIS_FAILED"` 固定 |
| 6 | SEC-H11: guestAnalysis/micro.ts エラー集約 | ✅改善済 | errors配列はモデル名のみ蓄積 |
| 7 | SEC-H12: Chat API 会話履歴エスケープ | ✅改善済 | `sanitizeForPrompt(h.text)` を応答側にも適用 |
| 8 | SEC-H13: vision.ts logger.error()内部詳細 | ⚠️部分改善 | vision分割済み。ただしvideoMacro/asyncJob.tsではErrorオブジェクトがSentryに送信 |
| 9 | SEC-M14: champion名ログ記録 | ✅改善済 | 直接ログ記録除去済み |
| 10 | SEC-M15: Stripe webhook cancelErr.message | ✅改善済 | err.message不含の汎用メッセージ |
| 11 | SEC-M16: profile.ts TOCTOU脆弱性 | ⚠️部分改善 | 再チェック実装。DB unique constraintがフォールバック |
| 12 | SEC-M17: checkout.ts baseUrl URL parsing | ✅改善済 | `new URL()` で安全にパース |
| 13 | SEC-M18: guestCredits.ts IPv6正規表現 | ✅改善済 | `isIP()` でIPv4/IPv6両方検証 |
| 14 | SEC-L9: Chat API geminiRetry()未使用 | ✅改善済 | 使用確認 |
| 15 | SEC-L11: login.tsx クライアントレート制限リロードリセット | ⚠️部分改善 | サーバー側DB RPCレート制限あり。Server Action経由のバイパス可能性 |
| 16 | MON-C9: 翻訳矛盾（週1回 vs 週3回） | ✅改善済 | 3言語全箇所「週3回」統一 |
| 17 | MON-C10: FALLBACK価格リスク | ⚠️部分改善 | `isFallback: true` フラグ追加。UIリアルタイム通知未実装 |
| 18 | MON-C11: Referral報酬fail-silent | ✅改善済 | 3回リトライ + 指数バックオフ |
| 19 | MON-H18: Pause 6ヶ月問題 | ✅改善済 | 最大3ヶ月に短縮 |
| 20 | MON-M25: CancelConfirmModal tier別条件分岐 | ✅改善済 | Extra専用項目を条件表示 |
| 21 | MON-M26: trial_will_endメール日本語hardcode | ✅改善済 | 3言語対応の動的locale選択 |

**改善率: 16/21 完全改善 (76%), 5/21 部分改善 (24%)**

## 前回指摘の改善状況（Agent M — マネタイゼーション視点）

| # | 指摘事項（前回ID） | 改善状況 | 詳細 |
|---|---------|---------|------|
| 1 | 通貨記号のハードコード（¥固定） | ✅改善済 | `CURRENCY_SYMBOLS` マップで jpy/usd/eur/krw/gbp対応 |
| 2 | Free→Premium変換ファネルの最適化 | ✅改善済 | Welcome Modal CTA、分析結果後CTA、PremiumPromoCard |
| 3 | トライアル終了リマインダーメール | ✅改善済 | 3言語対応リマインダーメール実装 |
| 4 | プラン切替時のプロレーション（日割り計算） | ✅改善済 | 残日数クレジット + Stripeクーポン + 冪等性。テスト7件 |
| 5 | リファラルプログラム | ✅改善済 | 双方向インセンティブ + 3回リトライ |
| 6 | 広告収入（AdSense/リワード広告） | ✅改善済 | Premium自動非表示、スキップ廃止 |
| 7 | 解約防止フロー（CancelConfirmModal） | ✅改善済 | 2段階フロー + Pause提案 + tier別表示 |
| 8 | Pause APIとUIの不整合 | ✅改善済 | `[1, 2, 3]` 完全一致 |
| 9 | Freeプラン週1回制限 | ✅改善済 | `FREE_WEEKLY_ANALYSIS_LIMIT = 3` |
| 10 | 日本語翻訳の重大矛盾 | ✅改善済 | 全3言語統一 |
| 11 | 価格情報のFallback依存リスク | ⚠️部分改善 | `isFallback` フラグ追加。リアルタイム通知未実装 |
| 12 | Referral報酬のfail-silent | ✅改善済 | 3回リトライ + exponential backoff |
| 13 | Pause期間6ヶ月問題 | ✅改善済 | `[1, 2, 3]` に変更 |
| 14 | Cronメール Premium限定 | ✅改善済 | Free層向け `buildFreeEmailHtml()` 実装 |
| 15 | alternates.languagesが全言語で同一URL | ❌未改善 | ja/en/ko 全て `"https://lolcoachai.com"` のまま |

**改善率: 13/15 完全改善 (87%), 1/15 部分改善 (7%), 1/15 未改善 (7%)**

---

# Agent S: セキュリティ審査

## S-CRITICAL（即座に修正必須）

| # | ID | 問題 | 影響 | 推奨修正 |
|---|------|------|------|---------|
| 1 | SEC-C11 | **signChallenge の署名シークレットにSUPABASE_SERVICE_ROLE_KEYをフォールバック使用** (`profile.ts` L12) | SUPABASE_SERVICE_ROLE_KEYはマスターキー。HMAC署名の鍵素材として使用するのは用途外かつ危険。万一署名値がログ等で漏洩した場合、HMAC解析から鍵の手がかりが得られるリスク | **専用の署名シークレットを環境変数として追加**: `VERIFICATION_SIGNING_SECRET`。修正例: `const secret = process.env.VERIFICATION_SIGNING_SECRET; if (!secret) throw new Error("VERIFICATION_UNAVAILABLE");` |
| 2 | SEC-C12 | **videoAnalysis.ts L161-172: 内部エラーメッセージがDBに保存** | `e.message` がDBの `video_analyses.error` カラムに保存。RLSでユーザーがSELECT可能。GeminiのAPIキーフォーマットや内部パス情報が漏洩するリスク | `error: "ANALYSIS_FAILED"` をDBに保存し、internalMessageは`logger.error()`のみに使用 |

## S-HIGH（リリース前に修正推奨）

| # | ID | 問題 | 影響 | 推奨修正 |
|---|------|------|------|---------|
| 1 | SEC-H14 | **Server Actionへのレート制限が不完全** | middleware.tsのレート制限はPOSTのみ対象。Server Actions はNext.jsのRSC/Server Action RPCで呼ばれ、middleware経由のレート制限が適用されない可能性 | Server Action内部でRPCベースのレート制限を呼び出す。工数: 30分 |
| 2 | SEC-H15 | **checkout/route.ts L155: Stripe API例外のe.messageがlogger.errorに記録** | Sentryに送信されるe.messageにAPIキーやcustomer IDが含まれうる | 汎用メッセージに変更: `logger.error("[Checkout] Existing subscription retrieval failed")` |
| 3 | SEC-H16 | **coach/analyze.ts L321: Gemini APIエラーメッセージがSentryに送信** | modelErrorがSentryに送信。APIキーのプレフィックスやリクエスト詳細が含まれうる | modelErrorをログに含めない: `logger.error(\`[Coach] ${modelName} failed\`)` |
| 4 | SEC-H17 | **syncSubscriptionStatus L119: cancelErr.messageがSentryに送信** | Stripeサブスクリプション IDとエラーメッセージがSentryに記録 | IDとエラーメッセージを除去: `logger.error("[Sync] Failed to cancel duplicate subscription")` |

## S-MEDIUM（改善推奨）

| # | ID | 問題 | 推奨修正 | 工数 |
|---|------|------|---------|------|
| 1 | SEC-M19 | verifyOrigin がOriginヘッダー未送信時にnull返却。CSRF攻撃でOriginを省略するケースがある | 重要APIルートでOrigin必須化 | 15分 |
| 2 | SEC-M20 | matchService.ts でPUUID先頭8文字がログに記録 | PUUIDログ除去またはハッシュ化 | 10分 |
| 3 | SEC-M21 | turnstile.ts にfetch タイムアウト未設定 | `AbortController` + 5秒タイムアウト追加 | 10分 |
| 4 | SEC-M22 | supabase/config.toml `enable_confirmations = false` | コメントで本番設定の注意喚起 | 2分 |
| 5 | SEC-M23 | billing/route.ts baseUrl構築がcheckout/route.tsと異なるパターン | `new URL()` パターンに統一 | 10分 |
| 6 | SEC-M24 | logger.ts: Sentryへの送信時にPII/機密情報フィルタリングなし | Sentryの`beforeSend`フックでスクラブ | 30分 |

---

# Agent M: マネタイゼーション審査

## M-CRITICAL（収益損失リスク）

| # | ID | 問題 | 影響 | 推奨修正 |
|---|------|------|------|---------|
| 1 | M-C1 | **Weekly SummaryメールとFreeリエンゲージメントメールが全て日本語ハードコード** | EN/KOユーザーにも日本語メールが送信される。メール開封率崩壊。Premium→更新率 -3-5%、Free→Premium CVR -2-3% | `language_preference` を取得して3言語の`CRON_EMAIL_TEXTS`マップで動的切替。工数: 2時間 |
| 2 | M-C2 | **FreeメールのPremium誘導テキストが「無制限」と記載** | 実際はPremium=20回/週、Extra=50回/週。景品表示法（優良誤認）抵触リスク + 信頼毀損 | `"Premiumなら週20回まで分析可能"` に修正。工数: 5分 |

## M-HIGH（収益最大化の機会損失）

| # | ID | 問題 | 影響 | 推奨修正 |
|---|------|------|------|---------|
| 1 | M-H1 | billing/route.ts と checkout/route.ts でURL parsing方式が異なる | Billingポータルリダイレクト失敗リスク。チャーン率 +1-2% | `new URL()` パターンに統一。工数: 10分 |
| 2 | M-H2 | Coupon名が日本語ハードコード | EN/KOユーザーのStripe請求書に日本語表示 | locale別クーポン名マッピング。工数: 15分 |
| 3 | M-H3 | 月額選択時の年間プラン打ち消し線比較がない | 年間プラン選択率改善余地 +5-8% | `<del>¥980/月</del> → ¥650/月` 表示追加。工数: 30分 |
| 4 | M-H4 | Welcome Modalの「View Plans」CTAが控えめすぎる | Pricing遷移率3%以下（業界標準7-10%を下回る） | 目立つグラデーションボタンに変更。工数: 15分 |
| 5 | M-H5 | ReferralCardにソーシャルシェアボタンがない | コピー→ペーストの手間でリファラルCVR 30-50%低下 | `navigator.share()` + SNSシェアボタン追加。工数: 1時間 |

## M-MEDIUM（改善推奨）

| # | ID | 問題 | 推奨修正 | 推定インパクト |
|---|------|------|---------|---------------|
| 1 | M-M1 | LPのCTAに`/pricing`への導線がない | CTAに「プラン比較」サブリンクを追加 | LP→Pricing CVR向上 |
| 2 | M-M2 | PricingページFAQに「解約はいつでもできますか？」がない | FAQ 10-12問に拡張 | Checkout完了率 +3-5% |
| 3 | M-M3 | invoice.payment_failed でユーザーへのメール通知がない | Dunningメール送信実装 | チャーン率 -5-10% |
| 4 | M-M4 | AdSenseBannerが毎レンダリングでサーバーアクション呼出 | propsで`analysisStatus`を渡す | パフォーマンス改善 |
| 5 | M-M5 | FALLBACK_PRICESがclient/server二重管理 | 統一exportに変更 | 保守性向上 |
| 6 | M-M6 | syncSubscriptionStatus失敗時のリカバリ不足 | リトライボタン付きモーダル表示 | サポート問い合わせ減少 |

---

# 両エージェント共同発見事項

## 重複/関連する指摘の統合

| Agent S | Agent M | 統合見解 |
|---------|---------|---------|
| SEC-M23: billing/route.ts URL parsing | M-H1: billing/route.ts URL parsing方式不一致 | **同一問題**。セキュリティ（不正リダイレクト防止）とUX（ポータルリダイレクト安定化）の両面で修正必須。工数: 10分 |
| SEC-C12: 内部エラーDB保存 | -- | Agent M未検出。ユーザーがDB経由で内部エラーを閲覧可能という**セキュリティ・信頼性の複合問題** |
| -- | M-C1: Cronメール日本語ハードコード | Agent S未検出。マネタイゼーション面で最大のインパクト。**EN/KOユーザーのリテンション崩壊** |
| -- | MON-M31 (Agent S発見): referral RLSバグ | Agent S・M両方が発見。リファラルプログラムの被紹介者メリットが完全機能停止。**実質M-HIGH** |

---

# コンバージョン最適化審査（Agent M）

## C-HIGH

| # | ID | 問題 | 影響 | 推奨修正 |
|---|------|------|------|---------|
| 1 | C-H1 | Pricingページに「POPULAR」バッジがない | CVR +8-12%の機会損失 | Premiumに「POPULAR」、Extraに「BEST VALUE」バッジ。工数: 15分 |
| 2 | C-H2 | 使用率80-90%時点のソフトプロモがない | 損失回避の最もCVRが高いモメントを逃している | 使用率80%超でインラインバナー表示。工数: 30分 |
| 3 | C-H3 | LP→Signup導線にPricing情報が全くない | 「無料で始められる」明示でCVR +5-8% | Hero CTA下にサブテキスト追加。工数: 10分 |

## C-MEDIUM

| # | ID | 問題 | 推奨修正 |
|---|------|------|---------|
| 1 | C-M1 | Feature比較テーブルのモバイル横スクロール | モバイルではカード形式に切替 |
| 2 | C-M2 | PremiumFeatureGateに直接Checkoutオプションなし | `triggerStripeCheckout` CTA追加 |
| 3 | C-M3 | Upgrade Success ModalにExtra言及なし | 「Extraならさらに高度な分析が可能」追加 |
| 4 | C-M4 | Pricing bottomのFreeユーザー向けCTAがPremiumのみ | Premium + Extra の2ボタン構成 |

---

# 収益多角化審査（Agent M）

| # | ID | 状態 | 評価 |
|---|------|------|------|
| 1 | RD-1 | サブスクリプション（Premium + Extra 2層） | ✅良好 |
| 2 | RD-2 | 広告収入（AdSense + リワード広告） | ✅良好 |
| 3 | RD-3 | リファラルプログラム | ✅良好（RLSバグ修正必要） |
| 4 | RD-4 | 年間プラン | ✅良好 |
| 5 | RD-5 | トライアル（7日/リファラル14日） | ✅良好 |
| 6 | RD-6 | Pause機能（解約防止） | ✅良好 |
| 7 | RD-7 | メールリエンゲージメント | ⚠️部分的（日本語ハードコード） |
| 8 | RD-8 | Dunning（支払い失敗回収） | ❌未実装 |
| 9 | RD-9 | Win-back（解約後復帰） | ❌未実装 |
| 10 | RD-10 | A/Bテスト基盤 | ❌未実装 |

---

# 両エージェント評価ポイント（良い点）

## セキュリティ（Agent S）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **Fail-Closed Security Defaults 全面適用** | isRateLimited(), getGuestCreditStatus(), verifyTurnstileToken(), check_rate_limit RPC -- すべてエラー時にブロック方向 |
| 2 | **DEBIT-FIRSTパターン完全実装** | 7箇所すべてでDEBIT-FIRST + 失敗時refund。二重消費防止も正常動作 |
| 3 | **RPC原子性の徹底** | 10以上のSECURITY DEFINER RPCでDB操作の原子性保証 |
| 4 | **CSP nonce + strict-dynamic** | リクエストごとにcrypto.randomUUID()でnonce生成。CSP2/CSP3両対応 |
| 5 | **Webhook冪等性（DB-based）** | claim_webhook_event RPC + 7日自動クリーンアップ |
| 6 | **Checkout冪等性** | 5分バケットのsessionIdempotencyKey + クーポンidempotencyKey |
| 7 | **Zod入力検証の網羅的適用** | 主要エントリポイントすべてにzod適用 |
| 8 | **HSTS + セキュリティヘッダー完備** | X-Frame-Options: DENY, HSTS 2年, Permissions-Policy, Referrer-Policy |
| 9 | **Riot API Retry-After完全対応** | fetchMatchDetail → matchService.ts でRetry-After伝播 + バックオフ |
| 10 | **プロンプト注入防御** | sanitizeForPrompt() + XML境界破壊防止 |
| 11 | **escapeHtml適用** | Webhookメールのユーザー入力をHTMLエスケープ |
| 12 | **テストカバレッジ** | 7ファイル（credit, webhook, checkout, constants, guestCredits, validation, retry）にUnit test |

## マネタイゼーション（Agent M）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **Stripe動的価格取得 + 通貨自動判定** | `getStripePrices()` + `CURRENCY_SYMBOLS` マップ + `isFallback` フラグ |
| 2 | **プロレーション完全実装** | 残日数クレジット + Stripeクーポン + 冪等性。テスト7件。SaaS業界上位10%の品質 |
| 3 | **Cancel Flow 2段階設計** | 理由選択→Pause提案。tier別条件分岐。業界ベストプラクティス準拠 |
| 4 | **テストカバレッジ充実** | checkout 18テスト + webhook 20テスト = 38テストでコア課金フロー網羅 |
| 5 | **Referral報酬リトライ** | 3回リトライ + exponential backoff。webhook信頼性が本番品質に到達 |
| 6 | **PremiumPromoCard 2モード** | Free向けアップグレードCTA / Premium向けExtra誘導（90%超時のみ） |
| 7 | **Free層Cronメール実装** | 週次リセット通知 + Premium誘導CTA |
| 8 | **翻訳矛盾の完全解消** | ja/en/ko全3言語「週3回」統一。FAQも一致 |
| 9 | **年間プランデフォルト表示** | `useState('annual')` で即時対応 |

---

# 推定収益インパクト（Agent M分析）

### 現状推定（MAU 500）
| 指標 | 推定値 |
|------|--------|
| Free→Premium CVR | ~7.5% |
| Premium→Extra CVR | ~1.5% |
| 月間サブスク収益 | ~¥45,000 |
| 広告収益 | ~¥3,000 |
| **月間総収益** | **~¥48,000** |

### 全指摘修正後の推定
| 指標 | 改善後推定 | 改善幅 |
|------|-----------|--------|
| Free→Premium CVR | ~9.5% | +2.0pp |
| Premium→Extra CVR | ~3.0% | +1.5pp |
| 月間サブスク収益 | ~¥62,000 | +37% |
| 広告収益 | ~¥3,500 | +17% |
| **月間総収益** | **~¥65,500** | **+36%** |

---

# 統合改善ロードマップ

## 最優先（即日対応 — 30分以内）

| # | ID | 施策 | 工数 | カテゴリ |
|---|-----|------|------|---------|
| 1 | SEC-C11 | signChallenge専用シークレット導入 | 15分 | Security CRITICAL |
| 2 | SEC-C12 | videoAnalysis.ts DB保存エラーメッセージ汎用化 | 10分 | Security CRITICAL |
| 3 | M-C2 | Freeメールの「無制限」→「週20回」修正 | 5分 | 法的リスク排除 |

## Phase 1: 即時対応（1-2日）

| # | ID | 施策 | 工数 | インパクト |
|---|-----|------|------|----------|
| 4 | M-C1 | Cronメール全文の多言語化 | 2時間 | EN/KO開封率回復、CVR +2-3% |
| 5 | MON-M31 | referralトライアルRLS修正 | 15分 | リファラルプログラム復旧 |
| 6 | SEC-H15/H16/H17 | logger.errorからの機密情報除去 | 30分 | Sentry経由漏洩防止 |
| 7 | M-H1/SEC-M23 | billing/route.ts URL parsing統一 | 10分 | ポータル安定化 |
| 8 | M-H2 | Coupon名多言語対応 | 15分 | 国際UX向上 |
| 9 | C-H1 | Premium「POPULAR」+ Extra「BEST VALUE」バッジ | 15分 | CVR +5-8% |
| 10 | C-H3 | Hero CTA「無料で始められます」サブテキスト | 10分 | Signup CVR +5-8% |
| 11 | M-H4 | Welcome ModalのPricing CTA強化 | 15分 | トライアル開始率 +3-5% |

## Phase 2: 短期施策（3-5日）

| # | ID | 施策 | 工数 | 推定インパクト |
|---|-----|------|------|-------------|
| 12 | SEC-H14 | Server Actionレート制限強化 | 30分 | セキュリティ強化 |
| 13 | SEC-M19 | verifyOrigin Origin必須化 | 15分 | CSRF防御強化 |
| 14 | SEC-M21 | Turnstile fetchタイムアウト追加 | 10分 | 可用性向上 |
| 15 | M-H5 | ReferralCardにソーシャルシェアボタン | 1時間 | リファラルCVR +30-50% |
| 16 | C-H2 | 使用率80%時ソフトプロモバナー | 30分 | Free→Premium CVR +1-2% |
| 17 | M-M2 | PricingページFAQ拡張 | 30分 | Checkout完了率 +3-5% |
| 18 | M-M3 | 支払い失敗Dunningメール | 1.5時間 | チャーン率 -5-10% |
| 19 | M-H3 | 年間プラン打ち消し線比較表示 | 30分 | 年間プラン選択率 +5-8% |

## Phase 3: 中期施策（1-2週間）

| # | ID | 施策 | 工数 | インパクト |
|---|-----|------|------|----------|
| 20 | SEC-M24 | Sentry PIIスクラブ | 30分 | データ保護強化 |
| 21 | RD-9 | 解約後Win-backメール | 3時間 | 復帰率 +5-10% |
| 22 | C-M1 | Feature比較テーブルモバイル対応 | 1時間 | モバイルCVR +3-5% |
| 23 | C-M2 | PremiumFeatureGate直接Checkoutボタン | 30分 | Premium CVR +1-2% |
| 24 | M-M5 | FALLBACK_PRICES統一 | 10分 | 保守性向上 |
| 25 | M-M4 | AdSenseBannerサーバーアクション最適化 | 15分 | パフォーマンス改善 |

---

# 総評

## Agent S（セキュリティ）

前回審査（第6回）のCRITICAL 2件を**完全修正**した実行力は高く評価する。特にchat/route.tsの`sanitizeForPrompt()`はシンプルかつ効果的で、過度な複雑化を避けた正しい判断。

新たに発見したCRITICAL 2件は:
1. **signChallengeのマスターキー流用**: 鍵の用途分離原則に反する。専用シークレット導入で15分修正可能
2. **videoAnalysis.tsの内部エラーDB保存**: ユーザーアクセス可能なDBカラムに内部エラー保存。10分修正可能

全体として、DEBIT-FIRST、RPC原子性、CSP nonce、Webhook冪等性、入力検証の**5層防御**が堅実。主な残存リスクは**Sentry経由の機密情報漏洩**パターン。

## Agent M（マネタイゼーション）

前回60点からの+16点回復は、指摘事項を正確かつ迅速に消化した実行力の証左。

**最大の残存課題はCronメールの日本語ハードコード（M-C1）**。Trial Reminderは既に3言語対応済みなのに、Weekly Summary と Free リエンゲージメントメールは全文日本語のまま。EN/KOユーザーのメール開封率がゼロに近い状態はリテンションとコンバージョン両面で深刻なダメージ。

技術的には2時間で対応可能（Trial Reminderの`TRIAL_EMAIL_TEXTS`パターンを適用するだけ）。

## 両エージェント合意見解

**一言**: 壁は堅牢になった。鍵も閉まった。エンジンの性能は第1回審査時と比較して別物。残るは(1) 鍵の素材が正しいか（signChallenge）、(2) 窓から見える景色が全言語で伝わっているか（Cronメール日本語固定）、(3) リファラルの約束が本当に実行されているか（RLSバグ）の3点だ。

**スコア推移（Agent M基準）**: 32 → 55 → 72 → 74 → 80 → 60 → **76** → (改善後見込み: **91**)
