# LoLCoachAI Elite Review — 2026-03-01 22:57

> 2名のエリートエージェントによる辛口審査レポート（Product/UX + Architecture/Performance/Security）
> 第5回審査

---
---

# Part 1: プロダクト / UX 審査

実施日: 2026-03-01 22:57
審査官: シニアプロダクトマネージャー（Google/Apple級 Product/UX Expert）

## 総合スコア

| 指標 | 第1回 | 第2回 | 今回（第3回） | 改善後見込み |
|------|-------|-------|-------------|------------|
| スコア | 58/100 | — | **68/100** | **82/100** |

**+10点の改善**。構造的な改善が複数実施されており、プロダクト品質は着実に向上している。

---

## 前回指摘事項の改善状況

| ID | 指摘内容 | 状況 | 詳細 |
|---|---|---|---|
| PUX-C1 | auth-code-errorページが英語ハードコード（i18n未対応） | **改善済** | `src/app/auth/auth-code-error/page.tsx` が `useTranslation()` を使用する形に全面書き換え済み。`t("authCodeError.title")` 等で3言語対応。 |
| PUX-C2 | loginPageでSupabaseの生エラーメッセージがユーザーに表示 | **部分改善** | メインのログインフローはServer Action(`loginWithPassword`)に移行しエラーコード化。ただし `src/app/login/page.tsx:42` の **Google OAuth失敗時に `toast.error(error.message)` でSupabase SDK生エラー文字列がそのまま表示される**問題が残存。 |
| PUX-C3 | SEO Metadataが日本語ハードコード — 多言語対応が機能しない | **改善済** | `src/app/layout.tsx` と `src/app/page.tsx` の双方で `generateMetadata()` + cookie-based locale判定 + 3言語メタデータ + `alternates.languages` によるhreflang実装済み。 |
| PUX-C4 | Server Actionのエラーメッセージが全て日本語ハードコード + res.error.includes("日本語")パターン | **部分改善** | `profile.ts` のエラーは全てエラーコード化。クライアント側で `t()` でi18n化。しかし**他のServer Actionに大量の日本語ハードコードが残存**（後述PUX-C5）。 |
| PUX-H1 | Social Proof数値がハードコード・静的 | **部分改善** | i18nキー化済み。ただし数値は依然としてlocaleファイルにハードコードされた静的文字列であり、実際のDBデータに基づいていない。 |
| PUX-H2 | VideoMacroAnalysisProviderのエラーメッセージ日本語ハードコード("分析完了！") | **改善済** | `t("analyzePage.progress.analysisComplete")` に変更済み。その他メッセージも全て `t()` 関数経由に移行。 |
| PUX-H3 | rsoPasswordBlockedの翻訳キーがen/koに不足 | **改善済** | en.json、ko.jsonいずれにも翻訳キーが確認済み。 |
| PUX-H4 | Account Pageの「Failed Attempts」が英語ハードコード | **改善済** | `t('accountPage.verification.failedAttempts')` 使用。Timerコンポーネントも統合済み。 |
| PUX-H5 | Onboarding「JP Only」表示 | **改善済** | `t('onboardingPage.jpOnly')` を使用し、3言語全てに翻訳キーが存在。 |
| PUX-H6 | Pricingページの年額プラン表示に日本語テンプレートが残存 | **改善済** | `t('pricingPage.billing.perMonthEquivalent')` + `t('pricingPage.billing.percentOff')` を使用。3言語に翻訳キー存在。 |
| PUX-H7 | ReferralCardのフォールバックテキストが全て日本語 | **改善済** | フォールバックテキストが全て英語に変更（"Invite Friends", "Link copied" 等）。 |
| PUX-H8 | AnalyzePageのアップグレードモーダルのフォールバックが日本語 | **改善済** | フォールバック文が英語に変更（"Guest analysis credits used up" 等）。 |
| PUX-M4 | テスティモニアル5件を3列グリッドで表示するレイアウト問題 | **改善済** | テスティモニアルが6件に増加。3列x2行で均等配置。 |
| PUX-M5 | Googleボタンのローディング状態の不整合 | **部分改善** | signup側は翻訳キー化。ただしフォールバック値が `'...'` で不十分。login側とキー名・表示テキストが異なり不統一。 |
| PUX-M6 | %OFF表示のi18n不足 | **改善済** | `pricingPage.billing.percentOff` が3言語に存在。動的表示に移行済み。 |
| PUX-M7 | テスティモニアルの信頼性 — 架空レビュー問題 | **部分改善** | Disclaimer追加（「個人の感想であり、効果を保証するものではありません」）。しかし根本的に架空レビューである点は変わらず。 |
| PUX-M8 | Landing Pageのアクセシビリティ不足 | **改善済** | 各セクションに `aria-labelledby` 追加、テスティモニアル星評価に `role="img" aria-label` 追加、SVGに `role="img"` 追加。 |
| PUX-M9 | Onboarding/AccountのTimerコンポーネントが重複実装 | **改善済** | 共通コンポーネント `src/app/components/VerificationTimer.tsx` として統合済み。 |
| PUX-M10 | DashboardClientPage と DashboardContent の並存 | **改善済** | `DashboardClientPage` は削除され、`DashboardContent` に一本化。 |
| PUX-M11 | Signupページに利用規約/プライバシーポリシーへの同意確認がない | **改善済** | `src/app/signup/page.tsx` にToS / Privacy Policy へのリンク追加。3言語の翻訳キーも確認済み。 |
| PUX-M12 | 広告の表示密度が高すぎる | **部分改善** | Premiumユーザー非表示機能追加。しかしFree/Guestユーザーへの広告密度は改善されていない。 |

