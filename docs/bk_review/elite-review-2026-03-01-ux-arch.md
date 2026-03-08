# LoLCoachAI 辛口審査レポート — プロダクト/UX & アーキテクチャ/パフォーマンス

**実施日**: 2026-03-01
**審査員**: 佐藤 美咲（プロダクト/UX）、中村 健太（アーキテクチャ/パフォーマンス）
**前回審査**: 2026-02-28（docs/bk_review/ に格納済み）

---

## プロダクト / UX 審査 — 佐藤 美咲

### 前回指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| C-1 | パスワードリセットリンクが `/react-password` を指していた | typoで遷移不能 | `/reset-password` に修正済み。ページも正しく存在する | ✅改善済み |
| C-2 | `alert()` によるエラー通知が20箇所以上 | ブラウザネイティブalertが大量 | `alert()` は0件。全て `toast` (sonner) または inline error表示に移行 | ✅改善済み |
| C-3 | オンボーディングの英語ハードコード | Welcome等が全て英語 | 全テキストが `t()` 経由。ja/en/ko各1465行の翻訳ファイル完備 | ✅改善済み |
| C-4 | 料金表示の不一致 | 複数箇所で価格がバラバラ | `NEXT_PUBLIC_PREMIUM_PRICE` / `NEXT_PUBLIC_EXTRA_PRICE` 環境変数で一元管理。locale JSONからも価格ハードコード削除済み | ✅改善済み |
| C-5 | ランディングページのハードコード英語 | ほぼ全文が英語 | `t()` で国際化済み。ただし**ヒーロー見出し "LEVEL UP" / "YOUR RANK" が依然ハードコード** | ⚠️部分改善 |
| H-1 | コーチページのレイアウトがモバイルで崩壊 | 横スクロール発生 | `grid-cols-1 lg:grid-cols-12` でモバイルは1カラム化。SidebarNavもドロワー化済み。大幅改善 | ✅改善済み |
| H-2 | ゲスト分析ページが2800行の巨大コンポーネント | 2800行の単一ファイル | 1554行に削減。Provider分離（VisionAnalysisProvider, VideoMacroAnalysisProvider, CoachUIProvider）実施済み | ⚠️部分改善 |
| H-3 | DashboardContentのハードコード英語文字列 | 複数箇所で英語直書き | 全て `t()` 経由に移行済み | ✅改善済み |
| H-4 | サイドバーの「Reference」セクション英語ハードコード | "Reference" が直書き | `t('sidebar.reference')` で「リファレンス」に翻訳済み | ✅改善済み |
| H-5 | サインアップフォームがform要素でラップされていない | `<div>` のみ | `<form onSubmit={handleSignup}>` で正しくラップ済み | ✅改善済み |
| H-6 | メールフィールドが type="text" | ブラウザ検証なし | login: `type="email"`, signup: `type="email"` に修正済み | ✅改善済み |
| H-7 | フッターの著作権年が「2024」にハードコード | 2024固定 | `new Date().getFullYear()` で動的取得。`{year}` プレースホルダー置換方式 | ✅改善済み |
| H-8 | PremiumFeatureGateのCTAが弱すぎる | テキストのみ | ロックアイコン + 「アップグレード」ボタン（gradient付き）+ benefit説明文。/pricing への導線あり | ✅改善済み |
| M-1〜M-9 | 統計ダミー、アクセシビリティ等 | 各種問題あり | 後述（新規問題セクションで個別に判定） | |

### 前回からのスコア変動
前回: 38/100 → 今回: **62/100**（+24）

---

### 新規発見の問題

#### CRITICAL

**NC-1: LP ヒーロー見出し "LEVEL UP" / "YOUR RANK" がハードコード英語**
- 該当ファイル: `src/app/page.tsx` L480-482
- ユーザーが最初に目にする最重要テキストが日本語環境でも英語のまま。CTAの直上にあり、日本市場ではコンバージョンを直撃する。`t()` のキーも用意されていない。
- ゲーミング文脈で意図的に英語という判断であっても、せめてサブテキストを目立たせるか、日本語版は別の見出しにすべき。

#### HIGH

**NH-1: ゲスト分析ページのミクロ分析セクションにハードコード英語が10箇所以上**
- 該当ファイル: `src/app/analyze/page.tsx` L1348-1412
- "Damage Given", "Damage Taken", "Optimal Action", "Positioning", "Combo Execution", "Auto-Attack Weaving", "Skills", "Hit", "Missed", "N/A", "CD Context" が全て英語直書き
- ゲストユーザーが触れるページであり、i18n抜けはプロダクト品質を著しく下げる

