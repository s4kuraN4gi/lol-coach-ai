# LoLCoachAI エリート辛口審査 — プロダクト/UX & アーキテクチャ/パフォーマンス（第2回）

## 審査日: 2026-03-02 18:19
## 審査者:
- **Agent P（プロダクト/UX専門）**: 元Google / Apple / Spotifyプロダクトデザインチーム出身、B2C SaaS/ゲーミングアプリUX審査300件超
- **Agent A（アーキテクチャ/パフォーマンス専門）**: 元Netflix / Metaシニアスタッフエンジニア、大規模Next.jsアーキテクチャレビュー200件超

---

# 前回審査（第1回 2026-03-02 02:01）からの改善状況

## Agent P（プロダクト/UX）: 改善状況

| 前回ID | 内容 | 改善状況 | 詳細 |
|--------|------|---------|------|
| P-C1 | Chatページモバイル完全崩壊 | **改善済** | サイドバーが`fixed inset-y-0 left-0 z-40 w-72 -translate-x-full`でモバイル非表示化。オーバーレイ+ハンバーガーボタン追加。lg:でstatic表示に切替 |
| P-C2 | オンボーディングにスキップ導線なし、JP限定制約埋没 | **改善済** | 「スキップしてダッシュボードを見る」ボタン追加。JP限定がamber警告バナーとして目立つ位置に配置。3言語翻訳完備 |
| P-H1 | LPに実プロダクト画面/デモ動画不在 | **未改善** | HeroSectionは依然SVGモックとカウンター。FeaturesSection もアイコンプレースホルダーのみ |
| P-H2 | オンボーディングにステップUI不足 | **部分改善** | step state (1/2) の2段階が存在するが、ステッププログレスバー（1/2, 2/2のインジケーター）は未実装 |
| P-H3 | サイドバーラベルと遷移先不一致 | **改善済** | `coach`="マッチ分析"→`/dashboard/coach`、`chat`="AIチャット"→`/chat`。整合 |
| P-H4 | Stripe決済成功後フィードバック皆無 | **改善済** | checkout=success検知→syncSubscriptionStatus→アップグレード成功モーダル表示 |
| P-H5 | 価格表示がJPY(¥)固定 | **未改善** | ¥がハードコード（6箇所）。Stripeから通貨情報取得しているがUI未反映 |
| P-M1 | ウェルカムモーダルにフィーチャーツアーなし | **部分改善** | Pricing CTA追加済み。フィーチャーツアー自体は未実装 |
| P-M2 | Analyzeページ広告4箇所 | **改善済** | 3箇所に削減 |
| P-M3 | 分析結果CTA4箇所（CTA疲れ） | **部分改善** | showUpgradeCTA条件付き表示。ただし常設リンク残存 |
| P-M4 | focus-visibleリング10箇所のみ | **改善済** | `globals.css`にグローバル`:focus-visible`ルール追加 |
| P-M5 | i18n英語漏洩（LOLE typo含む） | **改善済** | LOLE typo除去、sidebarキー3言語整合 |
| P-M6 | 比較表i18nキー交差参照 | **未改善** | guest/freeキーをPremium/Extraカードで引き続き交差使用 |
| P-M7 | ダッシュボード空状態ガイダンス不足 | **部分改善** | noData/noDataDescテキスト表示あり。アクション誘導リンクは未実装 |

## Agent A（アーキテクチャ/パフォーマンス）: 改善状況