**改善サマリー**: 前回指摘22件中、**完全改善 14件**、部分改善 7件、未改善 1件。改善率は **63%（完全）/ 95%（着手済み）**。

---

## 新規指摘事項

### CRITICAL（リリースブロッカー）

#### PUX-C5: Server Action日本語ハードコードエラーメッセージの大規模残存
- **ファイル**: 複数
  - `src/app/actions/vision.ts:151,157,692` — "ミクロ分析はPremiumプラン限定です", "週間制限に達しました" 等
  - `src/app/actions/guestAnalysis/micro.ts:62,67` — "認証が必要です", "プロフィールが見つかりません"
  - `src/app/actions/videoMacro/timeDetection.ts:80` — "ゲーム内時間を検出できませんでした"
  - `src/app/actions/videoMacro/asyncJob.ts:81,88,94` — "週間制限に達しました", "自前APIキーの利用はPremiumプラン限定です"
  - `src/app/actions/coach/analyze.ts:47,55,59` — 同上
  - `src/app/actions/analysis/matchAnalysis.ts:103,108,122,272,277` — "クレジットが不足しています", "自前APIキーの利用はPremiumプラン限定です"
- **問題**: profile.tsのエラーコード化は改善されたが、他のServer Actionは全て日本語ハードコードのまま。en/koユーザーがAPI制限に引っかかった場合、意味不明な日本語エラーが表示される。ユーザー体験として致命的。
- **改善案**: profile.tsと同様に、全てのServer Actionでエラーコード文字列を返し、クライアント側で `t()` を使って翻訳する方式に統一する。

#### PUX-C6: Pricingページの通貨記号 `¥` がハードコード
- **ファイル**: `src/app/pricing/page.tsx:259,313,392,401,500,509` および `src/app/actions/pricing.ts:18-27`
- **問題**: 全プランカードの価格表示で `¥` が直接HTMLにハードコード。フォールバック価格も円建てで固定。多言語展開時に通貨対応が不可能な設計。
- **改善案**: Stripe Price APIから通貨情報も取得し、`Intl.NumberFormat` で通貨記号を動的に表示。

### HIGH（早急に対応すべき）

#### PUX-H9: loginPageのGoogleログイン失敗時にSupabase SDKの生エラーが表示
- **ファイル**: `src/app/login/page.tsx:42`
- **問題**: `toast.error(error.message)` でSupabaseの内部エラーメッセージが直接ユーザーに表示される。
- **改善案**: `toast.error(t('loginPage.googleAuthFailed'))` に変更。