**NH-2: CoachClientPageに残るハードコード英語**
- 該当ファイル: `src/app/dashboard/coach/components/CoachClientPage.tsx` L427, L473
- "Local File"（ファイルアップロードボタン）と "Premium"（バッジテキスト）が直書き

**NH-3: サインアップページのGoogle OAuthエラーが生のSupabase英語メッセージ**
- 該当ファイル: `src/app/signup/page.tsx` L32
- `setError(error.message)` — Supabase SDKの英語エラーがそのまま表示される。login側は `toast.error()` で対処済みだが、signup側は `setError` にrawメッセージを入れている
- 同様に reset-password (L32) も `setError(resetError.message)` で生の英語エラー

**NH-4: アクセシビリティが壊滅的**
- `aria-label` の使用がプロジェクト全体で僅か4箇所（SidebarNav 2箇所、LP 1箇所、InsightCard 1箇所）
- ログインフォームの `<input>` に `id` / `htmlFor` ペアがない（reset-password のみ正しく実装）
- 料金表のテーブルに `scope` 属性なし
- モーダル（CancelConfirmModal、signup成功モーダル）に `role="dialog"` / `aria-modal="true"` なし
- フォーカストラップもなし — Tab キーでモーダル背後に抜ける

#### MEDIUM

**NM-1: LP の Social Proof セクションの数値が静的ダミー**
- `t('landingPage.socialProof.stat1Value')` 等で翻訳キーにしているが、中身は静的。「10,000+」のような数値をi18n辞書に入れるのは良いが、実際のユーザー数と乖離している場合は信頼を損なう。サービスのフェーズとして適切か検討すべき

**NM-2: analyze/page.tsx が依然1554行**
- 前回の2800行から大幅に削減されたが、SRP（単一責任原則）的にはまだ大きい。マクロ分析UI、ミクロ分析UI、ゲスト制限ロジック、動画アップロードが1ファイルに同居。少なくともミクロ分析結果表示部分（L1300-1420あたり）は別コンポーネントに切り出すべき

**NM-3: VideoMacroAnalysisProviderの日本語ハードコードエラーメッセージ**
- `src/app/providers/VideoMacroAnalysisProvider.tsx` L130, L145
- `"分析に失敗しました"`, `"ポーリングエラー: ..."` が直書き。i18n未対応

**NM-4: DashboardContentのPremiumPromoCardが別コンポーネント（widgets版）**
- `src/app/dashboard/widgets/PremiumPromoCard.tsx` と `src/app/components/subscription/PremiumPromoCard.tsx` の2つが存在し、Props型が異なる（`status` vs `initialStatus`）。命名が同一で混乱を招く。意図的な分離であっても、ファイル名を変えるべき

**NM-5: LP の MagneticButton が `<motion.a>` を使用し Next.js の Link を迂回**
- `<motion.a href={href}>` で遷移しており、Next.js のクライアントサイドルーティングが効かない。全ページリロードが発生し、初回ペイント時間を無駄にしている

---

### 残存する問題（前回から未改善のもの）

| # | 問題 | 状態 |
|---|------|------|
| C-5 (部分) | LP ヒーロー見出し英語ハードコード | "LEVEL UP YOUR RANK" が残存 |
| H-2 (部分) | analyze/page.tsx の巨大さ | 2800→1554行に削減されたが、まだ大きい |
| M (旧) | アクセシビリティ全般 | aria属性、フォーカス管理ともに未整備 |

---

### 総評

率直に言う。**前回の38点から24点上がって62点。「壊れているプロダクト」から「機能するがプロの仕事ではないプロダクト」に移行した段階だ。**

良い点をまず認める。`alert()` の全廃は英断だった。sonner（toast）への統一は正しい判断で、エラーハンドリングUXが劇的に改善された。i18nの対応も素晴らしく、3言語1465行ずつの翻訳ファイルを整備し、主要コンポーネントのほぼ全てを `t()` 経由にした。サインアップの `<form>` ラップ、`type="email"` 修正、フッターの動的年号、パスワードリセットリンクの修正など、前回CRITICALに指定した項目は全て潰した。PremiumFeatureGateのCTAも格段に良くなり、ロックアイコン + 具体的メリット + アクショナブルなボタンという3要素が揃った。SidebarNavのモバイルドロワー化、CoachClientPageのProvider分離によるリファクタリングも適切。チャーンプリベンションのCancelConfirmModalは、理由選択 + 失うもの一覧 + Stripe Portalへの導線という教科書的な実装で感心した。