| 前回ID | 内容 | 改善状況 | 詳細 |
|--------|------|---------|------|
| A-C1 | coach/analyze.ts geminiRetry未適用 + 非原子的refund | **改善済** | geminiRetry適用（L303）。refundは`decrement_weekly_count` RPCで原子化。DEBIT-FIRSTパターンに移行 |
| A-C2 | テストカバレッジ致命的不足（5ファイル） | **部分改善** | 7ファイル139テスト+E2E 11テスト。Stripe webhook(33件)/checkout(22件)追加。ただしコアAI分析のユニットテストは依然ゼロ |
| A-H1 | 分析リミットロジック3パターン混在 | **改善済** | weeklyに統一。`getWeeklyLimit()`で一元管理 |
| A-H2 | `any`型103箇所 | **悪化** | 103→238箇所に2.3倍増加。新規コード追加分が型安全性なし |
| A-H3 | weekly-summary cron listUsers()二重呼出 | **改善済** | emailMap構築で1回走査に統合 |
| A-H4 | SWR経由Server Action不要オーバーヘッド | **部分改善** | SSR prefetch+SWR fallbackDataパターン適用。冗長ラッパーは残存 |
| A-H5 | framer-motion/recharts/react-icons Tree Shaking | **未改善** | react-icons/gi（7000+アイコン）が2ファイルで使用。rechartsは1ファイルのみ（改善） |
| A-M1 | createClient()冗長呼出50回 | **部分改善** | 66箇所に増加。getUser()はcacheデデュプ済 |
| A-M2 | Edge Runtime未活用 | **未改善** | `runtime = 'edge'`宣言0箇所 |
| A-M3 | force-dynamic濫用 | **部分改善** | 7箇所に削減、正当な使用が大半 |
| A-M4 | matchService.ts Retry-After無視 | **部分改善** | Gemini用retry.tsにRetry-After実装済。Riot API側は固定5秒バックオフのまま |
| A-M5 | vision.ts 650行モノリス | **悪化** | 650→763行に増加 |
| A-M6 | hreflang未設定 | **未改善** | alternates.languages未設定 |
| A-M7 | RootLayout Provider入れ子 | **改善済** | 4層、Next.js標準パターン内 |

---

# 議論パート: Agent P × Agent A

## 開会所感

**Agent P**: 前回52点から62点への+10ポイント改善を確認した。特にCRITICAL 2件（Chatモバイル崩壊、オンボーディングスキップ導線なし）の完全解消は評価する。しかし、新たにCRITICAL 1件（Chatの「新しいチャット」ハードコード日本語）を発見した。これはen/koユーザー全員のチャット体験を壊す致命的バグだ。また、LPの実プロダクト画面不在（P-H1）と価格のJPY固定（P-H5）が2回連続で未改善のまま残っている。

**Agent A**: 前回62点から66点への+4ポイント改善。Stripe周辺のテストカバレッジ向上（5→7ファイル、テスト数大幅増）は堅実な改善。しかし、新規CRITICALとして`videoMacro/analyze.ts`のCREDIT-AFTERパターン（課金バイパス可能）を発見した。前回のA-C1（coach/analyze.ts）は修正されたが、同じパターンが別ファイルに残存していた。また、`any`型が103→238箇所に2.3倍悪化しているのは深刻な技術的負債の蓄積だ。

## クロスドメイン議論

**Agent P**: アーキテクチャ側に確認したい。`analyzeVideo → analyzeMatchTimeline` の二重クレジット消費問題（A-H4）は、UX面でも致命的だ。Freeユーザーが週3回の枠で分析したら、実質1.5回しか使えないことになる。ユーザーは「3回使えると思ったのに2回で終わった」と感じる。これはChurn直結の信頼崩壊だ。

**Agent A**: 同意する。さらにプロダクト側の「LP実画面不在」は、アーキテクチャ的にもバンドルサイズに影響する。現在のHeroSectionはSVGモック+Framer Motionの重いパーティクルアニメーションで構成されている。実際のプロダクトスクリーンショット（next/image + WebP最適化）に置き換えれば、JSバンドルが軽くなり、LCPも改善し、CVRも向上する。三方よしだ。

**Agent P**: テストの話に移りたい。E2Eテスト11件は初期段階として良い。しかし全て「ページロード確認」「要素存在確認」で止まっている。ユーザージャーニーのE2E（ログイン→分析→結果閲覧）がない。プロダクト品質保証の観点からは、最低限ログインフローのhappy pathテストが必要だ。

**Agent A**: 技術的に補足すると、Supabaseのtest環境とStripeのtest modeを組み合わせれば、認証→分析→課金のフルパスE2Eが可能だ。ただし環境セットアップの工数が大きいので、まずは「ログイン→ダッシュボード遷移」の1テストから始めるのが現実的だ。

**Agent P**: `any`型238箇所の問題は、UX面でも間接的に影響する。Riot APIの構造変更があった場合、型チェックが効かないので実行時にundefined参照でクラッシュする。ユーザーが分析結果ページで白画面を見ることになり、最悪のUXだ。

**Agent A**: vision.tsが763行のモノリスで`any`が14箇所あるのが典型。型定義はriot/types.tsに一部存在するが、使われていない。テスト可能性とも直結するので、ディレクトリ分割と型適用は並行して進めるべきだ。