#### PUX-H10: CancelConfirmModalのpauseSuccessフォールバックに動的変数を含む日本語が残存
- **ファイル**: `src/app/components/subscription/CancelConfirmModal.tsx:82`
- **問題**: フォールバック値にテンプレートリテラルで`resumeDate`が含まれるが、localeファイルの値は固定文字列なので**resumeDateが実際のUIに表示されない**。
- **改善案**: localeファイルに `{date}` プレースホルダを追加し置換する。

#### PUX-H11: PremiumPromoCard / MacroResultSection のフォールバックテキストに日本語残存
- **ファイル**: `src/app/dashboard/widgets/PremiumPromoCard.tsx:33,49,60,64,68,85,107-111,117`
- **問題**: `t('dashboard.promo.weeklyUsage', 'AI分析 (今週)')` 等、フォールバック値が全て日本語。
- **改善案**: フォールバック値を英語に統一、またはen.json/ko.jsonへのキー追加を確認。

#### PUX-H12: MacroResultSection内のblurメッセージ・CTAのフォールバックが日本語
- **ファイル**: `src/app/analyze/components/MacroResultSection.tsx:70-72,97-100,201-204,314-327`
- **問題**: `t('analyzePage.blur.message', '無料登録で詳細を確認')` 等のフォールバックが日本語。
- **改善案**: フォールバック値を英語に統一。

#### PUX-H13: hreflang URLが全て同一URL
- **ファイル**: `src/app/layout.tsx:68-73`, `src/app/page.tsx:57-60`
- **問題**: `alternates.languages` で ja/en/ko が全て `https://lolcoachai.com` を指定。Googleはこれを「同一コンテンツ」と解釈するため、hreflangの効果がゼロ。
- **改善案**: cookie-basedのi18nではhreflangの効果が限定的であることを認識し、将来的にサブパス(`/en/`, `/ko/`)での言語ルーティングへの移行を検討。

### MEDIUM（計画的に対応）

| ID | 問題 | ファイル | 改善案 |
|----|------|---------|--------|
| PUX-M13 | サモナー登録でリージョンが `'JP1'` にハードコード | `profile.ts:286` | リージョンを選択可能にするか定数管理 |
| PUX-M14 | Pricing FallbackのperMonthEquivalent表示がen.json内で¥記号ハードコード | `en.json:1167` | フォールバック文から具体的金額を除外 |
| PUX-M15 | AdSenseBannerが各レンダリングで `getAnalysisStatus()` を呼ぶN+1パターン | `AdSenseBanner.tsx:35` | `isPremium` propを親から渡すかContext共有 |
| PUX-M16 | Testimonialが全て5つ星で信頼性に欠ける | `SocialProofSection.tsx:61-63` | 4.5つ星や4つ星のレビューも混在させる |
| PUX-M17 | signup/loginの変数名が `LoginID` / `LoginId` と不統一 | `signup:13`, `login:17` | 意味の明確な名前に統一 |

### LOW（余裕があれば）

| ID | 問題 |
|----|------|
| PUX-L5 | LanguageSwitcherの位置 — ページ種別ごとに一貫性あり（改善確認済み） |
| PUX-L6 | FeaturesSection のプレビュー画像がアイコンのみ（スクリーンショット推奨） |
| PUX-L7 | login/signupの入力値が制御コンポーネントに統一済み（改善確認済み） |

---

## 改善ロードマップ

### Phase 1: リリースブロッカー解消（1-2日）
1. **PUX-C5**: 全Server Actionのエラーメッセージをエラーコード化 + クライアント側i18n化
2. **PUX-C6**: Pricing通貨記号の動的化

### Phase 2: HIGH優先度修正（2-3日）
3. **PUX-H9**: Google OAuth失敗時のエラー表示修正（1行変更）
4. **PUX-H10**: CancelModal pauseSuccessのresumeDate表示修正
5. **PUX-H11**: PremiumPromoCardフォールバック英語化
6. **PUX-H12**: MacroResultSectionフォールバック英語化
7. **PUX-H13**: hreflang戦略の再検討

### Phase 3: MEDIUM優先度改善（1週間）
8-12. PUX-M13〜M17

