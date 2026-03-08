# LoLCoachAI Elite Review — 2026-03-01 16:02

> 2名のエリートエージェントによる辛口審査レポート（Product/UX + Architecture/Performance/Security）

---

# Part 1: プロダクト / UX 審査

実施日: 2026-03-01
審査官: シニアプロダクトマネージャー（Google/Apple級 Product/UX Expert）

## 総合スコア
現状: **58 / 100**
改善後予測: **78 / 100**

---

## 前回指摘事項の改善状況

| ID | 指摘内容 | 状況 | 詳細 |
|---|---|---|---|
| PUX-C1 | auth-code-error ページが全て英語（i18n未対応） | **未改善** | `src/app/auth/auth-code-error/page.tsx` は全行英語ハードコードのまま。"Authentication Error"、"Authentication failed. Please try again."、"Back to Login" の3テキストが未翻訳。`useTranslation()` すら import されていない。 |
| PUX-C2 | loginPage.loginFailed + result.error で生のエラーメッセージがユーザーに表示 | **未改善** | `src/app/login/page.tsx:79` で `toast.error(t('loginPage.loginFailed') + result.error)` がそのまま残っている。Server Action が返す `result.error` はSupabase SDKのエラー文字列であり、`Invalid login credentials` のような英語の技術メッセージがユーザーに直接表示される。 |
| PUX-H1 | Social Proof（ユーザー数）がハードコード・静的 | **部分改善** | 以前の `500+`、`1000+` は `5,000+`、`87%`、`2.3` にi18nキー化された（`socialProof.stat1Value` 等）。しかしこれらの値は依然としてlocaleファイルにハードコードされた静的文字列であり、実際のDBデータに基づいていない。改善の方向性は正しいが「ハードコード問題」自体は解決していない。 |
| PUX-H2 | VideoMacroAnalysisProvider のエラーメッセージが日本語ハードコード | **部分改善** | 大部分は `t()` 関数に移行されたが、`src/app/providers/VideoMacroAnalysisProvider.tsx:113` で `setStatusMessage("分析完了！")` が日本語ハードコードのまま残っている。en/ko ユーザーにはそのまま日本語が表示される。 |
| PUX-H3 | rsoPasswordBlocked の翻訳キーが en/ko に不足 | **未改善** | `src/app/login/page.tsx:69` で `t('loginPage.rsoPasswordBlocked', 'Riotアカウント連携ユーザーはRSO認証でログインしてください')` として使用されているが、en.json/ko.json のいずれにも `loginPage.rsoPasswordBlocked` キーは存在しない。en/koユーザーにはフォールバックの日本語文が表示される。 |
| PUX-M1 | Bento Grid の数値がダミー（500+, 1000+） | **改善済** | Bento Grid内の数値（87%, 142, 24K等）は分析ダッシュボードのサンプルデータとして使われており、Social Proofのstat値も `5,000+` に更新。ダミー感は軽減された。 |
| PUX-M4 | テスティモニアル5件を3列グリッドで表示するレイアウト問題 | **未改善** | `src/app/components/landing/LandingPageClient.tsx:757-779` で `md:grid-cols-3` に5件のテスティモニアルが配置されている。最後の行に2件のみが配置され、右側に空白スペースが生じるレイアウト崩れは未修正。 |
| PUX-M5 | Googleボタンのローディング状態の不整合 | **未改善** | login では `t('loginPage.initializing')` を使用するが、signup の `src/app/signup/page.tsx:158` では `'...'` という文字列がハードコードされている。i18n化されていない上にUX的にも不統一。 |
| PUX-M6 | %OFF 表示のi18n不足 | **部分改善** | `pricingPage.billing.discount` キーは3言語に存在する。ただし `src/app/pricing/page.tsx:394` と `:502` で年額プランの割引表示が `¥{prices.premiumAnnualMonthly}/月相当 — {prices.premiumDiscount}%OFF` と**日本語テンプレートがハードコード**されたまま。en/koユーザーにも「/月相当」や「%OFF」が日本語で表示される。 |