**Agent P**: 最後に、前回指摘したアクセシビリティ問題について。focus-visibleリングのグローバル適用（P-M4）は改善されたが、sr-only テキスト、aria属性、コントラスト比の問題は新たに発見した。WCAG AA準拠にはまだ距離がある。

**Agent A**: CSSレベルの一括対応は完了したが、セマンティックHTML（aria-labelledby, aria-expanded等）の個別対応が残っている。これは1ファイルずつの地道な作業になる。

---

# Part 1: プロダクト/UX審査（Agent P）

## スコアリング

| カテゴリ | 前回スコア | 今回スコア | 改善後見込み |
|---------|-----------|-----------|------------|
| オンボーディングフロー | 58 | **72** | 82 |
| 機能発見性 | 45 | **52** | 70 |
| 転換ファネル設計 | 62 | **68** | 80 |
| 解約防止/リテンション | 60 | **70** | 80 |
| エラー表示/フィードバック | 72 | **78** | 85 |
| 多言語品質 | 55 | **62** | 78 |
| モバイルUX | 35 | **65** | 80 |
| アクセシビリティ | 28 | **48** | 68 |
| LP CVR最適化 | 55 | **56** | 75 |
| ダッシュボード情報設計 | 60 | **64** | 78 |
| 競合機能ギャップ | 50 | **52** | 68 |

### 総合スコア: 62/100（前回: 52/100、改善後見込み: 77/100）

前回比 **+10pt**。CRITICAL 2件の解消（Chatモバイル対応、スキップ導線追加）が最大の改善要因。モバイルUX が 35→65 と最も大きく改善。LP CVR最適化（実画面不在）とアクセシビリティが依然として足を引っ張っている。

---

## CRITICAL問題（1件）

### P-C1 (NEW): Chatページ「新しいチャット」ハードコード日本語文字列

- **対象ファイル**: `src/app/chat/page.tsx` L222
- **問題**: `selectedSession.title === "新しいチャット"` がハードコードされている。en/koユーザーのセッションタイトルは `t('chatPage.newChatTitle')` で各言語の文字列になるため、この比較は常にfalse。結果、en/koユーザーのチャットタイトルが最初のメッセージで自動更新されない。
- **影響**: 英語・韓国語ユーザー全員のチャット体験が壊れる。セッション一覧がデフォルトタイトルのまま蓄積し、区別不能。
- **改善案**: `selectedSession.title === t('chatPage.newChatTitle')` に変更（1行修正）

---

## HIGH問題（5件）

### P-H1 (残存): LPに実プロダクト画面/デモ動画が不在

- **対象ファイル**: `src/app/components/landing/sections/HeroSection.tsx`, `FeaturesSection.tsx`
- **問題**: SVGモックレーダーチャート、テキストベースAIチャットプレビュー、ハードコードカウンター数値のみ。実際のダッシュボード画面やAI分析結果のスクリーンショットが一切ない。FeaturesSection の `aspect-video bg-black/50` にアイコンのみ。
- **影響**: B2C SaaSのLP最重要CVRレバー欠如。何に登録するか視覚的に伝わらない。
- **改善案**: ダッシュボード・AI分析結果・チャット画面の実スクリーンショット（WebP最適化）を`public/images/`に配置し、Hero Bento Grid内に`<Image>`で配置

### P-H2 (残存): 価格表示がグローバルにJPY(¥)固定

- **対象ファイル**: `src/app/pricing/page.tsx` L266, L320, L399, L409, L514, L524
- **問題**: `¥` がハードコード。en/koユーザーにもJPYで表示。Stripe APIは通貨情報を返すがUI未反映。
- **影響**: 非日本語ユーザーが通貨を理解できず、CVR低下。
- **改善案**: `getStripePrices`に`currency`フィールド追加、`Intl.NumberFormat`で通貨記号動的フォーマット

### P-H3 (NEW): Login/Signupのstate変数名が非セマンティック＋不整合

- **対象ファイル**: `src/app/login/page.tsx` L17, `src/app/signup/page.tsx` L13
- **問題**: LoginPageは`LoginId`（PascalCase）、SignupPageは`LoginID`（全大文字）。メールアドレス入力なのに`Login`名。ファイル間で命名不一致。
- **影響**: 保守性低下。PascalCase変数がReactコンポーネントと誤認される可能性。
- **改善案**: 両ファイルで`email` / `setEmail`に統一