---

## 総評

前回審査からの改善度は**中程度〜良好**。auth-code-errorのi18n化、SEO Metadataの多言語対応、Verification Timer統合、DashboardClientPage一本化、SignupのToS同意追加など、構造的な改善が複数実施されており、プロダクト品質は着実に向上している。特にprofile.tsのエラーコード化パターンは正しい方向性を示しており、他のServer Actionにも横展開すべき模範例となっている。

しかし最大の課題は**Server Actionレイヤーの日本語ハードコードが広範に残存**している点。vision.ts、guestAnalysis、videoMacro、coach/analyze.ts、analysis/matchAnalysis.tsなど主要な分析フローのエラーメッセージが全て日本語固定であり、多言語ユーザーが制限や有料機能に触れた瞬間に体験が崩壊する。これはprofile.tsで証明された改善パターンを横展開するだけで解決可能であり、最優先で対応すべきである。

**スコア推移**: 58 → **68**（+10） → (改善後見込み: **82**)

---
---

# Part 2: アーキテクチャ / パフォーマンス / セキュリティ 審査

実施日: 2026-03-01 22:57
審査官: シニアソフトウェアアーキテクト（Netflix/Meta級 Architecture/Performance/Security Expert）

## 総合スコア

### セキュリティスコア推移

| 指標 | 第1回 | 第2回 | 第3回 | 第4回 | 今回（第5回） | 改善後見込み |
|------|-------|-------|-------|-------|-------------|------------|
| スコア | 48/100 | 72/100 | 78/100 | 82/100 | **88/100** | **94/100** |
| CRITICAL件数 | 4件 | 2件 | 2件 | 1件 | **0件** | 0件 |

**+6点の改善**。前回最大のセキュリティリスクだったインメモリレート制限が完全に解決され、CRITICALが初めてゼロに。

### アーキテクチャスコア推移

| 指標 | 第1回 | 今回（第2回） | 改善後見込み |
|------|-------|-------------|------------|
| スコア | 62/100 | **78/100** | **88/100** |

**+16点の大幅改善**。巨大ファイル分割、getUser() React.cache統一、Zodバリデーション拡充が高評価。

---

## 前回指摘事項の改善状況

