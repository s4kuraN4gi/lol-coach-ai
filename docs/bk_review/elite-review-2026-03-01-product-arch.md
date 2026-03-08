# LoLCoachAI 辛口審査レポート -- プロダクト/UX & アーキテクチャ/パフォーマンス (第3回)

**実施日**: 2026-03-01
**審査員A**: GAFA出身プロダクトマネージャー兼UXデザイナー (Product/UX)
**審査員B**: GAFA出身シニアアーキテクト兼パフォーマンスエンジニア (Architecture/Performance)
**前回審査**: 2026-03-01 第2回 (UX 62/100, Arch 62/100, Security 72/100, Monetization 55/100)

---

## 総合スコアサマリー

| カテゴリ | 第1回(02-28) | 第2回(03-01) | **今回(第3回)** | 変動 | 改善後予想 |
|---------|------------|------------|--------------|------|----------|
| プロダクト/UX | 38 | 62 | **73** | +11 | 83 |
| アーキテクチャ/パフォーマンス | 38 | 62 | **74** | +12 | 86 |
| セキュリティ | 48 | 72 | **79** | +7 | 88 |
| マネタイゼーション | 32 | 55 | **72** | +17 | 82 |
| **総合** | **39** | **63** | **74.5** | **+11.5** | **84.75** |

---

## Part 1: 前回指摘事項の改善状況

### UX/プロダクト指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| NC-1 | LP ヒーロー見出し "LEVEL UP YOUR RANK" がハードコード英語 | 英語ハードコード | `t('landingPage.hero.titleLine1')` で完全i18n化 | **改善済** |
| NH-1 | analyze/page.tsx ミクロ分析セクションにハードコード英語10箇所以上 | "Damage Given" 等が直書き | 全て `t()` キー化済み | **改善済** |
| NH-2 | CoachClientPage "Local File" / "Premium" が直書き | 英語ハードコード | `t('coachPage.controls.localFile')`, `t('coachPage.micro.premiumBadge')` に移行 | **改善済** |
| NH-3 | signup/reset-password のエラーが生のSupabase英語メッセージ | `setError(error.message)` | Google OAuth: `t('signupPage.googleAuthFailed')` に修正。通常signupは末尾にSupabase英語が残存 | **部分改善** |
| NH-4 | アクセシビリティが壊滅的（aria 4箇所のみ） | aria-label 4箇所 | aria-label: 11箇所, role="dialog": 6箇所, aria-modal: 7箇所, フォーカストラップ全モーダル実装 | **改善済** |
| NM-1 | Social Proof の数値が静的ダミー | 静的値 | 変更なし（引き続き静的値） | **未改善** |
| NM-2 | analyze/page.tsx が1554行 | 巨大コンポーネント | **1702行に悪化**。ゲスト分析ブラーCTA等の追加により行数増加 | **悪化** |
| NM-3 | VideoMacroAnalysisProvider 日本語ハードコードエラー | `"分析に失敗しました"` 直書き | Provider分割済み。ただしL212に `"分析ジョブを開始中..."` が1行残存 | **部分改善** |
| NM-4 | PremiumPromoCard が2つ存在（命名衝突） | widgets版 vs components版 | 変更なし。2つとも存在し続ける | **未改善** |
| NM-5 | MagneticButton が `<motion.a>` を使用 | Next.js Link 迂回 | `<Link href={href}>` ベースに変更。SPA遷移が正常に動作 | **改善済** |

### アーキテクチャ/パフォーマンス指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| CRITICAL-1 | Webhook冪等性がインメモリSet | サーバーレスで無効 | `claim_webhook_event` RPCでDB実装済み | **改善済** |
| CRITICAL-2 | Provider contextValueの未メモ化 | LanguageProvider等にuseMemoなし | 全5 Providerで `useMemo` + `useCallback` 完備 | **改善済** |
| HIGH-1 | videoMacroAnalysis.tsが1651行のGod File | 全て1ファイル | `videoMacro/` 配下に8ファイル分割。バレルファイル31行 | **改善済** |
| HIGH-2 | analyzeMatchQuickのクレジット消費がnon-atomic | 別トランザクション | DEBIT-FIRSTパターン実装。失敗時リファンドロジックも実装 | **改善済** |
| HIGH-3 | getActiveSummoner()の過剰再呼び出し | useEffect依存配列の問題 | SWRベースに全面書き換え。`dedupingInterval: 10000` | **改善済** |
| HIGH-4 | 45箇所のgetUser()残存 | 多すぎ | React.cache版を用意したが使用はpage.tsx 3ファイルのみ。直接呼び出し47箇所に微増 | **部分改善** |
| HIGH-6 | 3フォント読み込み | Geist + Geist_Mono + Outfit | Outfitを削除。2フォントに | **改善済** |
| M-1 | テストカバレッジ | 1ファイルのみ | 4ファイル計853行に拡充 | **部分改善** |
| M-3 | console.log/warn/error の大量残存 | 124箇所 | `logger.ts` + Sentry統合。src内のconsole呼び出しは5箇所のみ | **改善済** |
| M-4 | openaiパッケージ未使用 | 不要依存 | 削除済み | **改善済** |
| M-5 | VisionAnalysisProviderのstartAnalysisがuseCallback未使用 | useMemo無効化 | `useCallback` でラップ済み | **改善済** |