しかし、**「あと一歩」が多すぎる。** i18nは9割方できているのに、肝心のLPヒーローと、ゲスト分析のミクロ結果表示という「ユーザーが最も目にする場所」に英語が残っている。エラーハンドリングもsonnerに統一したはずなのに、signupのGoogle OAuth失敗時とreset-passwordでSupabaseの英語エラーがそのまま露出する。やるなら最後まで徹底しろ。

アクセシビリティは率直に言って**赤点**だ。aria属性4箇所はプロダクトとして出荷するレベルではない。特にモーダル系（CancelConfirmModal、signup成功モーダル）にrole="dialog"すらないのは、スクリーンリーダーユーザーを完全に無視している。WCAG 2.1 AA基準に照らすと、フォームのlabel-input紐付け、フォーカストラップ、色コントラスト（`text-slate-600` on `bg-[#0a0a0f]` は比率不足の可能性大）など、修正点が山積している。

MagneticButtonが `<a>` タグで全ページリロードを引き起こしている点は、SPAとしての価値を自ら毀損している。かっこいいアニメーションを入れたのは分かるが、パフォーマンスを犠牲にしてまで入れるものではない。

---

### 改善後の予想スコア: 78/100

---

### 今すぐやるべき3つのこと

1. **LP ヒーロー見出しとanalyze/page.tsxのミクロ分析セクションのi18n完遂** — "LEVEL UP YOUR RANK" を `t()` キーに、analyze/page.tsxの "Damage Given", "Positioning" 等10箇所を全て翻訳キーに置換。加えてCoachClientPageの "Local File" / "Premium" も。推定工数: 1時間以内

2. **全モーダルに `role="dialog"` + `aria-modal="true"` + フォーカストラップ追加、全フォームの `label`-`input` 紐付け整備** — CancelConfirmModal、signup成功モーダル、SidebarNavのモバイルドロワーが対象。login/signupの各inputに `id` と `htmlFor` を追加。推定工数: 2-3時間

3. **MagneticButton を Next.js `Link` ベースに書き換え** — `<motion.a>` を `<motion(Link)>` に変更するか、`next/link` の `legacyBehavior` + `passHref` パターンで対応。LP→signup の遷移でフルリロードが走っている現状は、ファーストインプレッションでのパフォーマンス損失が無視できない。推定工数: 30分

---
---

## アーキテクチャ / パフォーマンス審査 — 中村 健太

### 前回指摘の改善状況