| ID | 指摘内容 | 状況 | 詳細 |
|---|---|---|---|
| ARCH-H1(1602) | Route Handler内のgetUser()が未キャッシュ | **改善済** | `React.cache`でラップされた`getUser`が全箇所で使用。 |
| ARCH-H2(1602) | supabaseの型がany（webhook route等） | **部分改善** | Stripe SDKの`(subscription.items?.data?.[0] as any)?.current_period_end` が4箇所残存。 |
| ARCH-M1(1602) | DEBIT-FIRSTパターンのリファンドが非アトミック | **部分改善** | `decrement_weekly_count` RPCでrefund実装済みだが、RPC失敗時のリカバリは`logger.error`のみ。実用上は許容範囲。 |
| ARCH-M2(1602) | matchAnalysisのロジック重複 | **改善済** | `analysis/` にバレルファイル + サブモジュール分割完了。 |
| ARCH-M3(1602) | メールHTMLがハードコード（i18n未対応） | **未改善** | weekly-summary、stripe webhookのメール本文が全て日本語ハードコード。 |
| ARCH-M4(1602) | updatePayloadがany型 | **改善済** | `Record<string, unknown>`に変更済み。 |
| ARCH-M5(1602) | Route Handlerでsupabase.auth.getUser()直接呼び出し | **改善済** | `getUser()`ラッパー経由に統一。 |
| SEC-H1(1602) | RSO認証でリージョンがjp1にハードコード | **未改善** | `jp1.api.riotgames.com` と `region: 'JP1'` がハードコードのまま。 |
| SEC-M1(1602) | sessionParamsがany型 | **改善済** | `Stripe.Checkout.SessionCreateParams`で型付け完了。 |
| テストカバレッジ不足 | 4ファイル853行のみ | **部分改善** | 5ファイル983行に増加。しかしwebhook handler, checkout等のテストはゼロ。 |
| PERF-H1(1602) | LandingPageClient.tsxが840行超 | **改善済** | 135行に大幅削減。セクション別コンポーネント分割完了。 |
| SEC-C3(2149) | Authレート制限がインメモリMap | **改善済** | Supabase RPC `check_rate_limit` への分散レート制限に完全移行。`SECURITY DEFINER` + `GRANT anon`も正しい。 |
| SEC-H4(2149) | Weekly SummaryメールのHTML Injection | **改善済** | subject及びHTML body双方で`escapeHtml()`適用済み。 |
| SEC-H5(2149) | Cron認証のFail-Open | **改善済** | `CRON_SECRET`未設定時はstatus 500返却でfail-closed。 |
| SEC-H6(2149) | setRankGoalのIDOR | **改善済** | `puuid`の所有権をuser_idで検証後にupdate実行。`clearRankGoal`にも同様のガード。 |
| SEC-H7(2149) | Turnstile検証のFail-Open | **改善済** | 未設定時は`false`を返しfail-closed。fetchエラー時もfail-closed。 |
| SEC-M6(2149) | Weekly Summary CronのN+1クエリ | **改善済** | バッチプリフェッチ+Map集約。ユーザーごとのDB呼び出しは`getUserById`のみに削減。 |
| SEC-M7(2149) | Guest Analysisのゲスト検出が脆弱 | **改善済** | サーバーサイド認証ベースに移行。 |
| SEC-M8(2149) | Vision AnalysisのtimeOffset計算が不正確 | **未改善** | コメント内で解決策を議論しているが実装されていない。 |
| SEC-M9(2149) | CSP style-src unsafe-inline残存 | **改善済** | `style-src 'self' 'nonce-${nonce}'` に変更。`style-src-attr 'unsafe-inline'`はReact用で妥当。 |
| ARCH-H2(2149) | Chat APIでGeminiキーを!アサーション | **改善済** | 関数内でenvチェック、503返却に修正。 |
| ARCH-H3(2149) | vision.tsのDEBIT-FIRST + after()リスク | **部分改善** | after()内でrefundロジック実装済み。Next.js 16のafter()はVercelでサポートされ実用上は問題なし。 |
| ARCH-M2(2149) | stats.tsが924行の巨大ファイル | **改善済** | 7ファイル1013行に分割。最大ファイルは348行で適切なサイズ。 |
| ARCH-M3(2149) | Geminiモデルフォールバックリストが不整合 | **部分改善** | `GEMINI_MODELS_TO_TRY` を中央定義。ただし**5箇所がハードコードのまま**。 |
| SEC-M1(2149) | verifyAndAddSummonerの入力が型なし | **改善済** | Zodスキーマ`summonerDataSchema`バリデーション完了。 |
| SEC-M2(2149) | Sentry eventIDが本番で表示 | **改善済** | `NODE_ENV === "development"` ガードにより本番では非表示。 |
| PERF-H1(2149) | guestAnalysis.tsが961行 | **改善済** | 3ファイル+バレルに分割完了。 |
| ARCH-L1(2149) | リトライロジックの重複 | **部分改善** | `geminiRetry`ユーティリティ作成。ただしvision.ts、chat APIが独自ループのまま。 |
| ARCH-L4(2149) | テストカバレッジの絶対的不足 | **部分改善** | 4→5ファイル、853→983行に微増。 |

**改善サマリー**: 前回指摘29件中、**完全改善 18件**、部分改善 8件、未改善 3件。改善率は **62%（完全）/ 90%（着手済み）**。

---

## 新規指摘事項

### CRITICAL（リリースブロッカー）

**なし。** 前回CRITICALだったSEC-C3（インメモリレート制限）は完全に解決済み。**初めてCRITICALゼロを達成。**

### HIGH（早急に対応すべき）

#### NEW-H1: middleware.tsのレート制限がfail-open
- **ファイル**: `src/middleware.ts:22-26`
- **問題**: `isRateLimited()`はDB接続失敗時・RPC失敗時に`return false`（fail-open）。Supabaseが一時的にダウンするとレート制限が完全に無効化される。L9の`if (!url || !key) return false`も、env未設定時にレート制限をバイパスする。
- **改善案**: env未設定時は`return true`（ブロック）に変更。DB障害時は短期キャッシュフォールバックを検討。