---

## 新規指摘事項

### CRITICAL（リリースブロッカー）

#### PUX-C3: SEO Metadataが日本語ハードコード — 多言語対応が機能しない
- ファイル: `src/app/page.tsx:5-20`
- 問題: Server Component の `metadata` がすべて日本語でハードコードされている。OGP title は `"LoL Coach AI | AIが導く、次のランクへ"`、description も日本語のみ。Next.js の `generateMetadata` と `alternates.languages` を使った多言語対応がされていない。Google検索で en/ko ユーザーが日本語のタイトル・説明文を見ることになり、海外ユーザーの獲得が事実上不可能になる。
- 改善案: `generateMetadata` で `Accept-Language` ヘッダーまたは cookie から言語を取得し、locale別の metadata を返す。`alternates.languages` で `hreflang` タグを出力する。

#### PUX-C4: Server Action のエラーメッセージが全て日本語ハードコード — 多言語ユーザーに不可解
- ファイル: `src/app/actions/profile.ts:212-253` および `387`
- 問題: サモナー認証フローの全エラーメッセージが日本語ハードコード:
  - `:212` `"アカウント連携は一時的にロックされています。"`
  - `:218` `"認証セッションが無効です。最初からやり直してください。"`
  - `:223` `"認証の有効期限(10分)が切れました。再試行してください。"`
  - `:253` `"認証に3回失敗したため、本日の認証機能をロックしました。"`
  - `:379` `"時間切れのため、認証は失敗扱いとなりました。"`

  さらに `src/app/account/page.tsx:89-91` と `src/app/onboarding/page.tsx:87-89` で `res.error.includes("有効期限")` のように**日本語文字列をcontainsで検索してエラー判定している**。これは Server Action の言語が変わった瞬間にエラーハンドリングが壊れる致命的な設計欠陥。
- 改善案: Server Action はエラーコード（`'SESSION_EXPIRED'`, `'LOCKED'` 等）を返し、クライアント側で `t()` を使って表示用メッセージに変換する。`result.error` の中身で分岐する場合もコードベースで行う。

### HIGH（早急に対応すべき）

#### PUX-H4: Account Page の「Failed Attempts」が英語ハードコード
- ファイル: `src/app/account/page.tsx:255`
- 問題: `<span>Failed Attempts: {candidate.failedCount} / 3</span>` が英語でハードコード。日本語/韓国語ユーザーにとって意味不明。
- 改善案: `t('accountPage.verification.failedAttempts')` キーを3言語に追加し、`{count}` プレースホルダーで置換する。

#### PUX-H5: Onboarding「JP Only」表示のまま — サーバー対応リージョンの実態と乖離
- ファイル: `src/app/onboarding/page.tsx:175`
- 問題: `t('onboardingPage.jpOnly')` が表示されるが、ja.json を確認すると「※ 現在は日本サーバー(JP)のみ対応しています」となっている。Riot API審査を通過すれば他リージョンも対応する可能性があるのに、ハードコードされた制限がユーザーの期待値を下げる。en/koユーザーがアプリを使おうとして最初に見るのがこのメッセージであり、即離脱につながる。
- 改善案: 対応リージョンを動的に管理し、利用可能なリージョン一覧として表示する。

#### PUX-H6: Pricing ページの年額プラン表示に日本語テンプレートが残存
- ファイル: `src/app/pricing/page.tsx:394`, `:502`
- 問題: `¥{prices.premiumAnnualMonthly}/月相当 — {prices.premiumDiscount}%OFF` がJSXに直書き。「/月相当」「%OFF」が翻訳されていないため、en/ko ユーザーには日本語と数字が混在した不自然な表示になる。
- 改善案: `t('pricingPage.billing.annualEquivalent', { price: prices.premiumAnnualMonthly, discount: prices.premiumDiscount })` のように翻訳キーに統合する。