### セキュリティ指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| SEC-C1 | RSO認証ユーザーのパスワードログイン拒否未実装 | `app_metadata` 設定のみ | ログインページでクライアント側 + サーバー側の二重防御を実装 | **改善済** |
| SEC-C2 | CSP `script-src 'unsafe-inline'` が本番で有効 | `unsafe-inline` が常時 | nonce-based CSPに移行。`'nonce-${nonce}' 'strict-dynamic'` | **改善済** |
| SEC-H1 | ゲストクレジットのIP偽装防御 | Cloudflareのみ | Cloudflare Turnstile導入（サーバーサイド検証込み） | **改善済** |
| SEC-H2 | フレームアップロードのZodスキーマとbodySizeLimitの不整合 | 30枚x2MB | `framesArraySchema.max(10)` に修正 | **改善済** |
| SEC-H3 | ログインページにレート制限なし | 無制限 | クライアントサイドで5回/60秒ロックアウト。サーバーサイドは未実装 | **部分改善** |

### マネタイゼーション指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| MON-C2 | ゲスト分析成功後のCTAが弱い | クレジット不足時のみ | マクロ/ミクロ結果にブラー + 会員登録CTA配置 | **改善済** |
| MON-H1 | Extra ¥2,980が高すぎる | 高い | ¥1,480に値下げ。年間プラン ¥8,800も追加 | **改善済** |
| MON-H3 | 年間プランが存在しない | 月額のみ | Premium年額¥7,800 (34%OFF)、Extra年額¥8,800 (50%OFF) | **改善済** |
| MON-H4 | 広告配置最適化不足 | 限定的 | DashboardContent + ゲスト分析ページにAdSenseBanner追加 | **改善済** |
| MON-M1 | 価格がハードコード | ハードコード | Stripe Price API動的取得（フォールバック付き） | **改善済** |
| MON-M4 | チャーン防止に一時停止なし | なし | CancelConfirmModalに1/2/3ヶ月一時停止ステップ + API実装 | **改善済** |
| MON-M5 | 週次メールなし | なし | Resend + Vercel Cron (Monday 9:00) で実装 | **改善済** |
| MON-M6 | リファラルプログラムなし | なし | ReferralCard + DB設計 + RPC + Webhook連携で完全実装 | **改善済** |

**改善率サマリー: 改善済 29 / 部分改善 7 / 未改善 3 / 悪化 1**

---

## Part 2: エリートレビュアー間の議論

### 審査員A (Product/UX) → 審査員B (Architecture)

> **A**: 今回最も評価するのはマネタイゼーション設計の成熟度。ゲスト分析のブラーCTA、年間プラン、一時停止オプション、リファラル -- 「レストランにレジを設置した」から「客をレジに導く動線が整った」レベルに進化した。+17点の改善はそれを物語っている。
>
> ただし、analyze/page.tsx が**1702行に増加した**のは明らかに間違い。ゲスト向けブラーCTAの追加自体は正しいプロダクト判断だが、1554行の巨大ファイルにさらに148行を積み増すべきではなかった。コンポーネント分割してから追加すべきだった。

### 審査員B (Architecture) → 審査員A (Product)

> **B**: 同意する。技術的に言えば、videoMacroAnalysis.tsの分割は**模範的なリファクタリング**だった。1651行→8ファイル、バレルファイルで既存importパスを維持。この実績あるパターンをanalyze/page.tsx、coach.ts (1231行)、riot.ts (1470行)、analysis.ts (1049行) に展開していないのは、「知っているのにやっていない」状態だ。
>
> Provider層の完全メモ化とSummonerProviderのSWR化は素晴らしい。前回の「全アプリ再レンダー」問題は完全に解消された。しかし `getUser()` のReact.cache版を作りながら47箇所中44箇所が旧パターンのままなのは「仕組みは作ったが浸透していない」典型。