| # | 問題 | 前回状態 | 現在の状態 | 判定 |
|---|------|---------|-----------|------|
| CRITICAL-1 | Server Actionの100MB bodySizeLimit | `bodySizeLimit: '100mb'` | `bodySizeLimit: 5 * 1024 * 1024` (5MB) + コメントで根拠明記 | ✅改善済み |
| CRITICAL-2 | Fire-and-Forgetパターンによるリソースリーク | 生の `Promise` を放置してレスポンスを返していた | `next/server` の `after()` に移行。vision.ts L185, videoMacroAnalysis.ts L1281。サーバーレスでもジョブ完了が保証される | ✅改善済み |
| CRITICAL-3 | getAnalysisStatusの全呼び出しでDB WRITE | 毎回 `refreshAnalysisStatus()` でUPDATE発行 | `getAnalysisStatus()` が純粋READ（SELECT only）に分離。WRITE処理は `refreshAnalysisStatus()` に集約。コメントにも「純粋なREAD - 副作用なし」と明記 | ✅改善済み |
| CRITICAL-4 | supabase.auth.getUser()の36回重複呼び出し | 各関数で毎回 `getUser()` | `callerUserId` パターン導入。analysis.ts内で改善が確認できる。ただし全ソース横断で45箇所のgetUser()がまだ残存 | ⚠️部分改善 |
| CRITICAL-5 | fetchMatchDetailが cache: 'no-store' | Riot APIに毎回アクセス | `next: { revalidate: 86400 }` (24時間キャッシュ) + 429/5xxリトライロジック付き。fetchRank系も `revalidate: 300` | ✅改善済み |
| HIGH-1 | Provider地獄によるグローバルre-render | useMemoなし | VisionAnalysisProvider, VideoMacroAnalysisProvider, CoachUIProvider の contextValue が `useMemo` でメモ化。ただし AuthProvider, SummonerProvider, LanguageProvider は未メモ化 | ⚠️部分改善 |
| HIGH-2 | Server Action内での巨大プロンプト構築（6290行混在） | 1ファイルに全てのロジック | 合計6181行。promptUtils.ts への分離はされたが、各ファイル自体はまだ巨大 | ⚠️部分改善 |
| HIGH-3 | チャットAPIにRate Limitingなし | 無制限 | `increment_daily_chat_count` RPC で1日20回のアトミックなレート制限実装。auth.uid()チェック付き | ✅改善済み |
| HIGH-4 | GoogleGenerativeAIクライアントの毎回再生成 | `new GoogleGenerativeAI()` を毎回呼び出し | `gemini.ts` でサーバーキーのみキャッシュ (TTL 5分, 最大50エントリ)。ユーザーキーはキャッシュしない設計で正しい | ✅改善済み |
| HIGH-5 | useEffect依存配列の不備によるポーリングリーク | 依存配列の不備 | クリーンアップで `clearInterval` + `isMounted` フラグ。適切 | ✅改善済み |
| HIGH-6 | 3つのフォント読み込み | Geist, Geist_Mono, Outfit の3フォント | 変更なし。3フォント維持 | ❌未改善 |
| M-1 | テスト不足 | テストなし | `constants.test.ts` が1ファイルのみ存在 (142行)。Server Action / API Route のテストはゼロ | ⚠️部分改善 |
| M-2 | CI/CD不足 | なし | `.github/workflows/ci.yml` でlint + typecheck + test + build の4ステップ。デプロイパイプラインはなし | ⚠️部分改善 |
| M-3 | console.log/warn/error の多用 | 大量 | 124箇所がまだ残存。Sentryが導入されているのに console.error が主な手段 | ❌未改善 |
| M-4 | RPC関数のauth check不足 | auth.uid()チェックなし | 全SECURITY DEFINER関数に `auth.uid()` チェック追加 | ✅改善済み |
| M-5 | profiles RLS の SELECT全公開 | 全ユーザーが閲覧可能 | 自分のプロフィールのみ閲覧可能に修正。UPDATEも機密カラム保護付き | ✅改善済み |
| M-6 | Service Role Client の乱用 | adminDb を各所で使用 | Webhookのみ使用。他は全て RPC (SECURITY DEFINER) 経由に移行 | ✅改善済み |
| M-7 | Webhook冪等性なし | 重複処理の可能性 | インメモリSet (最大1000件) で冪等性。ただしサーバーレス環境では不十分 | ⚠️部分改善 |
| M-8 | 入力バリデーション不足 | zodなし | `src/lib/validation.ts` に包括的なzodスキーマ。全Server Actionの入口でバリデーション実施 | ✅改善済み |
| M-9 | CSP未設定 | なし | 詳細なCSPディレクティブ。環境変数ベースで構築。HSTS, Permissions-Policy も設定済み | ✅改善済み |
| M-10 | Error Boundary なし | なし | 3ファイルが存在。Sentry連携 + eventId表示 + 多言語対応 | ✅改善済み |

### 前回からのスコア変動
前回: 38/100 → 今回: **62/100**（+24）

---

### 新規発見の問題

#### CRITICAL

**CRITICAL-NEW-1: Webhook冪等性がインメモリSetで、サーバーレス環境では無効**

ファイル: `src/app/api/webhooks/stripe/route.ts` L12-14

```typescript
const processedEvents = new Set<string>();
const MAX_PROCESSED = 1000;
```

Vercelのサーバーレス環境では、各リクエストが異なるインスタンスで処理される可能性がある。インメモリSetはインスタンスを跨いで共有されないため、Stripeがリトライした際に同じイベントが重複処理される。`profiles`テーブルの`subscription_status`が二重更新されたり、古いサブスクリプションが二重キャンセルされるリスクがある。

**改善案:** Supabaseに`processed_webhook_events`テーブルを作り、`event.id`をUNIQUE制約付きでINSERTする方式に変更すべき。

---