#### PUX-H7: ReferralCard のフォールバックテキストが全て日本語
- ファイル: `src/app/components/subscription/ReferralCard.tsx:30-67`
- 問題: 全ての `t()` 呼び出しに日本語フォールバックが設定されている。キーが欠落した場合にen/koユーザーに日本語が表示される。
- 改善案: en.json/ko.json に全ての `referral.*` キーが存在することを確認。フォールバックには英語を使用するか、フォールバックを使わない設計にする。

#### PUX-H8: AnalyzePage のアップグレードモーダルのフォールバックが日本語
- ファイル: `src/app/analyze/page.tsx:817-835`
- 問題: モーダルの主要テキスト全てに日本語フォールバックが設定されている。翻訳キーが欠落した場合に非日本語ユーザーに日本語が表示される。
- 改善案: localeファイルのキー存在を保証し、フォールバックには英語を使用する。

### MEDIUM（計画的に対応）

#### PUX-M7: テスティモニアルの信頼性 — 架空レビューの問題
- ファイル: `src/locales/ja.json:1026-1035`
- 問題: テスティモニアルが匿名のロールとランクのみで表示されており、実在ユーザーの引用である証拠がない。「勝率が10%以上改善した」という具体的な数値の主張は、裏付けがないと景品表示法に抵触する可能性がある。
- 改善案: 実際のユーザーレビューを収集する仕組みを実装、数値的な効果主張を削除、「※ 個人の感想です」免責事項を追加。

#### PUX-M8: Landing Page のアクセシビリティ不足
- ファイル: `src/app/components/landing/LandingPageClient.tsx`
- 問題: Bento Grid のカードに `role` や見出し階層の整理がない。SVGのレーダーチャートに `aria-label` やテキスト代替がない。Motion animationの `prefers-reduced-motion` 対応がない。テスティモニアル `★` の評価に `aria-label` がない。
- 改善案: WAI-ARIA ランドマーク、見出し階層、`prefers-reduced-motion` メディアクエリを追加。

#### PUX-M9: Onboarding/Account の Timer コンポーネントが重複実装
- ファイル: `src/app/onboarding/page.tsx:262-299`, `src/app/account/page.tsx:357-395`
- 問題: 同一ロジックのTimerコンポーネントが2ファイルに重複して定義されている。表示も微妙に異なりUX不統一。
- 改善案: 共通 `Timer` コンポーネントを `src/app/components/` に切り出す。

#### PUX-M10: DashboardClientPage と DashboardContent の並存 — どちらが正か不明
- ファイル: `src/app/dashboard/components/DashboardClientPage.tsx`, `src/app/dashboard/components/DashboardContent.tsx`
- 問題: 両ファイルがほぼ同一のダッシュボードレイアウトを実装している。リファクタリングの過渡期と思われるが、メンテナンスコストが倍増。
- 改善案: `DashboardContent`（SWR版）に統一し、`DashboardClientPage` を削除する。

#### PUX-M11: Signup ページに利用規約/プライバシーポリシーへの同意確認がない
- ファイル: `src/app/signup/page.tsx`
- 問題: 新規登録フォームに「利用規約に同意する」チェックボックスや同意文言がない。法的リスクが高い。
- 改善案: 登録ボタンの下に利用規約・プライバシーポリシーへのリンクと同意文言を追加。

#### PUX-M12: 広告の表示密度が高すぎる — UX阻害
- ファイル: `src/app/analyze/page.tsx:629-795`
- 問題: Analyzeページに5つの `AdSenseBanner` が存在。メインコンテンツを広告で取り囲む構成は、コンバージョン率を下げる。
- 改善案: 広告を最大2-3箇所に削減。

### LOW（余裕があれば）

#### PUX-L1: Pricing ページ — 通貨が ¥ ハードコード
- ファイル: `src/app/pricing/page.tsx:257,311,390,398` など
- 問題: 全ての価格表示が `¥` でハードコードされている。将来的に多通貨対応する場合にスケールしない。

#### PUX-L2: Landing Page — 特徴セクションのプレビュー画像がアイコンのみ
- ファイル: `src/app/components/landing/LandingPageClient.tsx:658-662, 690-694`
- 問題: `aspect-video` の領域にアイコン1つのみが表示。実際のスクリーンショットやデモ動画がない。