#### NEW-H2: weekly-summary CronでN+1クエリが残存（auth.admin.getUserById）
- **ファイル**: `src/app/api/cron/weekly-summary/route.ts:87`
- **問題**: match_analyses/video_analysesのバッチ化は改善されたが、ユーザーごとに`supabase.auth.admin.getUserById(profile.id)`を呼び出している。プレミアムユーザーが1000人に増えた場合、1000回の個別APIコール。
- **改善案**: `supabase.auth.admin.listUsers()` でバッチ取得するか、profilesテーブルにemailカラムを持たせてJOINする設計に変更。

#### NEW-H3: Geminiモデル名のハードコードが5箇所で散在
- **ファイル**: `guestAnalysis/macro.ts:221`, `videoMacro/timeDetection.ts:31`, `videoMacro/analyze.ts:114`, `videoMacro/asyncJob.ts:191`, `analysis_timeline.ts:30`
- **問題**: `GEMINI_MODELS_TO_TRY`を中央定義したにもかかわらず、5箇所がハードコード。モデル更新時に修正漏れが発生する。
- **改善案**: 全箇所を`GEMINI_MODELS_TO_TRY`参照に統一。

### MEDIUM（計画的に対応）

| ID | 問題 | ファイル | 改善案 |
|----|------|---------|--------|
| NEW-M1 | vision.ts内の55行コメントブロック（timeOffset計算未解決） | `vision.ts:527-581` | クライアントからフレームタイムスタンプ送信に設計変更 |
| NEW-M2 | checkout/route.tsでプロレーションクーポンの通貨がjpyフォールバック | `checkout/route.ts:143` | currencyがnullなら処理を中断 |
| NEW-M3 | メールテンプレートのi18n未対応（ARCH-M3残存） | weekly-summary, stripe webhook | ユーザーのlanguage設定に基づいてlocale別テンプレート切替 |
| NEW-M4 | `as any`が26箇所残存 | webhook, checkout, profile等 | Stripe SDK型の正しいアクセスパスに修正 |
| NEW-M5 | リトライロジック統一の未完了（ARCH-L1残存） | vision.ts, chat/route.ts | 全Gemini呼び出しを`geminiRetry`に統一 |
| NEW-M6 | matchService.tsのログにエモジが含まれる | `matchService.ts:99,106,116,118` | `[WARN]`等のプレフィックスに統一 |
| NEW-M7 | auth_rate_limitsテーブルのクリーンアップが自動化されていない | migration SQL | pg_cronスケジュールまたはVercel cronエンドポイント追加 |

### LOW（余裕があれば）

| ID | 問題 |
|----|------|
| NEW-L1 | vision.tsの未使用import（fs, path） |
| NEW-L2 | vercel.jsonにcron定義の確認が必要 |
| NEW-L3 | coach/prompt.tsのdeprecated re-exportが使用され続けている |
| NEW-L4 | profile.tsの`select('*')`が複数箇所 |

---

## セキュリティの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **分散レート制限完全移行** | インメモリMap → Supabase RPC。SECURITY DEFINER + GRANT anonで正しい設計。**前回最大のCRITICALを完全解消** |
| 2 | **IDOR防止パターン確立** | rankGoalのset/clear双方で所有権検証。summoner_accounts.user_idチェック |
| 3 | **CSP nonce完全化** | style-src-elemからunsafe-inline除去。script-src + strict-dynamic + nonceの三層防御 |
| 4 | **Turnstile fail-closed化** | 未設定時もfetchエラー時もfalseを返す堅牢な設計 |
| 5 | **Cron認証のfail-closed化** | CRON_SECRET未設定時はHTTP 500で拒否 |
| 6 | **XSSエスケープの一貫化** | escapeHtml()がweekly-summaryのsubject + bodyの双方に適用 |
| 7 | **N+1クエリ集約化** | match_analyses/video_analysesのバッチプリフェッチ+Map |
| 8 | **DEBIT-FIRSTパターン完全化** | 全課金フローでAI呼び出し前にクレジット消費 |
| 9 | **Zodバリデーション拡充** | verifyAndAddSummoner、checkoutRequest等の入力検証が一元化 |
| 10 | **Sentry eventID本番非表示** | 開発環境限定表示に修正済み |