**CRITICAL-NEW-2: Provider contextValueの一部が未メモ化 — 言語切替で全アプリが再レンダー**

ファイル: `src/contexts/LanguageContext.tsx` L81-85

```typescript
const contextValue: LanguageContextType = {
    language: isHydrated ? language : 'ja',
    setLanguage,
    t,
};
```

`contextValue`がレンダーごとに新しいオブジェクト参照を生成する。LanguageProviderはアプリのルート(`layout.tsx` L53)にあるため、`language`が変わるたびにアプリ全体が再レンダーされる。

同様に `AuthProvider` と `SummonerProvider` も `value` がメモ化されていない。

**改善案:** `useMemo` + `useCallback`で安定化すべき。

---

#### HIGH

**HIGH-NEW-1: videoMacroAnalysis.tsが1651行のGod File**

1651行に型定義、API呼び出し、プロンプト構築、ビジネスロジック、DB操作が全て混在。少なくとも型定義/プロンプト生成/ビジネスロジック/Server Actionの4レイヤーに分割すべき。

---

**HIGH-NEW-2: analyzeMatchQuickのクレジット消費がアトミックでない**

ファイル: `src/app/actions/analysis.ts` L640-653

分析結果の保存とクレジット消費が別トランザクション。`upsert`が成功してRPCが失敗した場合、タダ乗りが発生。逆にRPCが成功してupsertが失敗した場合、クレジットだけ消費されて結果が保存されない。`analyzeVideo`のDEBIT-FIRSTパターン（先にクレジット消費 + 失敗時リファンド）の方がまだマシだが、`analyzeMatchQuick`にはリファンドロジックがない。

---

**HIGH-NEW-3: getActiveSummoner()がSummonerProvider内で過剰に再呼び出し**

ファイル: `src/app/providers/SummonerProvider.tsx` L35

`fetchActive`の依存配列に`[user, authLoading]`がある。`user`オブジェクトはSupabaseの`onAuthStateChange`で新しい参照が来るたびに変わるため、セッションリフレッシュのたびに`getActiveSummoner()`が再呼び出しされる。SWRを使ってクライアントサイドキャッシュすべき。

---

**HIGH-NEW-4: 45箇所の `supabase.auth.getUser()` が残存**

`callerUserId`パターンで`analysis.ts`内の2関数は改善されたが、ソース全体で45箇所の`getUser()`呼び出しが残っている。Next.jsの`React.cache`やミドルウェアレベルでのuser取得 + 受け渡しパターンを検討すべき。

---

#### MEDIUM

| # | 問題 | ファイル |
|---|------|---------|
| M-NEW-1 | openaiパッケージが依存関係に存在するが未使用 | `package.json` L24 |
| M-NEW-2 | jimp依存によるサーバーサイドバンドル肥大化 | `package.json` L22 |
| M-NEW-3 | pnpm-lock.yamlがgit未追跡。npmとpnpmが混在 | git status |
| M-NEW-4 | fetchSummonerByPuuidのハック的フォールバック（PUUIDをSummonerIDとして使用） | `riot.ts` L91-92 |
| M-NEW-5 | VisionAnalysisProviderのstartAnalysis関数がuseCallbackでラップされておらずuseMemoが無効化 | `VisionAnalysisProvider.tsx` L291 |

---

### 残存する問題（前回から未改善のもの）

1. **HIGH-6 (3フォント読み込み)**: Geist + Geist_Mono + Outfitの3フォント。初期表示を確実に遅くする。
2. **M-3 (console.log/warn/error の大量残存)**: 124箇所。Sentryに移行すべき。
3. **テストカバレッジ**: テストファイルが`constants.test.ts`の1ファイルのみ。ビジネスロジック（クレジット消費、リミットチェック）のユニットテストが皆無。

---

### 総評

前回38点から62点。24点の上昇は事実であり、改善の努力は認める。特に以下は評価に値する:

1. **`getAnalysisStatus` の READ/WRITE分離**: 純粋なREAD関数と副作用を持つWRITE関数を分離したことで、呼び出し側の意図が明確になった。
2. **`after()` への移行**: Next.js の `after()` を使ったバックグラウンド処理は、サーバーレス環境での正しいアプローチ。fire-and-forget問題を根本的に解決した。
3. **Riot APIキャッシュ戦略**: `revalidate: 86400` で不変データを24時間キャッシュする判断は完全に正しい。429リトライも `Retry-After` ヘッダーを尊重している。
4. **RLS/RPC のセキュリティ強化**: `SECURITY DEFINER` 関数に `auth.uid()` チェックを追加し、`profiles`テーブルのUPDATE RLSで機密カラムを保護した。これはプロダクション品質。
5. **CSPとセキュリティヘッダー**: 環境変数からオリジンを動的構築するCSPは丁寧。HSTSのpreloadまで含めている。