#### PUX-L3: Login/Signup の入力値が `value` prop なし（Login）/ あり（Signup）の不統一
- ファイル: `src/app/login/page.tsx:143,157` vs `src/app/signup/page.tsx:175,189,203`
- 問題: Login は非制御コンポーネント寄り。Signup は制御コンポーネント。実装パターンが不統一。

#### PUX-L4: LanguageSwitcher の位置がページごとに不統一
- 問題: Login/Signup/Onboarding では右上に absolute 配置、Dashboard では SidebarNav 内、LP ではナビゲーションバー内。認知負荷が高い。

---

## 改善ロードマップ（優先順位付き）

### Phase 1: リリースブロッカー修正（1-2日）
1. **PUX-C4**: Server Action のエラーをコードベースに変更し、`res.error.includes("日本語")` パターンを全て撲滅
2. **PUX-C1（前回未改善）**: auth-code-error ページにi18n対応を追加
3. **PUX-C2（前回未改善）**: login のエラー表示を `t()` キーベースに変更
4. **PUX-C3**: SEO metadata を多言語対応（`generateMetadata` + `hreflang`）

### Phase 2: HIGH 優先修正（3-5日）
5. **PUX-H3（前回未改善）**: en.json/ko.json に `loginPage.rsoPasswordBlocked` 翻訳追加
6. **PUX-H2（前回残存）**: VideoMacroAnalysisProvider の `"分析完了！"` を `t()` に置換
7. **PUX-H4**: Account Page の「Failed Attempts」を翻訳
8. **PUX-H6**: Pricing の年額プラン表示をi18nキーに統合
9. **PUX-H7**: ReferralCard のフォールバックを英語に変更
10. **PUX-H8**: AnalyzePage のアップグレードモーダルフォールバックを英語化
11. **PUX-H5**: Onboarding のリージョン表示を改善

### Phase 3: MEDIUM 改善（1-2週間）
12. **PUX-M11**: Signup に利用規約同意を追加
13. **PUX-M5（前回未改善）**: Signup の Google ボタンローディング表示を `t()` に統一
14. **PUX-M4（前回未改善）**: テスティモニアル表示を6件にするか可変レイアウトに変更
15. **PUX-M10**: DashboardClientPage/DashboardContent を統合
16. **PUX-M9**: Timer コンポーネントの共通化
17. **PUX-M12**: Analyze ページの広告密度を削減
18. **PUX-M6（前回部分改善）**: Pricing の全ての `%OFF` 表示をi18nキーに移行

### Phase 4: 品質向上（継続的）
19. **PUX-M7**: テスティモニアルの信頼性向上
20. **PUX-M8**: アクセシビリティ改善
21. **PUX-H1（前回部分改善）**: Social Proof 数値をDB連動に変更
22. **PUX-L1-L4**: 低優先度の統一・改善タスク

---

## 総評

LoLCoachAIは、LoLプレイヤー向けAIコーチングという独自性のあるプロダクトであり、機能の幅は競合に対して十分な差別化が図れている。SWRによるデータキャッシュ、dynamic importによるバンドル最適化など、技術的な品質は着実に向上している。

しかし、最も深刻な問題は**i18n（多言語対応）の根本的な不完全さ**である。UIの `t()` 関数による翻訳は進んでいるものの、(1) Server Action のエラーメッセージが日本語ハードコード、(2) それを `includes("日本語")` でパターンマッチングしているという設計上の地雷、(3) フォールバックが全て日本語、(4) SEO metadata が日本語固定 — という状態では、「3言語対応」を謳うのは過大広告に近い。en/ko ユーザーにとっては日本語が頻出する「壊れた」体験となる。

前回指摘事項9件のうち、完全に改善済みは1件（PUX-M1）のみ。未改善4件、部分改善4件であり、改善のペースに懸念がある。

---
---

# Part 2: アーキテクチャ / パフォーマンス / セキュリティ 審査

