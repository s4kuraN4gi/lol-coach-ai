# LoLCoachAI エリート辛口審査 — プロダクト/UX & アーキテクチャ/パフォーマンス

## 審査日: 2026-03-02 02:01
## 審査者:
- **Agent P（プロダクト/UX専門）**: 元Google / Apple / Spotifyプロダクトデザインチーム出身、B2C SaaS/ゲーミングアプリUX審査300件超
- **Agent A（アーキテクチャ/パフォーマンス専門）**: 元Netflix / Metaシニアスタッフエンジニア、大規模Next.jsアーキテクチャレビュー200件超

---

# 前回審査（2026-03-02 00:32 セキュリティ&マネタイゼーション）からの改善状況

## Agent P: 改善状況評価

| # | 前回指摘/今回実施 | 改善状況 | コメント |
|---|---|---|---|
| 1 | isRateLimited() fail-closed化 | **完了** | DB障害時にブロック |
| 2 | error.message直接露出の全面修正（13ファイル18箇所） | **完了** | エラーコード+i18n翻訳に統一 |
| 3 | FREE_WEEKLY_ANALYSIS_LIMIT 1→3 | **完了** | 週3回は妥当だが、やや保守的 |
| 4 | getRankGoal認証チェック追加 | **完了** | IDOR修正 |
| 5 | geminiRetry統一 | **完了** | verifyMatchVideo, Chat APIに適用 |
| 6 | Pricing default月額→年額 | **完了** | revenue最適化として正しい |
| 7 | Referral双方向インセンティブ | **完了** | 14日間無料+1週延長、設計は堅実 |
| 8 | ReferralCard Premium限定表示 | **完了** | DashboardContentで条件分岐 |
| 9 | showUpgradeCTA Free拡張 | **完了** | Macro/MicroResultSectionに適用 |
| 10 | CSP connect-src拡張 | **完了** | AdSense/Turnstile追加 |
| 11 | PremiumPromoCard日本語fallback修正 | **完了** | 英語fallbackに統一 |
| 12 | Freeユーザー週次リエンゲージメントメール | **完了** | cron拡張 |
| 13 | Upgrade Modal即時表示 | **完了** | hasResults条件を除去 |
| 14 | Pricing CTA bottomプラン別分岐 | **完了** | Extra/Premiumで分岐+Extraアップグレード誘導 |
| 15 | ウェルカムモーダル追加 | **完了** | ?welcome=1パラメータ |
| 16 | alternates.languages修正 | **部分完了** | canonical設定済みだがhreflang議論あり（後述） |
| 17 | 月額カードに年間割引ラベル常時表示 | **完了** | annualSave翻訳追加 |
| 18 | FAQ 5→8問拡張 | **完了** | Free tier/リージョン/Premium vs Extra追加 |
| 19 | CancelModal Extra「失うもの」追加 | **完了** | ダメージ分析・5セグメント・無制限 |
| 20 | Pricing Extraカード二重強調調整 | **完了** | Premium=border-2, Extra=border |
| 21 | referral_code localStorage TTL | **完了** | 7日TTL+レガシー互換 |
| 22 | CSRF verifyOrigin() | **完了** | pause/checkout/billing/chatに適用 |

## Agent A: 改善状況評価

| # | 前回指摘 | 改善状況 | コメント |
|---|---------|---------|---------|
| 1 | isRateLimited() fail-closed化 | **完了** | 3箇所とも`return true`に統一。正しいfail-closed |
| 2 | error.message直接露出 | **完了** | エラーコード返却パターンに統一 |
| 3 | FREE_WEEKLY_ANALYSIS_LIMIT | **完了** | constants.ts: `= 3` |
| 4 | getRankGoal認証チェック | **完了** | getUser() + user_id一致検証 |
| 5 | geminiRetry統一 | **ほぼ完了** | chat, verifyMatchVideoに適用。**ただしcoach/analyze.ts L302が未適用（統一漏れ1箇所）** |
| 6 | CSRF保護 | **完了** | 4エンドポイントに適用 |
| 7 | Free週次メール | **完了** | ただしauth.admin.listUsers()の二重呼び出しが非効率 |
| 8 | alternates修正 | **部分完了** | canonicalのみ。hreflang未設定 |
| 9 | referral TTL | **完了** | JSON.parse + expires > Date.now() |