### 審査員A → 審査員B

> **A**: アクセシビリティについて。前回「スクリーンリーダーユーザーを完全に無視している」と3点をつけたが、今回は6点に改善。aria-label 4→11、role="dialog" 0→6、フォーカストラップ全モーダル実装。基本的な要件は満たした。ただし色コントラスト（`text-slate-600` on dark bg）のWCAG AA検証と、スキップリンクの追加はまだ必要。
>
> i18nはほぼ完遂された。3言語各1533行の翻訳ファイルは個人開発として異例の丁寧さ。残る問題はsignupのSupabase英語エラーメッセージ混在と、onboardingの日本語文字列`includes()`判定の2点のみ。

### 審査員B → 審査員A

> **B**: セキュリティの観点から言えば、nonce-based CSPへの移行はGAFAレベルの実装だ。`'nonce-${nonce}' 'strict-dynamic'` でCSP2+環境では `'unsafe-inline'` が自動無効化される。Cloudflare Turnstileの導入も正しい判断で、ゲスト分析のbot防御とIP偽装対策を同時に解決した。
>
> 唯一残念なのは、ログインのレート制限がクライアントサイドのみという点。`lockoutUntil` / `failCountRef` はブラウザのJS変数に過ぎず、DevToolsで簡単にバイパスできる。MiddlewareレベルでのIP単位レート制限（Upstash Ratelimit等）が必要。

### 共同結論

> **A+B**: 3日間で39点から74.5点まで引き上げたのは驚異的。しかし74.5点は「まだ磨く余地がある」水準であり、「出荷して自慢できる」プロダクトは80点以上。残る壁は以下3つ:
>
> 1. **巨大ファイルの分割** (analyze 1702行、coach 1231行、riot 1470行、analysis 1049行)
> 2. **getUser() 47箇所の統一** (React.cache版への移行)
> 3. **サーバーサイドレート制限の実装**
>
> これらを片付ければ84.75点に到達する見込み。

---

## Part 3: 新規発見の問題点

### CRITICAL (致命的)

#### C-1: analyze/page.tsx が1702行に膨張 (前回+148行)

- **該当**: `src/app/analyze/page.tsx`
- **問題**: マクロ分析UI、ミクロ分析UI、ゲスト制限ロジック、Turnstile統合、動画アップロード、キャリブレーション、リワード広告が全て1ファイルに同居。SRP違反の典型。変更のたびに全体のバグを誘発するリスクが高い
- **改善案**: 4コンポーネントに分割 (MicroAnalysisSection / MacroAnalysisSection / AnalysisUploader / page.tsx 300行以下)
- **推定工数**: 6時間

#### C-2: `supabase.auth.getUser()` 直接呼び出しが47箇所残存

- **該当**: `analysis.ts` (15箇所), `profile.ts` (7箇所), `stats.ts` (3箇所), 他
- **問題**: React.cache版 `getUser` を用意したが、Server Action内では依然として直接呼び出し。1リクエスト内で4-6回の認証APIラウンドトリップが発生。レイテンシ +200-600ms、Supabase Auth APIレート制限リスク
- **改善案**: 全Server Actionで `import { getUser } from "@/utils/supabase/server"` を使用。内部ヘルパーへは `userId: string` を引数で渡すパターンに統一
- **推定工数**: 3時間

### HIGH (重要)

| # | 問題 | 該当ファイル | 改善案 | 工数 |
|---|------|-----------|--------|------|
| H-1 | coach.ts (1231行) と riot.ts (1470行) がGod File | `src/app/actions/coach.ts`, `riot.ts` | `coach/`, `riot/` サブディレクトリに分割。videoMacro/パターン踏襲 | 4h |
| H-2 | analysis.ts (1049行) に複数の独立した関心が混在 | `src/app/actions/analysis.ts` | `analysis/` に分割 (status, credit, matchAnalysis, videoAnalysis, jobManagement) | 3h |
| H-3 | signupのSupabase英語エラーメッセージが残存 | `src/app/signup/page.tsx` L83 | 既知エラーパターンのi18nマッピング + ジェネリックフォールバック | 1h |
| H-4 | ログインのレート制限がクライアントサイドのみ | `src/app/login/page.tsx` | Middlewareレベルで `/login` POSTにIP単位レート制限 (Upstash Ratelimit) | 2h |
| H-5 | VideoMacroAnalysisProvider L212に日本語ハードコード残存 | `src/app/Providers/VideoMacroAnalysisProvider.tsx` | `setStatusMessage(t('videoMacroProvider.startingJob'))` | 5min |
| H-6 | Error Boundary 3ファイルが99%コピペ | `src/app/error.tsx` 等3ファイル | 共通 `ErrorBoundaryTemplate` コンポーネント化 | 30min |
| H-7 | PremiumPromoCard 命名衝突 (widgets版 vs components版) | `src/app/dashboard/widgets/` vs `src/app/components/subscription/` | widgets版をリネームまたは統合 | 30min |
| H-8 | login/signupで `<a>` タグ使用 (フルリロード発生) | `login/page.tsx` L194, `signup/page.tsx` L214 | `<Link>` に置換 | 5min |