実施日: 2026-03-01
審査官: シニアソフトウェアアーキテクト（Netflix/Meta級 Architecture/Performance/Security Expert）

## 総合スコア
現状: **62 / 100**
改善後予測: **82 / 100**

---

## 前回指摘事項の改善状況

| ID | 指摘内容 | 状況 | 詳細 |
|---|---|---|---|
| ARCH-H1 | Route Handler内の getUser() が未キャッシュ | **改善済** | `src/utils/supabase/server.ts:42` で `React.cache()` によるリクエスト単位の重複排除を実装。ただし Route Handler での `supabase.auth.getUser()` 直呼びが `checkout/route.ts:12`, `billing/route.ts:13`, `chat/route.ts:25` に残存しており、`getUser` を使っていない箇所がある。 |
| ARCH-H2 | supabase の型が `any`（webhook route等） | **未改善** | `src/app/api/webhooks/stripe/route.ts:79,163,204,222,309` の全5つのハンドラ関数が依然として `supabase: any` を受け取っている。 |
| PERF-H1 | LandingPageClient.tsx が840行超で分割不足 | **未改善** | `src/app/components/landing/LandingPageClient.tsx` は依然として840行。HeavyEffects.tsx（140行）のみ分離。 |
| SEC-H1 | RSO認証でリージョンが jp1 にハードコード | **未改善** | `src/app/api/auth/callback/riot/route.ts:192` で `https://jp1.api.riotgames.com/...` がハードコード。`src/app/actions/riot/constants.ts:7` でも `PLATFORM_ROUTING = "jp1"` が定数。グローバル展開不可能。 |
| ARCH-M1 | DEBIT-FIRST パターンのリファンドが非アトミック | **部分改善** | `vision.ts:651-658` ではリファンドにDB RPCを使用しているが、`matchAnalysis.ts:208-218` ではPremiumユーザーに対するリファンドがスキップされている。一貫性が欠けている。 |
| ARCH-M2 | matchAnalysis のロジック重複 | **改善済** | `analysis/` サブディレクトリに分割。`coach.ts`, `riot.ts`, `videoMacroAnalysis.ts` も同様にバレルファイル化。モジュール構造が大幅に改善。 |
| ARCH-M3 | メールHTMLがハードコード | **部分改善** | `buildTrialReminderHtml` 関数に分離されたが、メール本文は依然として日本語ハードコードのみ。i18n対応なし。テンプレートエンジン未使用。 |
| SEC-M1 | sessionParams が any 型 | **未改善** | `src/app/api/checkout/route.ts:173` で `const sessionParams: any = {` が残存。 |
| PERF-M1 | MouseFollowGlow の不要な再レンダリング | **部分改善** | `HeavyEffects.tsx` に分離されているが、本体ロジックの最適化は未完了の可能性。 |
| テストカバレッジ | **未改善** | テストファイルは依然として4ファイル、計853行。ビジネスクリティカルなStripe webhook、認証フロー、Gemini API統合のテストが皆無。 |
| サーバーサイドレート制限がインメモリ | **未改善** | `src/middleware.ts:7` で `const rateLimitMap = new Map<>()` を使用。Vercelのサーバーレス環境ではインスタンス間でメモリ非共有。 |
| Gemini APIキーの正規表現バリデーション不足 | **改善済** | `src/lib/gemini.ts:47` で `GEMINI_KEY_RE` が実装され、`isValidGeminiApiKey` 関数が全エントリポイントで使用されている。 |
| Sentry eventID のユーザー露出 | **部分改善** | `ErrorBoundaryTemplate` を使用。ただし `ErrorBoundaryTemplate.tsx:50-53` で本番環境でもeventIdを表示している。dev環境限定にすべき。 |

---

## 新規指摘事項

### CRITICAL（リリースブロッカー）