しかし、率直に言って62点は「まだ本番に出すには怖い」水準だ。

最大の懸念は **Webhook冪等性がインメモリSet** という点。これは課金に直結するバグで、Stripeのリトライで二重課金や二重ダウングレードが発生する。Vercelでは確実に壊れる。これが修正されない限り、商用サービスとしての信頼性はゼロだ。

次に **テストカバレッジ**。constants.test.ts の142行だけでは話にならない。クレジット消費ロジック、リミットチェック、リファンドフローといったビジネスクリティカルなコードにテストがない。「動いているからOK」は個人プロジェクトの論理であり、ユーザーの金を扱うサービスの論理ではない。

コードの肥大化も深刻。videoMacroAnalysis.ts 1651行、coach.ts 1230行、riot.ts 1468行。これらは保守不能になる一歩手前だ。

Provider層の未メモ化も、ユーザーが増えた時にパフォーマンス問題として顕在化する。LanguageProvider起点の全ツリー再レンダーは、言語切替時に体感できるほどのラグを生む。

---

### 改善後の予想スコア: 78/100

---

### 今すぐやるべき3つのこと

1. **Webhook冪等性をDBベースに移行** (CRITICAL-NEW-1)
   - `processed_webhook_events` テーブルを作成 (`event_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ DEFAULT now()`)
   - Webhookハンドラの冒頭で `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id` を実行
   - 戻り値がなければ「既に処理済み」としてスキップ
   - 所要時間: 2時間

2. **AuthProvider / SummonerProvider / LanguageProvider の contextValue メモ化** (CRITICAL-NEW-2)
   - 3つのProviderの `value` を `useMemo` でラップ
   - `setLanguage`, `setUser`, `refreshSummoner` を `useCallback` でラップ
   - LanguageProviderの `t` 関数を `useCallback` + 依存配列 `[language]` でメモ化
   - VisionAnalysisProvider の `startAnalysis` を `useCallback` でラップ
   - 所要時間: 1時間

3. **ビジネスクリティカルロジックのユニットテスト追加** (残存M-1)
   - `analyzeMatchQuick` のクレジット消費/リファンドフロー
   - `refreshAnalysisStatus` RPC の週次リセット/クレジット補充ロジック
   - Webhookの各ハンドラ
   - 最低10テストケース、カバレッジ目標はビジネスロジック80%以上
   - 所要時間: 4-6時間

---
---

## 総合スコアサマリー

| 審査分野 | 前回 (02-28) | 今回 (03-01) | 変動 | 改善後予想 |
|---------|-------------|-------------|------|----------|
| プロダクト / UX（佐藤） | **38/100** | **62/100** | +24 | **78/100** |
| アーキテクチャ / パフォーマンス（中村） | **38/100** | **62/100** | +24 | **78/100** |

---

## 優先度順タスクリスト

### 最優先（今すぐ）
1. Webhook冪等性をDBベースに移行（インメモリSetはサーバーレスで無効）
2. Provider contextValue のメモ化（LanguageProvider, AuthProvider, SummonerProvider）
3. LP ヒーロー見出し + analyze/page.tsx ミクロ分析セクションの i18n 完遂

### 高優先度
4. 全モーダルにaria属性 + フォーカストラップ追加
5. フォームの label-input 紐付け整備
6. MagneticButton を Next.js Link ベースに書き換え
7. VisionAnalysisProvider の startAnalysis を useCallback 化
8. analyzeMatchQuick のクレジット消費をDEBIT-FIRSTパターンに修正

### 中優先度
9. ビジネスクリティカルロジックのユニットテスト追加
10. videoMacroAnalysis.ts の責務分離（型/プロンプト/ロジック/Action）
11. console.error → Sentry.captureException への移行
12. 未使用依存関係の削除（openai, jimp確認）
13. 3フォント → 2フォントに最適化
14. signup/reset-password のエラーメッセージi18n化
15. SummonerProvider を SWR ベースに書き換え