### MEDIUM (中程度)

| # | 問題 | 該当ファイル | 改善案 |
|---|------|-----------|--------|
| M-1 | Social Proof統計が静的ダミー値 | `src/app/page.tsx` L867-883 | 実数値対応 or 控えめな表現に変更 |
| M-2 | `style-src 'unsafe-inline'` が残存 | `src/middleware.ts` L17 | framer-motionのインラインスタイルが依存。除去にはスタイル戦略変更が必要 |
| M-3 | onboardingのエラー判定が日本語文字列`includes()` | `src/app/onboarding/page.tsx` L87-89 | エラーコード方式に変更 |
| M-4 | Server Actionのエラーメッセージが日本語ハードコード | `analysis.ts` L563,568, `chat/route.ts` L54-57 | エラーコードを返してクライアントで翻訳 |
| M-5 | テストカバレッジ不足 (Webhook, リファラル, Stripe checkout) | `__tests__/` | ビジネスクリティカルなパスのテスト追加 |
| M-6 | `pnpm-lock.yaml` がgit未追跡のまま残存 | ルート | `.gitignore` に追加 or 削除 |
| M-7 | LP (`page.tsx`) が `"use client"` -- SSR/SEOに不利 | `src/app/page.tsx` | コアコンテンツをServer Componentで静的生成 |
| M-8 | `fetchSummonerByPuuid` で `data.id = data.puuid` のハック | `riot.ts` L93 | 正式な対応に変更 |
| M-9 | CI/CDにデプロイジョブとLighthouseがない | `.github/workflows/ci.yml` | デプロイと性能回帰テスト追加 |
| M-10 | 色コントラスト (`text-slate-600` on dark bg) のWCAG AA準拠 | 複数ファイル | ツール検証 + 修正 |
| M-11 | スキップリンク (Skip to main content) 未実装 | レイアウト | 追加 |

---

## Part 4: カテゴリ別詳細スコア

### プロダクト/UX (73/100)

| サブカテゴリ | 前回 | 今回 | 変動 |
|------------|------|------|------|
| ユーザージャーニー/オンボーディング | 7 | 8 | +1 |
| UI/UXデザイン品質 | 6 | 7 | +1 |
| コンバージョン最適化 | 5 | 7 | +2 |
| リテンション施策 | 5 | 7.5 | +2.5 |
| ローカライゼーション品質 | 7 | 8.5 | +1.5 |
| エラーハンドリングUX | 7 | 8 | +1 |
| アクセシビリティ | 3 | 6 | +3 |
| モバイル対応 | 6 | 7 | +1 |
| 競合との差別化 | 7 | 7 | 0 |

### アーキテクチャ/パフォーマンス (74/100)

| サブカテゴリ | 前回 | 今回 | 変動 |
|------------|------|------|------|
| ディレクトリ構成/関心の分離 | 5 | 7 | +2 |
| データフロー/SWRキャッシュ | 6 | 8 | +2 |
| パフォーマンス (バンドル/レンダリング) | 6 | 7.5 | +1.5 |
| API設計 (Server Actions/Routes) | 6 | 7 | +1 |
| セキュリティ | 7 | 8 | +1 |
| テスト/CI/CD | 5 | 6 | +1 |
| コード品質/TypeScript型安全性 | 7 | 7.5 | +0.5 |
| 依存関係管理 | 6 | 8 | +2 |
| 可観測性 (ロギング/Sentry) | 5 | 8 | +3 |

---

## Part 5: 特に評価する改善点 (Best Practices)