#### SEC-C1: ゲスト分析でServer Actionに巨大なBase64画像ペイロードを直接受け入れ、Zodバリデーション未適用
- ファイル: `src/app/actions/guestAnalysis.ts:347-571`
- 問題: `performGuestAnalysis` はServer Actionとして公開されているが、受け取る `GuestAnalysisRequest` のフレームデータ（Base64文字列）に対してZodスキーマバリデーションが適用されていない。`src/lib/validation.ts` に `structuredFrameSchema` や `framesArraySchema` が定義されているが、このServer Actionでは使用されていない。任意のユーザーが巨大なペイロードを送信してサーバーリソースを枯渇させるDoS攻撃が可能。
- 改善案: 入力バリデーションスキーマを適用し、フレームサイズ・数・MIMEタイプをZodで制約する。

#### SEC-C2: guestCredits.tsがService Roleクライアントを使用してIP単位でDB操作し、認証なしでRPC呼び出し可能
- ファイル: `src/app/actions/guestCredits.ts:53,100`
- 問題: `getGuestCreditStatus` と `useGuestCredit` はService Roleクライアント（RLSバイパス）を使用し、IP由来のパラメータでRPCを呼び出している。`x-forwarded-for` はプロキシ未設定時にクライアントが偽装可能。
- 改善案: (1) Vercel環境でのみ `x-real-ip` / `cf-connecting-ip` を信頼し、fallback時はfail-closedにする。(2) RPCパラメータのバリデーション追加。(3) Turnstileトークン検証を入口で必須化する。

#### SEC-C3: matchService.tsに到達不能な重複return文（Dead Code）
- ファイル: `src/services/matchService.ts:154,156`
- 問題: 行154と行156に `return { matches, logs };` が2回連続で記述されている。行156は到達不能コード。リファクタリングミス。
- 改善案: 行156の重複returnを削除する。

---

### HIGH（早急に対応すべき）

#### ARCH-H1: Webhook handler全関数で supabase: any が継続
- ファイル: `src/app/api/webhooks/stripe/route.ts:79,163,204,222,309`
- 問題: 前回指摘から未改善。`supabase: any` ではTypeScriptの型安全性が完全に無効化される。
- 改善案: `supabase/types.ts` を生成し、Service Roleクライアントの戻り値型を明示する。

#### ARCH-H2: Chat APIでGeminiキーをモジュールスコープで`!`アサーション
- ファイル: `src/app/api/chat/route.ts:8`
- 問題: `const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;` でnon-null assertionを使用。環境変数が未設定の場合、undefinedが渡される。
- 改善案: `!` を除去し、関数内で明示的にnullチェックする。

#### SEC-H1: プラン切替時のクーポン作成にレースコンディション
- ファイル: `src/app/api/checkout/route.ts:96-156`
- 問題: 既存サブスクリプション検証からクーポン作成までが非アトミック。同時リクエストで二重割引が発生する可能性。
- 改善案: チェックアウト開始時にDBにロックレコードを作成し、重複リクエストを排除。

#### SEC-H2: RSOコールバックでSummoner V4がjp1ハードコードのまま
- ファイル: `src/app/api/auth/callback/riot/route.ts:192`
- 問題: Riot審査でグローバルキーが承認された場合、JP以外のプレイヤーがRSOログインするとSummoner V4が404を返し、サモナー登録が失敗する。
- 改善案: `PLATFORM_ROUTING` 定数を使用するか、RSOレスポンスからリージョンを推定するロジックを実装。

#### PERF-H1: guestAnalysis.tsが961行の巨大ファイル
- ファイル: `src/app/actions/guestAnalysis.ts` (961行)
- 問題: マクロ分析とミクロ分析が1ファイルに混在。プロンプト生成、リトライロジック、結果処理が重複。
- 改善案: `guestAnalysis/macro.ts`, `guestAnalysis/micro.ts`, `guestAnalysis/shared.ts` に分割。

#### ARCH-H3: vision.tsにおけるDEBIT-FIRST + after()の組み合わせリスク
- ファイル: `src/app/actions/vision.ts:186-196,230-241,648-658`
- 問題: DEBITが `after()` 内で行われるため、コールドスタートやタイムアウトで `after()` が実行されない場合、クレジット消費も分析完了もされないゾンビジョブとなる。
- 改善案: DEBIT を `after()` の前で行い、失敗時にリファンド。または、cronジョブでゾンビジョブをクリーンアップする。