### P-H4 (NEW): パスワード強度インジケーター完全欠如

- **対象ファイル**: `src/app/signup/page.tsx`
- **問題**: 8文字以上バリデーションのみ。リアルタイム強度フィードバック（弱/中/強）が存在しない。
- **影響**: 弱パスワード設定リスク。登録フローでの不安増加。
- **改善案**: 自前チェックまたはzxcvbnで強度バー（赤/黄/緑）をリアルタイム表示

### P-H5 (NEW): Welcome/UpgradeSuccessモーダルにフィーチャーツアーへの導線なし

- **対象ファイル**: `src/app/dashboard/components/DashboardContent.tsx` L285-318
- **問題**: 3選択肢（Start AI Coaching / View Plans / View Dashboard）のみ。初回ユーザーが各ウィジェット（SkillRadar, WinCondition, Nemesis等）の意味を理解するガイダンスが不在。
- **影響**: 機能発見性が低く、Premium機能の価値が伝わらない。アップグレード率低下。
- **改善案**: react-joyride等でWelcomeモーダルから3-5ステップのフィーチャーツアー起動

---

## MEDIUM問題（7件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| P-M1 | WelcomeとUpgradeSuccessモーダルの同時表示防御なし | DashboardContent.tsx | `?welcome=1&checkout=success`で2つ重なる。排他制御追加 |
| P-M2 | 比較表i18nキー交差参照（残存） | pricing/page.tsx | 共通機能を`pricingPage.shared.*`に移動 |
| P-M3 | sr-only/visually-hidden未使用 | 全体 | アイコンのみボタンに`<span className="sr-only">`追加 |
| P-M4 | aria-label/aria-modal不足 | 複数モーダル | 全モーダルに`role="dialog" aria-modal="true"`追加。FAQに`aria-expanded`追加 |
| P-M5 | Analyzeページ広告がモバイルでコンテンツ圧迫 | analyze/page.tsx | モバイルでTop Ad非表示（`hidden sm:flex`） |
| P-M6 | ダッシュボードウィジェット空状態にアクション導線なし | widgets/配下 | 「データを更新」ボタン + 「マッチ分析を試す」リンク追加 |
| P-M7 | color-contrast問題（`text-slate-500` on dark bg = 3.2:1） | 全体 | `text-slate-500`→`text-slate-400`に全体アップグレードで4.5:1確保 |

---

## LOW問題（5件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| P-L1 | prefers-reduced-motionがCSS限定（Framer Motion JS未対応） | globals.css, Landing | `useReducedMotion()`でFramer Motionのanimate無効化 |
| P-L2 | Chat textarea rows={1}+resize-none でモバイル長文入力困難 | chat/page.tsx | auto-resizeロジック追加 |
| P-L3 | SocialProofテスティモニアルが全て5つ星でバリエーションなし | SocialProofSection.tsx | 4-5星のバリエーション + レビュー日時追加 |
| P-L4 | Pricing FAQ アコーディオンにアニメーションなし | pricing/page.tsx | max-height + transition でスムーズ展開 |
| P-L5 | CancelConfirmModal Pauseオプションが解約理由と連動しない | CancelConfirmModal.tsx | selectedReasonに応じてPause/割引/フィードバックフォーム出し分け |

---

# Part 2: アーキテクチャ/パフォーマンス審査（Agent A）

## スコアリング

| カテゴリ | 前回スコア | 今回スコア | 改善後見込み |
|---------|-----------|-----------|------------|
| Server/Client分割 | 68 | **72** | 82 |
| データフェッチパターン | 72 | **76** | 85 |
| 認証フロー | 78 | **82** | 88 |
| Stripe連携 | 80 | **86** | 92 |
| エラーハンドリング | 65 | **75** | 85 |
| コード責務分離 | 70 | **70** | 80 |
| 型安全性 | 55 | **48** | 75 |
| テストカバレッジ | 25 | **42** | 70 |
| バンドルサイズ | 62 | **62** | 78 |
| API呼び出し効率 | 68 | **74** | 85 |
| SSR/Edge活用 | 40 | **45** | 70 |
| CDN/Caching戦略 | 60 | **64** | 78 |

### 総合スコア: 66/100（前回: 62/100、改善後見込み: 81/100）