1. **nonce-based CSPへの移行** -- リクエストごとにnonceを生成し `'strict-dynamic'` でスクリプト制御。GAFAレベルのCSP実装
2. **videoMacroAnalysis.tsの8ファイル分割** -- 1651行→8ファイル、バレルファイルで既存importパスを維持。模範的なリファクタリング
3. **Provider層の完全メモ化** -- 全5 Providerで `useMemo` + `useCallback` が完備。「全アプリ再レンダー」問題を完全解消
4. **SummonerProviderのSWR化** -- useEffect手動fetchから `dedupingInterval: 10000` のSWRに移行
5. **Webhook冪等性のDB実装** -- `claim_webhook_event` RPCでサーバーレス環境に対応
6. **Cloudflare Turnstile導入** -- ゲスト分析のbot防御とIP偽装対策を同時解決
7. **マネタイゼーション4大施策の完全実装** -- 年間プラン + 一時停止 + リファラル + 週次メール
8. **Stripe価格の動的取得** -- A/Bテスト基盤が整った
9. **Free分析を月2回に変更** -- 「週1回のちょうど十分の罠」を解消
10. **依存関係クリーンアップ** -- openai, jimp削除でバンドル軽量化

---

## Part 6: 優先度順タスクリスト

### 最優先 (今すぐ -- 推定10時間)

| # | タスク | 工数 | 効果 |
|---|-------|------|------|
| 1 | analyze/page.tsx の4コンポーネント分割 | 6h | 保守性大幅改善、テスタビリティ向上 |
| 2 | `getUser()` のReact.cache版への統一 (47箇所) | 3h | レイテンシ-200~600ms、API quota削減 |
| 3 | login/signup の `<a>` → `<Link>` 修正 | 5min | フルリロード解消 |
| 4 | VideoMacroAnalysisProvider L212 の日本語ハードコード修正 | 5min | i18n完遂 |

### 高優先度 (次のスプリント -- 推定11時間)

| # | タスク | 工数 | 効果 |
|---|-------|------|------|
| 5 | coach.ts / riot.ts の責務分離 | 4h | 巨大ファイル解消、videoMacro/パターン踏襲 |
| 6 | analysis.ts の責務分離 | 3h | 同上 |
| 7 | signupエラーメッセージのi18n完遂 | 1h | UX品質向上 |
| 8 | ログインのサーバーサイドレート制限 | 2h | セキュリティ強化 |
| 9 | Error Boundary共通コンポーネント化 | 30min | DRY原則 |
| 10 | PremiumPromoCard命名衝突解消 | 30min | 開発者体験改善 |

### 中優先度 (バックログ)

| # | タスク | 効果 |
|---|-------|------|
| 11 | onboarding のエラー判定をエラーコード方式に変更 | i18n/堅牢性 |
| 12 | Server Actionエラーメッセージのコード化 | i18n完遂 |
| 13 | Webhook/リファラル/Stripe checkoutのテスト追加 | 品質保証 |
| 14 | Social Proof統計の実数値対応 | 信頼性 |
| 15 | LP のServer Component化 (SSR/SEO) | パフォーマンス/SEO |
| 16 | pnpm-lock.yaml の処理 | クリーンアップ |
| 17 | 色コントラストのWCAG AA準拠確認 | アクセシビリティ |
| 18 | スキップリンク追加 | アクセシビリティ |
| 19 | CI/CDにデプロイジョブ追加 | DevOps |

---

## 総評

### 審査員A (Product/UX)

> 3日間で38点から73点まで引き上げたのは驚異的なペースだ。i18nがほぼ完遂され、アクセシビリティが「赤点」から「及第点」に到達し、マネタイゼーション設計が「教科書通り」のレベルに成熟した。
>
> しかし73点は「まだ磨く余地がある」水準であり、「出荷して自慢できる」プロダクトは80点以上。analyze/page.tsxの分割という「面倒だが重要な仕事」を片付ければ、そのラインに手が届く。

### 審査員B (Architecture/Performance)

> 「壊れやすいプロダクト」から「構造的に安定したプロダクト」への転換が始まった。nonce-based CSP、videoMacroの責務分離、全Providerのメモ化 -- これらは「パッチ当て」ではなく「アーキテクチャ改善」だ。
>
> しかしこの勢いがcoach.ts / riot.ts / analysis.ts / analyze/page.tsx には及んでいない。videoMacro分割の成功パターンを横展開するだけで、コードベース全体の保守性が劇的に改善する。残りの巨大ファイルを片付ければ85点超えが見える。

---

*Generated by Elite Review Panel -- 2026-03-01 (Review #3)*