---

### MEDIUM（計画的に対応）

#### ARCH-M1: checkoutRoute.tsのsessionParams: any（前回指摘から未修正）
- ファイル: `src/app/api/checkout/route.ts:173`
- 問題: `Stripe.Checkout.SessionCreateParams` 型を使用すべき。

#### ARCH-M2: stats.tsが924行の巨大ファイル
- ファイル: `src/app/actions/stats.ts` (924行)
- 問題: 5つの異なる責務が1ファイルに混在。他のactionファイルはバレルファイル+サブディレクトリに分割済みだが、stats.tsだけ旧形式。
- 改善案: `stats/rankHistory.ts`, `stats/matchStats.ts`, `stats/profileEnhanced.ts`, `stats/rankGoal.ts` に分割。

#### ARCH-M3: Geminiモデルフォールバックリストが3箇所で不整合
- ファイル: `chat/route.ts:61`, `guestAnalysis.ts:861-866`, `vision.ts:298-303`, `matchAnalysis.ts:144`
- 問題: モデルフォールバックリストがファイルごとに異なる。`gemini-1.5-pro` は高コスト。
- 改善案: `src/lib/gemini.ts` に `MODELS_TO_TRY` 定数をエクスポートし、全箇所で参照する。

#### SEC-M1: verifyAndAddSummonerの入力が型なし（any）
- ファイル: `src/app/actions/profile.ts:196`
- 問題: `verifyAndAddSummoner(summonerData: any)` でServer Actionの入力がany型。
- 改善案: Zodスキーマで入力をバリデーション。

#### SEC-M2: Sentry eventIDが本番環境でもユーザーに表示
- ファイル: `src/app/components/ErrorBoundaryTemplate.tsx:50-53`, `src/app/dashboard/coach/error.tsx:39-43`
- 改善案: `process.env.NODE_ENV === "development"` の条件分岐内に移動。

#### PERF-M1: LandingPageClient.tsxが840行で未分割
- ファイル: `src/app/components/landing/LandingPageClient.tsx` (840行)
- 問題: Hero、Features、Pricing、FAQ等が1コンポーネント内。
- 改善案: セクションごとに分割し、Fold以下を遅延ロード。

#### ARCH-M4: updatePayloadがany型
- ファイル: `src/app/actions/stats.ts:435`

#### ARCH-M5: Route Handlerでsupabase.auth.getUser()を直接呼び出し
- ファイル: `checkout/route.ts:10-12`, `billing/route.ts:10-13`, `chat/route.ts:24-25`
- 問題: `getUser` ヘルパーを使わず直接呼び出している。
- 改善案: Route Handlerでも `getUser()` ヘルパーを使用する。

---

### LOW（余裕があれば）

#### ARCH-L1: リトライロジックの重複
- ファイル: `guestAnalysis.ts:466-485`, `vision.ts:309-312,600-609`, `videoMacro/asyncJob.ts:27-45`
- 問題: exponential backoff + retry ロジックが3箇所以上で個別実装。
- 改善案: `src/lib/retry.ts` にユーティリティ関数を作成。

#### ARCH-L2: matchService.tsでemoji入りログメッセージ
- ファイル: `src/services/matchService.ts:99,106,116,118`

#### ARCH-L3: profile.tsのverifyAndAddSummonerでリージョンがJP1固定
- ファイル: `src/app/actions/profile.ts:272`

#### PERF-L1: fetchAndCacheMatchesでチャンクサイズ8の並列リクエスト
- ファイル: `src/services/matchService.ts:68`
- 問題: Riot APIのレート制限に抵触するリスク。

#### SEC-L1: buildTrialReminderHtmlにXSSリスク
- ファイル: `src/app/api/webhooks/stripe/route.ts:269-307`
- 問題: `${name}` と `${trialEnd}` がHTMLテンプレートに直接挿入されている。