---

# 議論パート: Agent P × Agent A

## 開会: 両エージェントの所感

**Agent P**: 前回審査後の22項目中21項目が適切に修正されており、実行力は高く評価する。しかし今回の精査で**プロダクト/UXの根本的な構造問題**が複数見つかった。特にChatページのモバイル完全崩壊、オンボーディングのJP限定リージョンロック、ランディングページの実プロダクト画像不在。これらは「機能が動く」ことと「プロダクトとして成立する」ことの差を示している。

**Agent A**: 同意する。コードベースの品質は確実に向上しているが、**アーキテクチャの構造的負債**が蓄積している。最も深刻なのは分析リミットロジックの3パターン混在（daily/weekly移行の中途半端さ）で、これは**課金モデルのバイパス**に直結する。また`any`型103箇所、テストファイル5個という状態は「動いているが壊れやすい」の典型だ。

## クロスドメイン議論

**Agent P**: アーキテクチャ側から見て、ユーザーが最も触れるChatページがモバイルで完全に使えない件について聞きたい。288pxのサイドバーがビューポート全体を占有して、チャット入力が見えない。これは「CSSの問題」ではなく「レスポンシブ設計の欠如」だ。

**Agent A**: 確認した。Chat pageには`sm:|md:|lg:|xl:`のブレークポイントが一つもない。w-72の固定サイドバーで、モバイルでの代替レイアウトが存在しない。ダッシュボードのSidebarNavは既にモバイル対応のドロワーパターンを実装しているので、技術的には同じパターンを適用するだけだが、**そもそもChatページ全体がダッシュボードLayoutの外に配置されている**のが根本原因だ。

**Agent P**: もう一つ深刻なのがオンボーディングのリージョン問題だ。en/ko翻訳に相当な投資をしているのに、JP以外のリージョンのユーザーはオンボーディングで100%離脱する。`text-xs text-slate-500`で「JPのみ」と書いてあるだけで、エスケープ手段がログアウトしかない。

**Agent A**: SEO的にもこれは問題だ。layout.tsxのhreflang設定が中途半端で、多言語の検索流入を想定しているように見えるが、実際にはJPリージョン限定。**翻訳投資とプロダクト制約の不整合**が最大の無駄だ。ただ、将来的にリージョン拡大する計画があるなら、翻訳投資は先行投資として正当化できる。

**Agent P**: ランディングページの問題も指摘したい。HeroSectionはモックSVGレーダーチャートとハードコードされたカウンター数値（87%, 142, 24K）で構成されている。実際のプロダクトスクリーンショットやデモ動画が一切ない。B2C SaaSで最も重要なCVRレバーが欠落している。

**Agent A**: 技術的に補足すると、バンドルサイズの問題とも関連する。ランディングページでframer-motionの重いアニメーション（パララックス、パーティクル）を使っているが、**実際のプロダクト画面を見せるほうがCVR効果が高く、かつJSバンドルが軽い**。アニメーションに投資するより、静的なスクリーンショット+軽いフェードインの方がLCPもCVRも改善する。

**Agent A**: 私が最も懸念しているのは**分析リミットロジックの混在**だ。matchAnalysis.tsとvideoAnalysis.tsはまだ旧仕様の`daily_analysis_count`を使っている。weekly制限に移行したはずが、これらの経路ではweekly_analysis_countを消費しない。FreeユーザーがmatchAnalysis経由なら週3回制限をバイパスできる。

**Agent P**: それはマネタイゼーションの観点でも致命的だ。Freeユーザーが「週3回」だと思っている制限が、実際には特定の経路で無制限に使えるなら、Premium転換の動機が消滅する。

**Agent A**: さらにcoach/analyze.tsのrefundロジックが非原子的だ。他の箇所は`decrement_weekly_count` RPCを使っているのに、ここだけ`profiles.update()`の直接更新。concurrent requestでカウントがマイナスになりうる。

**Agent P**: テストの話に移りたい。テストファイルが5個しかないというのは、プロダクト品質の保証ができていないということだ。特にStripe webhook処理のテストがゼロというのは恐ろしい。