前回比 **+4pt**。Stripe連携（80→86）とテストカバレッジ（25→42）が最大の改善。型安全性は55→48と**悪化**（`any`型が2.3倍に増加）。コード責務分離は未改善（vision.tsが650→763行に膨張）。

---

## CRITICAL問題（2件）

### A-C1 (NEW): videoMacro/analyze.ts のCREDIT-AFTERパターン — 課金バイパス可能

- **対象ファイル**: `src/app/actions/videoMacro/analyze.ts` L195-197, `src/app/actions/videoMacro/asyncJob.ts` L275-277
- **問題**: `analyzeVideoMacro()`はAI分析成功後にのみ`increment_weekly_count`を呼ぶ（CREDIT-AFTERパターン）。他の全分析関数はDEBIT-FIRST（先にカウント消費→失敗時refund）に移行済みだが、このファイルだけが旧パターン。AI分析成功→DB更新失敗でクレジット未消費のまま結果返却。
- **影響**: 繰り返し悪用で無制限分析が可能。課金モデルのバイパス。
- **改善案**: DEBIT-FIRSTパターンに移行。分析開始前にincrement、catch内でdecrement（refund）

### A-C2 (残存): コアビジネスロジックのユニットテスト不在

- **対象ファイル**: `src/app/actions/coach/analyze.ts`, `vision.ts`, `videoMacro/analyze.ts`, `analysis/videoAnalysis.ts`
- **問題**: Stripe周辺テスト（55件）とE2E（11件）は大幅改善。しかしサービス収益に直結するAI分析のクレジット消費/refundフロー、リミットチェックロジックのユニットテストが依然ゼロ。A-C1のCREDIT-AFTERバグはテストがあれば検出できた。
- **影響**: リグレッションリスク大。クレジット周りのバグ = 直接的収益損失。
- **改善案**: videoMacro/analyze, coach/analyze, vision各テストで「AI成功→DB失敗→refund」シナリオ検証

---

## HIGH問題（5件）

### A-H1 (悪化): `any`型238箇所 — 型安全性の深刻な劣化

- **対象ファイル**: 71ファイル、238箇所
- **問題**: 前回103箇所から**2.3倍に悪化**。主な増加源: vision.ts(14箇所), videoMacro系(12箇所), chat/page.tsx(10箇所), stats/matchStats.ts(10箇所), VisionAnalysisProvider.tsx(18箇所)。riot/types.ts に型定義が存在するが使われていない。
- **影響**: Riot API/Gemini API構造変更時にランタイムクラッシュ。
- **改善案**: 優先度順に型適用: (1) riot/types.tsの既存型をimport使用 (2) Gemini SDK戻り値を`GenerateContentResult`型 (3) Supabase RPCを`z.infer`型付け

### A-H2 (NEW): processWithConcurrency の2ファイル完全重複

- **対象ファイル**: `src/app/actions/videoMacro/analyze.ts` L27-46, `asyncJob.ts` L28-46
- **問題**: `processWithConcurrency`関数が2ファイルに完全コピペ。一方を修正してもう一方を忘れるリスク。
- **改善案**: `src/lib/concurrency.ts` に抽出し両ファイルからimport

### A-H3 (悪化): vision.ts 763行モノリスの責務混在

- **対象ファイル**: `src/app/actions/vision.ts`
- **問題**: 650→763行に増加。型定義16種、エントリポイント2関数、バックグラウンドワーカー、プロンプト生成（130行テンプレートリテラル）、結果パース/検証、思考メモ（50行）が1ファイルに混在。
- **改善案**: `vision/`ディレクトリに分割: types.ts, analyze.ts, worker.ts, prompt.ts, verify.ts

### A-H4 (NEW): analyzeVideo → analyzeMatchTimeline の二重クレジット消費リスク

- **対象ファイル**: `src/app/actions/analysis/videoAnalysis.ts` L116-133
- **問題**: `analyzeVideo()`はL118で`increment_weekly_count`呼出後、L133で`analyzeMatchTimeline()`を呼ぶ。`analyzeMatchTimeline()`も独自にincrement。1回の分析で**2回クレジット消費**される可能性。
- **影響**: Freeユーザーの週3回枠が実質1.5回に。信頼崩壊。
- **改善案**: `analyzeMatchTimeline()`に`skipCreditCheck`パラメータ追加、または内部呼び出し専用バリエーション

### A-H5 (残存): react-icons/gi の巨大バンドル影響