#### ARCH-L4: テストカバレッジの絶対的不足
- ファイル: テストディレクトリ全体
- 問題: 4ファイル853行のみ。カバレッジ率5%程度。Stripe Webhook、RSO認証、Gemini API統合のテストが皆無。
- 改善案: 最低限、Webhookハンドラ、認証コールバック、クレジット消費のe2eテストを追加。目標カバレッジ30%以上。

---

## 改善ロードマップ（優先順位付き）

### Phase 1: セキュリティ（1-2週間）
1. **SEC-C1**: guestAnalysis.tsにZodバリデーション適用
2. **SEC-C2**: guestCreditsのIP取得をVercel信頼ヘッダーに限定 + Turnstile必須化
3. **SEC-H1**: Checkoutの二重クーポン作成防止（冪等性キー導入）
4. **SEC-M1**: verifyAndAddSummonerにZodバリデーション追加
5. **SEC-M2**: Sentry eventIDを開発環境限定に

### Phase 2: 型安全性 + コード品質（2-3週間）
6. **ARCH-H1**: Webhook handler全関数にSupabase型付け
7. **ARCH-H2**: chat/route.tsの `GEMINI_API_KEY!` アサーション修正
8. **SEC-C3**: matchService.tsの重複return削除
9. **ARCH-M1**: checkout sessionParamsに `Stripe.Checkout.SessionCreateParams` 型適用
10. **ARCH-M3**: Geminiモデルフォールバックリストを集約
11. **ARCH-M5**: Route Handlerで `getUser()` ヘルパーを使用

### Phase 3: アーキテクチャ改善（3-4週間）
12. **PERF-H1**: guestAnalysis.tsを分割
13. **ARCH-M2**: stats.tsを分割
14. **PERF-M1**: LandingPageClient.tsxをセクション単位で分割
15. **ARCH-H3**: vision.tsのDEBIT-FIRSTをafter()の外に移動 + ゾンビジョブcron追加
16. **ARCH-L1**: リトライユーティリティの共通化

### Phase 4: テスト + 国際化（4-6週間）
17. **ARCH-L4**: 統合テスト追加（目標カバレッジ30%）
18. **SEC-H2 + ARCH-L3**: リージョンの動的化
19. **ARCH-M3 (メール)**: メールテンプレートのi18n対応
20. インメモリレート制限の外部化（Vercel KVまたはUpstash Redis）

---

## 総評

前回審査からの改善は確実に見られる。特に以下の点は高く評価する:

1. **getUser()のReact.cacheによるリクエスト内重複排除** — 認証コストの最適化として正しいアプローチ
2. **Zodバリデーションの体系的導入** (`src/lib/validation.ts`) — 基盤は整っている
3. **バレルファイルパターンによるモジュール分割** — `analysis/`, `coach/`, `riot/`, `videoMacro/` の構造化は優秀
4. **DB RPCによるアトミック操作** — `increment_weekly_count`, `refresh_analysis_status`, `claim_webhook_event` 等
5. **CSP nonce-basedポリシーの実装** — 本格的なCSP
6. **Gemini APIキーバリデーションの追加** — `isValidGeminiApiKey` の全箇所適用
7. **Webhook冪等性チェック** — `claim_webhook_event` RPCによるDB冪等性

しかし、以下の領域は依然として深刻:

- **型安全性**: `any` の使用が多すぎる。TypeScriptを使う意味が半減している
- **テストカバレッジ**: 5%程度では「動いているから大丈夫」レベル。課金ロジックにテストがないのは商用サービスとして許容できない
- **コードの巨大ファイル**: guestAnalysis.ts (961行)、stats.ts (924行)、LandingPageClient.tsx (840行) が未分割
- **リージョンのハードコード**: JP限定のままではRiot審査でグローバルキーを取得しても使えない

62点は「個人プロジェクトとしては頑張っている、商用サービスとしてはまだ不十分」のライン。Phase 1-2の改善で70点台、Phase 3-4まで完了すれば80点超が見込める。