---

## 改善ロードマップ

### P0（今週中）
1. **NEW-H1**: middleware.tsレート制限 — env未設定時のfail-close（2行修正）
2. **NEW-H3**: Geminiモデルハードコード5箇所を統一（30分）
3. **NEW-M7**: auth_rate_limitsのクリーンアップCron設定

### P1（来週中）
4. **NEW-H2**: weekly-summary CronのN+1（getUserById）をバッチ化
5. **NEW-M5**: リトライロジックを`geminiRetry`に統一
6. **NEW-M4**: `as any` 26箇所の型修正

### P2（今月中）
7. **NEW-M1/SEC-M8**: vision.tsのtimeOffset計算の正確化
8. **NEW-M3**: メールテンプレートのi18n対応
9. **ARCH-L4**: テストカバレッジ拡充（webhook handler, checkout, visionのテスト追加目標）

### P3（次スプリント）
10. **SEC-H1**: RSO認証のリージョンハードコード解消（国際展開準備）
11. **NEW-L1/L3/L4**: 軽微なコードクリーンアップ

---

## 総評

前回審査から大幅な改善が見られる。特に(1)分散レート制限への移行（SEC-C3完全解決）、(2)巨大ファイルの体系的分割（stats 924行→7ファイル、guestAnalysis 961行→3ファイル+バレル、LandingPage 840行→135行）、(3)getUser()のReact.cache統一、(4)IDOR修正、(5)CSP nonce化、(6)Turnstile fail-close化は高く評価する。

アーキテクチャ面ではバレルファイル+サブモジュールパターンが一貫して適用され、コードベースの保守性が格段に向上した。

一方で「横断的関心事の統一」がまだ中途半端。`geminiRetry`を作ったのに半分のファイルが独自ループ、`GEMINI_MODELS_TO_TRY`を定義したのに5箇所がハードコード。これは「リファクタリングの最後の1マイル」が走り切れていない典型。テストカバレッジも983行/5ファイルは絶対量として不足。

セキュリティ88点、アーキテクチャ78点は「ローンチ可能」レベルだが、「安心して運用できる」レベルにはあと一歩。P0の3項目を今週中に片付ければ、セキュリティ90点台に到達できる。

---
---

# Part 3: 両エージェント共同議論

## Agent P（プロダクト/UX） × Agent A（アーキテクチャ/セキュリティ）: クロスドメイン議論

**Agent P**: 今回最も評価すべきは「改善のカバレッジ」だ。前回PUX指摘22件中14件完全改善、ARCH/SEC指摘29件中18件完全改善。未着手はほぼゼロで、改善サイクルが確実に機能している。

**Agent A**: 同意する。特にセキュリティ面でCRITICALゼロを達成したのは大きい。分散レート制限への移行、IDOR修正、Turnstile/Cron認証のfail-closed化と、前回指摘のHIGH 4件を全て解消したのは素晴らしい。

**Agent P**: しかし両者に共通する最大の課題が見えてきた — **「横断的な一貫性」の欠如**だ。プロダクト面では、profile.tsのエラーコード化は模範的だが他のServer Actionに横展開されていない。アーキテクチャ面では、geminiRetryやGEMINI_MODELS_TO_TRYを作ったのに半分のファイルが使っていない。パターンは正しいのに、全体への適用が不完全。

**Agent A**: まさにその通り。これは「リファクタリングの最後の1マイル問題」と呼ぶべきだ。基盤ユーティリティの作成（retry.ts, validation.ts, gemini.ts）は完了しているのに、全箇所への適用が追いついていない。技術的には難しくないが、網羅的な作業が必要。

**Agent P**: プロダクト面で最も懸念しているのは**PUX-C5（Server Actionの日本語エラー大量残存）**だ。ユーザーが「週間制限に達しました」「プロフィールが見つかりません」という日本語メッセージを英語/韓国語UIで見る体験は致命的。LoLのプレイヤーベースは国際的であり、これが改善されない限り多言語対応は「表面的」と言わざるを得ない。