**Agent A**: 収益に直結するコードパス — `handleCheckoutSessionCompleted`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted` — にテストがない。tier判定ロジック（Extra vs Premium）の変更で意図しないダウングレードが発生しても、本番でしか気づけない。

**Agent P**: 最後にアクセシビリティの問題。`focus-visible`のリングが10箇所しかない。キーボード操作ユーザーがフォーカス位置を把握できない。これはWCAG 2.1 Level AAの2.4.7違反だ。

**Agent A**: CSSレベルで一括対応できる。`globals.css`にbase ruleを追加するだけで全interactive要素にfocus ringが適用される。工数は最小限だ。

---

# Part 1: プロダクト/UX審査

## スコアリング

| カテゴリ | 現在スコア | 改善後見込み |
|---------|-----------|------------|
| オンボーディングフロー | 58/100 | 78/100 |
| 機能発見性 | 45/100 | 68/100 |
| 転換ファネル設計 | 62/100 | 80/100 |
| 解約防止/リテンション | 60/100 | 75/100 |
| エラー表示/フィードバック | 72/100 | 85/100 |
| 多言語品質 | 55/100 | 75/100 |
| モバイルUX | 35/100 | 65/100 |
| アクセシビリティ | 28/100 | 55/100 |
| LP CVR最適化 | 55/100 | 72/100 |
| ダッシュボード情報設計 | 60/100 | 75/100 |
| 競合機能ギャップ | 50/100 | 65/100 |

### 総合スコア: 52/100（改善後: 72/100）

---

## CRITICAL問題（2件）

### P-C1: Chatページがモバイルで完全崩壊

- **対象ファイル**: `src/app/chat/page.tsx`
- **問題**: `h-[85vh]`固定 + `w-72`サイドバーでレスポンシブブレークポイントがゼロ。モバイルでサイドバーがビューポート全体を占有し、チャット入力・メッセージ領域にアクセス不能。
- **影響**: Premium専用機能がモバイルで完全に使用不可。LoLプレイヤーはゲーム後にモバイルで振り返ることが多く、最も高価値なユーザーセグメントの体験を毀損。
- **改善案**: SidebarNavのドロワーパターンを適用。サイドバーをモバイルではトグル/ドロワー化。`h-[calc(100dvh-env(safe-area-inset-bottom))]`でiOS対応。

### P-C2: オンボーディングにスキップ導線がなく、JP限定制約が埋没

- **対象ファイル**: `src/app/onboarding/page.tsx`
- **問題**: サモナー認証完了までダッシュボードにアクセス不可。「JPのみ対応」が`text-xs text-slate-500`の脚注レベル。NA/EUW/KRユーザーはデッドエンドとなり、唯一のエスケープが`text-xs`のログアウトリンク。en/ko翻訳の投資が完全に無駄。
- **影響**: 非JPユーザーが登録 → オンボーディングで100%離脱。国際展開の見込みがあっても、現状では信頼喪失の原因。
- **改善案**: LP/signupページにリージョン対応状況を明示。「Skip for now」ボタンでダッシュボードの限定探索を許可。JP限定を目立つ警告バナーに変更。

---

## HIGH問題（5件）

### P-H1: LPに実プロダクト画面/デモ動画が不在

- **対象ファイル**: `src/app/components/landing/sections/HeroSection.tsx`
- **問題**: モックSVGとハードコードされたカウンター（87%, 142, 24K）のみ。プロダクトの実際の画面が見えない。
- **影響**: B2C SaaSの最重要CVRレバー欠如。何に登録するのか視覚的に伝わらない。
- **改善案**: ダッシュボードの実スクリーンショット/GIFを最低1枚Hero領域に配置。分析フローの短いデモ動画を追加。

### P-H2: オンボーディング認証フローにステップUIと説明が不足

- **対象ファイル**: `src/app/onboarding/page.tsx`
- **問題**: 検索→検出→アイコン変更→検証の複雑なフローにステッパーUIなし。唯一のフィードバックが20px回転アニメーション。LoLクライアントでのアイコン変更方法の説明なし。
- **影響**: 慣れないユーザーが手順で脱落。初回UXの最重要ポイント。
- **改善案**: Step 1/2/3のステッパーUI追加。LoLクライアントのアイコン変更箇所のビジュアル説明追加。

### P-H3: サイドバーの「Analysis」ラベルがChatに、「AI Coach」が分析に遷移

- **対象ファイル**: `src/app/components/layout/SidebarNav.tsx`
- **問題**: `sidebar.nav.analysis`→`/chat`、`sidebar.nav.coach`→`/dashboard/coach`。ラベルと遷移先の不一致。`/analyze`ページへのリンクもサイドバーに不在。
- **影響**: ユーザーが「分析」を期待してクリック→チャット画面（Premium専用）に遷移→混乱と有料機能壁の悪印象。
- **改善案**: ラベルをタスク指向にリネーム。「AIチャット」→`/chat`、「マッチ分析」→`/dashboard/coach`。

### P-H4: Stripe決済成功後のフィードバックが皆無

- **対象ファイル**: `src/app/dashboard/components/DashboardContent.tsx`
- **問題**: checkout=success → syncSubscriptionStatus() → router.replace('/dashboard') で、成功トースト/モーダル/プラン確認が一切ない。sync失敗時もlogger.errorのみで、ユーザーには何も表示されない。
- **影響**: ユーザージャーニー最高の感情モーメントを無駄にしている。アップグレード成功の確認不能。
- **改善案**: 「Premium/Extraへようこそ！」モーダル表示。新機能一覧と開始ガイド付き。sync失敗時はサポート連絡リンク付きトースト。

### P-H5: 価格表示がグローバルにJPY（¥）固定

- **対象ファイル**: `src/app/pricing/page.tsx`
- **問題**: FALLBACK_PRICESが¥固定。`/年`、`/月`表記もja固定のフォールバック。en/koユーザーに日本語の通貨記号と期間表記が混在。
- **影響**: 非日本語ユーザーの信頼性低下。通貨と請求期間の不一致で混乱。
- **改善案**: locale対応のcurrency formatter適用。フォールバック文字列をlocale別に分離。

---

## MEDIUM問題（7件）

### P-M1: ウェルカムモーダルにフィーチャーツアーなし

- **対象ファイル**: `src/app/dashboard/components/DashboardContent.tsx`
- **問題**: 汎用的な「Welcome!」メッセージ+「AIコーチング開始」CTAのみ。無料分析回数、ウィジェットの説明、Premium機能の概要が一切ない。
- **改善案**: 3-4ステップのフィーチャーツアーオーバーレイ、またはチェックリストウィジェットの追加。

### P-M2: Analyzeページに広告が3箇所+リワード広告で計4タッチポイント

- **対象ファイル**: `src/app/analyze/page.tsx`
- **問題**: 上部Ad、モバイルAd、下部Ad + RewardedAdModal。コンテンツ到達前に広告が視界を占有。
- **改善案**: 上部Adを結果下に移動。最大2配置に削減。

### P-M3: 分析結果ページのCTAが4箇所で過剰（CTA疲れ）

- **対象ファイル**: MacroResultSection.tsx, MicroResultSection.tsx
- **問題**: ゲスト向けにインラインぼかしCTA、インライン登録CTA、セグメントオーバーレイCTA、下部アップセルCTAの4箇所。
- **改善案**: ぼかしオーバーレイ（最も効果的）+ 下部CTA の2箇所に絞る。

### P-M4: `focus-visible`リングが10箇所のみ（WCAG 2.4.7違反）

- **対象ファイル**: 全体
- **問題**: ほとんどのbutton/link/cardにフォーカスインジケーターなし。
- **改善案**: globals.cssにbase ruleで`focus-visible:ring-2`を一括適用。

### P-M5: i18nフォールバックで英語が日本語/韓国語UIに漏洩

- **対象ファイル**: ja.json, ko.json
- **問題**: `dashboard.upgrade`が3言語とも`"Upgrade"`（英語）。`chatPage.coachTitle`が`"LOLE COACH AI"`（typo: LOLE→LOL）。一部キーがen.jsonにしか存在せず。
- **改善案**: 3ロケール間のキー差分監査。`LOLE`typo修正。未翻訳キーの翻訳追加。

### P-M6: 比較表のi18nキーがプラン間で交差参照

- **対象ファイル**: `src/app/pricing/page.tsx`（features配列）
- **問題**: Free列が`pricingPage.guest.autoMethod`を参照する等、翻訳キーのnamespaceが不整合。
- **改善案**: 各プランのnamespacに正規化。

### P-M7: ダッシュボードにマッチデータが無い場合の空状態ガイダンス不足

- **対象ファイル**: `src/app/dashboard/components/DashboardContent.tsx`
- **問題**: recentMatchesが空の場合、ウィジェットがnull/空配列で描画されるが、目立つ空状態コンポーネントがない。
- **改善案**: 空状態コンポーネントでゲーム後の再訪を誘導。サンプルデータ表示も検討。

---

## LOW問題（5件）

| # | 問題 | ファイル | 改善案 |
|---|------|---------|--------|
| P-L1 | login/signupのstate変数名不統一（LoginId vs LoginID）+ staleコメント | login/page.tsx, signup/page.tsx | `email`にリネーム |
| P-L2 | サイドバーReference欄のリンク先が404の可能性 | SidebarNav.tsx | 存在確認、条件付きレンダリング |
| P-L3 | signupにパスワード強度インジケーターなし | signup/page.tsx | リアルタイム強度表示追加 |
| P-L4 | prefers-reduced-motion がframer-motion JS animationに非適用 | LandingPageClient.tsx | `useReducedMotion()`でパララックス無効化 |
| P-L5 | PremiumFeatureGateがプレビューなしでロック表示 | DashboardContent.tsx | ぼかしプレビュー/サンプルデータ表示 |

---

# Part 2: アーキテクチャ/パフォーマンス審査

## スコアリング

| カテゴリ | 現在スコア | 改善後見込み |
|---------|-----------|------------|
| Server/Client分割 | 68/100 | 82/100 |
| データフェッチパターン | 72/100 | 88/100 |
| 認証フロー | 78/100 | 88/100 |
| Stripe連携 | 80/100 | 90/100 |
| エラーハンドリング | 65/100 | 82/100 |
| コード責務分離 | 70/100 | 85/100 |
| 型安全性 | 55/100 | 75/100 |
| テストカバレッジ | 25/100 | 60/100 |
| バンドルサイズ | 62/100 | 80/100 |
| API呼び出し効率 | 68/100 | 85/100 |
| SSR/Edge活用 | 40/100 | 70/100 |
| CDN/Caching戦略 | 60/100 | 80/100 |

### 総合スコア: 62/100（改善後: 80/100）

---

## CRITICAL問題（2件）

### A-C1: coach/analyze.ts のGemini呼び出しがgeminiRetry未適用 + 非原子的refund

- **対象ファイル**: `src/app/actions/coach/analyze.ts` L302, L419-429
- **問題**: L302の`model.generateContent(systemPrompt)`が素のPromise呼び出しで`geminiRetry()`未適用。最もトークン消費量が大きいcoach分析だけが統一漏れ。さらにL424のrefundが`supabase.from('profiles').update()`の直接update（非原子的）で、concurrent requestでカウントが負値になりうる。他箇所は`decrement_weekly_count` RPCを使用。
- **影響**: (1) Gemini 429時にcoach分析だけリトライなしで即失敗→ユーザー体験劣化+消費カウント浪費。(2) refundの非原子性による`weekly_analysis_count`不整合。
- **改善案**:
```typescript
// L302: geminiRetryでラップ
const result = await geminiRetry(
  () => model.generateContent(systemPrompt),
  { maxRetries: 3, label: `Coach ${modelName}` }
);
// L424: 原子的RPCに置換
await supabase.rpc('decrement_weekly_count', { p_user_id: user.id });
```

### A-C2: テストカバレッジが致命的に不足（推定3%未満）

- **対象ファイル**: テストファイル5個のみ
- **問題**: Server Action 21ファイル、API Route 7ファイル、hooks 8ファイル、Provider 5ファイルに対してUnit Test 5個のみ。Integration/E2E Testゼロ。**Stripe webhook処理（checkout完了/サブスク更新/削除）のテストが完全欠如**。tier判定ロジック（Extra vs Premium）の変更で意図しないダウングレードが検出されない。
- **影響**: 収益直結のコードパスにリグレッション保護なし。本番環境でのみ問題発覚。
- **改善案**: (1) Stripe webhook handler単体テスト（mock Stripe + mock Supabase）、(2) credit/limit系RPCの integration test、(3) Playwright E2E for checkout flow。

---

## HIGH問題（5件）

### A-H1: 分析リミットロジックが3パターン混在、課金バイパスが存在

- **対象ファイル**: `matchAnalysis.ts`, `videoAnalysis.ts`, `coach/analyze.ts`, `vision.ts`
- **問題**: matchAnalysis.tsとvideoAnalysis.tsは旧仕様の`daily_analysis_count`（上限50）を使用。weekly制限移行が中途半端で、これらの経路では`weekly_analysis_count`を消費しない。FreeユーザーがmatchAnalysis経由なら週3回制限をバイパス可能。
- **影響**: **課金モデルのバイパス**。Premium転換動機の消滅。
- **改善案**: `consumeAnalysisCredit()` / `refundAnalysisCredit()` を1箇所に集約し全4ファイルから使用。daily_analysis_count参照を完全排除。

### A-H2: `any`型が103箇所に散在、Riot APIレスポンスが完全にuntyped

- **対象ファイル**: 30ファイル以上（matchStats.ts: 10箇所、matchService.ts: 7箇所 等）
- **問題**: Riot API V5のMatch/Timeline応答に型定義なし。`data.info.participants`のチェーン全てがuntyped。TypeScript strictの恩恵が無効化。
- **影響**: API構造変更時にランタイムエラー。IDE補完/リファクタリングが機能しない。
- **改善案**: `src/types/riot.ts`にMatch V5, Timeline V1, Summoner V4の型を定義。

### A-H3: weekly-summary cronでauth.admin.listUsers()が二重呼び出し

- **対象ファイル**: `src/app/api/cron/weekly-summary/route.ts` L82-99, L142-156
- **問題**: Premium向けで全ページ走査、直後のFree向けで**同じlistUsers()をゼロから再走査**。ユーザー数1000超でタイムアウトリスク（maxDuration=60s）。
- **影響**: ユーザー増加でcronタイムアウト → メール未送信 → チャーン率上昇。
- **改善案**: 1回のlistUsers()走査でemailMapを構築し両方で共有。profilesにemail列ミラーリングも検討。

### A-H4: SWR経由Server Actionの不必要なオーバーヘッド

- **対象ファイル**: `hooks/useDashboardData.ts`, `useCoachData.ts`, `useMatchData.ts`, `useStatsData.ts`
- **問題**: (1) SWRのrevalidation毎にServer Actionモジュールをdynamic import。(2) React.cache()のサーバー側キャッシュとSWRクライアントキャッシュが二重化。(3) 初回ロードで3つのServer Actionがシリアル発火。SSRで事前取得可能なデータが大半。
- **影響**: TTFB増加。初回表示でスケルトンが長時間表示。
- **改善案**: Dashboard SSRでReact.cache()付き`getCachedStats(puuid)`をawaitしprops渡し。SWRはbackground revalidationのみに使用。

### A-H5: framer-motion / recharts / react-icons のTree Shaking未最適化

- **対象ファイル**: package.json依存関係
- **問題**: framer-motion(7ファイル使用/全LP系)がlayout.tsx Providerツリー内でロードされ全ページに影響の可能性。recharts(1ファイルのみ/100KB超)。react-icons(25ファイル/サブパスimport確認必要)。
- **影響**: JSバンドルサイズ肥大化 → LCP/INP悪化（特にモバイル）。
- **改善案**: rechartsをnext/dynamic(SSR=false)で遅延ロード。framer-motionをLP専用layoutに閉じ込め。

---

## MEDIUM問題（7件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| A-M1 | createClient()冗長呼び出し（50回）。同一リクエストで3回生成 | actions全域 | React.cache()でラップ or context引渡し |
| A-M2 | Edge Runtime未活用。全API RouteがNode.js Serverless（cold start 200-800ms） | API Routes全般 | `/api/chat`, `/api/billing`をEdge Runtime化 |
| A-M3 | `force-dynamic`の濫用。3ダッシュボードページに明示指定 | dashboard/page.tsx等 | 削除してNext.js自動判定に委任。PPR対応準備 |
| A-M4 | matchService.tsのRiot API retry が固定delay/1回のみ。Retry-Afterヘッダー無視 | matchService.ts | Retry-Afterヘッダー準拠 + 指数バックオフ |
| A-M5 | vision.ts 650行モノリス。ネストしたforループ+二重break条件 | vision.ts | 中核ロジックを別関数に抽出（200+150行に分割） |
| A-M6 | hreflang未設定（canonical only）。多言語SEO効果なし | layout.tsx | alternates.languages復活（cookie-based i18nでも宣言は有効） |
| A-M7 | RootLayoutの深いProvider入れ子。公開ページでも認証/Summoner初期化 | layout.tsx | AuthProvider/SummonerProviderをdashboard layoutに移動 |

---

## LOW問題（5件）

| # | 問題 | 対象 | 改善案 |
|---|------|------|--------|
| A-L1 | cachedData.tsのReact.cache()が実質未使用（SWR経由のため効果なし） | cachedData.ts | SSR直接呼び出しに移行 or ファイル削除 |
| A-L2 | next/imageの活用限定的。DDragonアイコンで`<img>`直接使用の可能性 | 複数ファイル | next/imageに置換、CLS改善 |
| A-L3 | Sentry SDK v10のバンドルサイズ寄与（30-50KB） | package.json | tracesSampleRate本番0.1、FreeはreplaysSessionSampleRate=0 |
| A-L4 | DashboardUpdaterが2箇所でレンダリング（loading/完了両方） | DashboardContent.tsx | loading分岐の外側に1回だけ配置 |
| A-L5 | performFullUpdate()で動的import4箇所乱用 | stats/fullUpdate.ts | static importに統一、循環参照ならファイル構造見直し |

---

# 総合評価サマリー

| 審査領域 | 現在スコア | 改善後見込み | 前回スコア |
|---------|-----------|------------|-----------|
| プロダクト/UX（Agent P） | **52/100** | **72/100** | N/A（初回） |
| アーキテクチャ/パフォーマンス（Agent A） | **62/100** | **80/100** | N/A（初回） |
| **合計（平均）** | **57/100** | **76/100** | — |

## 前回審査との比較

| 審査領域 | 第5回（前回） | 今回 | 差分 |
|---------|-------------|------|------|
| セキュリティ（Agent S） | 87/100 | —（今回対象外） | — |
| マネタイゼーション（Agent M） | 80/100 | —（今回対象外） | — |
| プロダクト/UX（Agent P） | — | 52/100 | 新規 |
| アーキテクチャ/パフォーマンス（Agent A） | — | 62/100 | 新規 |

---

# 改善優先順位（クロスドメイン合意）

## 最優先（CRITICAL — 即時対応）
1. **A-C1**: coach/analyze.ts geminiRetry適用 + refund原子化（工数: 15分）
2. **A-H1**: 分析リミットロジック統一（daily→weekly完全移行）（工数: 1-2時間）
3. **P-C1**: Chatページモバイル対応（工数: 1-2時間）

## 高優先（HIGH — 1週間以内）
4. **P-C2**: オンボーディングリージョン制約の明示化 + Skip導線
5. **P-H3**: サイドバーラベル/遷移先の整合性修正
6. **P-H4**: Stripe決済成功後のフィードバックモーダル
7. **A-H3**: weekly-summary cron listUsers()統合
8. **A-H4**: Dashboard SSRでのデータ事前取得

## 中期（MEDIUM — 2-4週間）
9. **A-H2**: Riot API型定義の作成
10. **A-C2**: テスト戦略の確立（Stripe webhook最優先）
11. **P-M4**: focus-visible一括適用
12. **P-M5**: i18nキー差分監査 + LOLE typo修正
13. **A-H5**: バンドルサイズ最適化（recharts遅延ロード等）

---

# 両エージェント総評

**Agent P**: 22件の前回改善は確実に実行されており、「指摘→修正」のサイクルは高速。しかしプロダクトの根本課題 — モバイルの崩壊、初回UXの死角、プロダクト不可視のLP — は機能追加では解決しない。「機能が動く」と「ユーザーが成功する」の間にある溝を埋める作業が今最も必要だ。52点は「動くがプロダクトとして粗い」水準。

**Agent A**: SWR+Server Actionの基本設計は合理的で、Stripe連携のidempotency/webhook冪等性は業界標準以上。しかし分析リミットの3パターン混在は課金バイパスに直結するアーキテクチャ欠陥であり最優先。`any`型103箇所とテスト5ファイルは「動いているが壊れやすい」の典型。vision.ts 650行モノリスも含め、責務分離を進めなければスケーラビリティの壁にぶつかる。62点は「機能は揃っているが構造が脆い」水準。