- **対象ファイル**: `src/app/dashboard/widgets/QuickStats.tsx`, `NextGameFocus.tsx`
- **問題**: `react-icons/gi`（Game Icons 7000+）から9アイコン使用。バンドラが全エクスポートをスキャンするコスト。
- **改善案**: SVGコンポーネントとして`src/components/icons/`に個別配置、または`lucide-react`に統一

---

## MEDIUM問題（7件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| A-M1 | middleware内Supabase RPC呼出 — レイテンシボトルネック | middleware.ts | Upstash Redis等のエッジ最適化ストアに置換 |
| A-M2 | matchService.ts Riot API 429の固定5秒バックオフ（残存） | matchService.ts | Retry-Afterヘッダー参照 |
| A-M3 | hreflang未設定（残存） | layout.tsx | alternates.languages追加 |
| A-M4 | weekly-summary cronのAuth全ユーザースキャン | cron/weekly-summary | profilesにemail列追加（非正規化）、必要user_idsのみbatch取得 |
| A-M5 | vision.ts 思考メモ50行がプロダクションコードに残存 | vision.ts L521-572 | 結論のみ5行以内のJSDocに集約 |
| A-M6 | CoachUIProviderのProvider tree不整合 | CoachUIProvider.tsx | 配置ルール明確化 |
| A-M7 | E2Eテストが全て「ページロード確認」レベル | e2e/ | ログイン→ダッシュボード遷移のhappy pathテスト追加 |

---

## LOW問題（5件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| A-L1 | createClient()呼出66箇所 | actions全域 | DI（依存性注入）パターンに移行 |
| A-L2 | framer-motion通常import（dynamic未使用） | landing/ | `next/dynamic`遅延ロード検討 |
| A-L3 | signChallenge()の空文字列フォールバック | profile.ts L12 | 鍵未設定時は例外スロー |
| A-L4 | logger.warnがSentry警告を全件送信 | logger.ts | Sentryはerrorレベル限定 or サンプリング追加 |
| A-L5 | Edge Runtime宣言0箇所（残存） | API routes | `/api/billing`, `/api/chat`のEdge化検討 |

---

# 総合評価サマリー

| 審査領域 | 第1回スコア | 今回（第2回） | 改善後見込み | 差分 |
|---------|-----------|-------------|------------|------|
| プロダクト/UX（Agent P） | 52/100 | **62/100** | 77/100 | **+10** |
| アーキテクチャ/パフォーマンス（Agent A） | 62/100 | **66/100** | 81/100 | **+4** |
| **合計（平均）** | **57/100** | **64/100** | **79/100** | **+7** |

---

# 改善優先順位（クロスドメイン合意）

## 最優先（CRITICAL — 即時対応）
1. **A-C1**: videoMacro/analyze.ts, asyncJob.ts DEBIT-FIRSTパターン移行（課金バイパス修正、工数: 1-2時間）
2. **A-H4**: analyzeVideo → analyzeMatchTimeline 二重クレジット消費修正（工数: 30分）
3. **P-C1**: Chat「新しいチャット」ハードコード修正（工数: 5分、1行）

## 高優先（HIGH — 1週間以内）
4. **A-C2**: コアビジネスロジック（videoMacro, coach, vision）のユニットテスト追加（工数: 1-2日）
5. **P-H1**: LP実プロダクト画面追加（工数: 半日、CVR直結）
6. **P-H2**: 価格表示の通貨記号動的化（工数: 2-3時間）
7. **A-H3**: vision.ts ディレクトリ分割（工数: 2-3時間）
8. **A-H2**: processWithConcurrency共通ユーティリティ化（工数: 30分）

## 中期（MEDIUM — 2-4週間）
9. **A-H1**: any型段階的削減（vision.ts, videoMacro系から）
10. **A-H5**: react-icons/gi依存除去
11. **P-H4**: パスワード強度インジケーター追加
12. **P-M3/M4**: アクセシビリティ強化（sr-only, aria属性）
13. **A-M3**: hreflang設定追加
14. **P-M7**: color-contrast改善
15. **A-M5**: vision.ts思考メモ削除

## 低優先（LOW — 時間があれば）
16. **A-L3**: signChallenge空文字列フォールバック修正
17. **A-L4**: logger.warn Sentryフィルタリング
18. **P-L1**: prefers-reduced-motion Framer Motion対応