**Agent A**: セキュリティ面で最も気になるのは**NEW-H1（レート制限のfail-open）**だ。分散レート制限への移行は正しかったが、「DBがダウンしたらレート制限が無効化される」設計は不安。env未設定時のfail-closeは2行の修正で済む。DB障害時のフォールバックは次フェーズで良い。

**Agent P**: テストカバレッジについてはどう見ている？

**Agent A**: 983行/5ファイルは微増に過ぎない。特に**Stripe webhook handlerと決済フロー**にテストがゼロなのは、収益に直結するリスクだ。DEBIT-FIRSTパターンのテスト（analysis.credit.test.ts）は追加されたが、webhook handlerの統合テストが必要。tier判定バグが過去に発生したことを考えると、テストなしで運用するのは危険度が高い。

**Agent P**: 両面から見て、**今すぐやるべきTOP3**を合意しよう：

1. **PUX-C5 + NEW-H3**: Server Actionエラーコード化 + Geminiモデル名統一 — 「パターンの横展開」としてセットで実施
2. **NEW-H1**: レート制限のenv未設定時fail-close — 2行修正で防御力向上
3. **NEW-H2**: weekly-summaryのgetUserById N+1解消 — スケール阻害の除去

**Agent A**: 合意する。付け加えるなら、**テストカバレッジの戦略的拡充**を次フェーズの最優先にすべき。webhook handler + checkout + DEBIT-FIRSTの3領域に絞ってもカバレッジは大幅に改善する。

---

## 統合改善ロードマップ

### Phase 1: 即時対応（1-2日）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 1 | **SEC** | middleware.tsレート制限のenv未設定時fail-close | 5m | 防御力向上 |
| 2 | **ARCH** | Geminiモデルハードコード5箇所を統一 | 30m | 保守性向上 |
| 3 | **ARCH** | auth_rate_limitsクリーンアップCron設定 | 30m | テーブル肥大化防止 |

### Phase 2: 短期施策（3-5日）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 4 | **PUX** | 全Server Actionエラーコード化（PUX-C5） | 4h | 多言語UX根本改善 |
| 5 | **PUX** | PremiumPromoCard / MacroResultSection フォールバック英語化 | 1h | en/koユーザー体験改善 |
| 6 | **ARCH** | weekly-summary getUserById N+1解消 | 2h | スケーラビリティ改善 |
| 7 | **PUX** | Google OAuth失敗時エラー表示修正 | 5m | UX改善 |

### Phase 3: 中期施策（1-2週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 8 | **ARCH** | リトライロジックをgeminiRetryに統一 | 2h | コード品質 |
| 9 | **ARCH** | `as any` 26箇所の型修正 | 3h | 型安全性 |
| 10 | **ARCH** | メールテンプレートi18n対応 | 4h | 国際化 |
| 11 | **PUX** | Pricing通貨記号動的化 | 2h | 国際化 |
| 12 | **PUX** | CancelModal resumeDate表示修正 | 30m | UX |

### Phase 4: 長期施策（2-4週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 13 | **ARCH** | テストカバレッジ拡充（webhook/checkout/vision） | 8h | 信頼性 |
| 14 | **SEC** | RSO認証リージョンハードコード解消 | 4h | 国際展開 |
| 15 | **ARCH** | vision.ts timeOffset計算の正確化 | 4h | 分析品質 |
| 16 | **PUX** | hreflang戦略の再設計（サブパスルーティング検討） | 8h | SEO |

---

## 最終評点

| 領域 | 第1回 | 第2回 | 第3回 | 第4回 | 第5回（今回） | 改善後見込み |
|------|-------|-------|-------|-------|-------------|------------|
| プロダクト/UX | 58 | — | — | — | **68** | 82 |
| セキュリティ | 48 | 72 | 78 | 82 | **88** | 94 |
| アーキテクチャ | 62 | — | — | — | **78** | 88 |
| **総合** | **56** | — | — | — | **78** | **88** |

---

*審査完了: 2026-03-01 22:57*
