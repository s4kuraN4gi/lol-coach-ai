# LoLCoachAI 辛口審査レポート — プロダクト/UX & アーキテクチャ/パフォーマンス

**実施日**: 2026-02-28
**審査員**: 佐藤 美咲（プロダクト/UX）、中村 健太（アーキテクチャ/パフォーマンス）

---

## プロダクト / UX 審査 — 佐藤 美咲

### 現在のスコア: 38/100

---

### 致命的な問題（CRITICAL）

#### C-1. パスワードリセットリンクが壊れている（404確定）

**問題:** ログインページのパスワードリセットリンクが `/react-password` を指しているが、このルートは存在しない。おそらく `/reset-password` の typo。パスワードを忘れたユーザーは完全に行き詰まる。

**影響度:** ログインできないユーザーの完全な離脱。サポートコスト増大。
**該当ファイル:** `src/app/login/page.tsx` 160行目

**改善案:** 正しいパスに修正し、そのルートが実際に存在することを確認する。パスワードリセットページ自体が未実装なら、最優先で実装すべき。

---

#### C-2. `alert()` によるエラー通知が20箇所以上 — UX崩壊

**問題:** ログイン失敗、動画選択エラー、決済エラーなど、あらゆるエラー通知にブラウザネイティブの `alert()` を使用している。ゲーミングアプリのダークUIにWindowsの白いダイアログが突然出現し、ブランド体験を完全に破壊する。

**影響度:** プロダクト全体の信頼性を根本的に損なう。特に決済エラー（`checkout.ts`）で `alert('決済の開始に失敗しました。')` と日本語ハードコードされたalertが出るのは、i18n対応もなく最悪。

**該当ファイル:**
- `src/app/login/page.tsx` 35, 44, 56, 63行目
- `src/lib/checkout.ts` 19, 28, 32, 48, 57, 61行目
- `src/app/dashboard/coach/components/CoachClientPage.tsx` 166, 203, 207, 214行目
- `src/app/account/page.tsx` 58, 68, 85, 94, 129, 145行目

**改善案:** Toast通知コンポーネント（Sonner, react-hot-toastなど）を導入し、すべての `alert()` を置換する。ブランドのダークテーマに合ったデザインで統一する。

---

#### C-3. オンボーディングの英語ハードコード — ターゲットユーザーを無視

**問題:** 日本のLoLプレイヤーがメインターゲットにもかかわらず、オンボーディングページに未翻訳の英語文字列が大量に残っている。

- `"WELCOME, SUMMONER"` (144行目)
- `"Enter Riot ID"` (164行目)
- `"Current"` / `"New Icon"` / `"Target"` (200, 207, 208行目)

初回ユーザーが最初に触れるページで英語が混在しており、日本人初心者は「自分向けのサービスではない」と感じて離脱する。

**影響度:** ファネル最序盤のドロップオフに直結。

**該当ファイル:** `src/app/onboarding/page.tsx` 144, 164, 200, 207, 208行目

**改善案:** すべての文字列を `t()` に置換し、`ja.json` / `en.json` / `ko.json` に対応する翻訳を追加する。

---

#### C-4. 料金表示の不一致 — 特定商取引法違反リスク

**問題:** Extraプランの価格がプロジェクト内で不一致。料金ページでは「2,980円」とハードコードされている。価格情報の不一致は消費者を誤認させる表示であり、特定商取引法上の問題となりうる。

**影響度:** 法的リスク。ユーザーの信頼喪失。

**該当ファイル:** `src/app/pricing/page.tsx` 445行目

**改善案:** 正しい価格に統一し、価格は定数ファイルで一元管理する。Stripeの実際の設定金額とも照合すること。

---

#### C-5. ランディングページのハードコード英語 — i18n未完了

**問題:** ランディングページに以下の未翻訳英語文字列がハードコードされている。

- `"AI-Powered Coaching"` (470行目)
- `"Skill Analysis"` (593行目)
- `"Win Rate"` (629行目)
- `"Features"` (764行目)

**影響度:** ファーストインプレッションの低下。CVR直結。

**該当ファイル:** `src/app/page.tsx` 470, 593, 629, 764行目

**改善案:** すべて `t()` に置換する。

---

### 重要な問題（HIGH）

#### H-1. コーチページのレイアウトがモバイルで完全に崩壊

**問題:** CoachClientPageのメインコンテンツエリアが `grid grid-cols-12` で `col-span-8` と `col-span-4` に固定分割されている。モバイル用のレスポンシブ指定がなく、スマートフォンでは操作不可能になる。

**該当ファイル:** `src/app/dashboard/coach/components/CoachClientPage.tsx` 307-308行目

**改善案:** `grid-cols-1 lg:grid-cols-12` にし、モバイルでは縦積みにする。サイドパネルはモバイルでは折りたたみ可能にする。

---

#### H-2. ゲスト分析ページ（/analyze）の認知負荷が異常に高い

**問題:** `analyze/page.tsx` は約2,800行の巨大な単一コンポーネント。マクロ/ミクロ分析切り替え、動画キャリブレーション、広告リワード、セグメント表示、クレジット管理が詰め込まれすぎている。

**該当ファイル:** `src/app/analyze/page.tsx`

**改善案:** ステップウィザード形式に再設計する。Step 1: 動画アップロード → Step 2: 分析中 → Step 3: 結果表示。

---

#### H-3. DashboardContentのハードコード英語文字列

**問題:** `"Loading..."` と `"Syncing..."` が未翻訳。

**該当ファイル:** `src/app/dashboard/components/DashboardContent.tsx` 99, 129行目

**改善案:** `t('common.loading')` / `t('dashboard.syncing')` に置換する。

---

#### H-4. サイドバーの「Reference」セクションタイトルが英語ハードコード

**該当ファイル:** `src/app/components/layout/SidebarNav.tsx` 91行目

**改善案:** `t('sidebar.reference')` に置換する。

---

#### H-5. サインアップフォームがform要素でラップされていない

**問題:** Enterキーで送信できず、パスワードマネージャーとの連携も不完全。

**該当ファイル:** `src/app/signup/page.tsx` 117-164行目

**改善案:** `<form onSubmit={handleSignup}>` でラップし、ボタンを `type="submit"` にする。

---

#### H-6. メールフィールドが `type="text"`

**問題:** `type="email"` であれば、モバイルキーボードが `@` を表示し、ブラウザバリデーションも効く。

**該当ファイル:** `src/app/login/page.tsx` 122行目、`src/app/signup/page.tsx` 123行目

**改善案:** `type="email"` に変更する。

---

#### H-7. フッターの著作権年が「2024」にハードコード

**該当ファイル:** `src/app/pricing/page.tsx` 737行目

**改善案:** `new Date().getFullYear().toString()` に置換する。

---

#### H-8. PremiumFeatureGate のCTAが弱すぎる

**問題:** ブラーされたコンテンツの上に小さな文字が乗っているだけで、アップグレードの動機付けとして機能しない。

**該当ファイル:** `src/app/components/subscription/PremiumFeatureGate.tsx` 57-69行目

**改善案:** ロック理由の明示、具体的なベネフィット、目立つCTAボタンを追加する。

---

### 中程度の問題（MEDIUM）

| # | 問題 | ファイル |
|---|------|---------|
| M-1 | ランディングの統計数値がダミーデータ（ビジョンスコア142は異常値） | `page.tsx` 600-610行目 |
| M-2 | フィーチャーセクションに実画面がない（アイコン1つだけ） | `page.tsx` 783-789行目 |
| M-3 | アクセシビリティがほぼ皆無（aria-label, htmlFor欠如） | プロジェクト全体 |
| M-4 | ゲスト→無料→有料のファネル導線が不明確 | 分析結果ページ |
| M-5 | CoachClientPageがDashboardLayoutを自前でラップ | `CoachClientPage.tsx` 261行目 |
| M-6 | MagneticButtonが`<motion.a>`でNext.js Linkを使っていない | `page.tsx` 74-87行目 |
| M-7 | 料金比較テーブルがモバイルで横スクロール | `pricing/page.tsx` 548行目 |
| M-8 | ブランド名表記が不統一（LoL Coach AI vs LoLCoachAI） | 複数ファイル |
| M-9 | onboardingのエラー判定が日本語文字列のincludes() | `onboarding/page.tsx` 86-88行目 |

---

### 改善後の予想スコア: 72/100

---

### 総評

LoLCoachAIは、AIによるゲームプレイ分析という独自の価値提案を持ち、技術的な基盤はしっかりしている。しかし、**プロダクトとしての「仕上げ」が決定的に不足している。**

最大の問題は**国際化の中途半端さ**。3言語対応の仕組みは整っているのに、最も重要なユーザータッチポイント（オンボーディング、LP、ダッシュボード）で英語がハードコードされている。

2番目は**alert()の多用**。月額課金を取るB2C SaaSとして許容されない。

3番目は**ゲストからの転換ファネルが未設計**。ゲスト分析後に「なぜ会員登録すべきか」を伝えるCTAが存在しない。

**今すぐやるべき3つのこと:**
1. すべてのハードコード英語文字列を `t()` に置換し、i18nを完成させる
2. `alert()` を全廃し、Toastコンポーネントに統一する
3. パスワードリセットリンクの修正と、ゲスト→会員転換のCTAを設計する

---
---

## アーキテクチャ / パフォーマンス審査 — 中村 健太

### 現在のスコア: 38/100

正直に言います。個人開発としては機能的に野心的で面白いプロダクトですが、アーキテクチャ的には「動いているけど、いつ壊れてもおかしくない」状態です。100人までは耐えるでしょうが、1000人を超えた時点で複数箇所が同時に破綻します。

---

### 致命的な問題（CRITICAL）

#### CRITICAL-1: Server Actionの100MB bodySizeLimit — メモリ爆弾

**該当ファイル**: `next.config.ts` (L49-51)

```typescript
serverActions: {
    bodySizeLimit: 100 * 1024 * 1024, // 100MB
},
```

**問題**: Server ActionにBase64エンコードされた画像フレーム（最大30枚）をインラインで送信。Base64はバイナリの約1.33倍に膨張するため、仮に30フレームx500KBで約20MBのペイロードがNext.jsサーバーのメモリに乗る。Vercelのサーバレス環境では同時に5-10人がアップロードしただけでOOMが発生する。

**影響度:** 同時ユーザー10人でサービスダウンのリスク。

**改善案:**
1. フレームはSupabase StorageにプリサインドURLで直接アップロード
2. Server Actionにはストレージのパスのみを渡す
3. `bodySizeLimit`を10MB以下に戻す
4. クライアント側でフレームの解像度とJPEG品質をさらに下げる（640px, quality 0.5）

---

#### CRITICAL-2: Fire-and-Forgetパターンによるリソースリーク

**該当ファイル**: `src/app/actions/vision.ts` (L186-192)

```typescript
(async () => {
    try {
        await performVisionAnalysis(job.id, request, user.id, userApiKey);
    } catch (e) { ... }
})();
```

**問題**: Server Action内でPromiseをawaitせずにfireして即座にレスポンスを返している。Vercelのサーバレス環境ではレスポンス返却後にLambdaがフリーズされるため、分析が途中で打ち切られる可能性が極めて高い。

**影響度:** 分析ジョブがサイレントに失敗し、ユーザーのクレジットだけ消費される。

**改善案:**
1. バックグラウンド処理にはキューシステム（BullMQ + Redis、Inngest等）を使用
2. 最低限 `waitUntil()` API（Next.js 15+）を使いVercelにバックグラウンドタスクの存在を通知
3. videoMacroAnalysis.tsにも同様のパターンあり、統一修正

---

#### CRITICAL-3: getAnalysisStatusの全呼び出しでDB WRITE — Read処理に副作用

**該当ファイル**: `src/app/actions/analysis.ts` (L11-131)

**問題**: `getAnalysisStatus()`は呼び出すたびに以下のWRITE処理を実行する可能性がある:
- L36-43: Premium自己修復
- L58-88: 週次クレジット補充
- L103-106: 週次リセット
- L124: 有効期限切れ

この関数はコードベース内で **20回以上** 呼ばれており、1リクエストで同じユーザーのprofilesテーブルに4-8回のUPDATEが走る可能性がある。

**影響度:** DB負荷の不必要な増大、レースコンディションによるクレジット不整合。

**改善案:**
1. Read/Write責務を分離: `getAnalysisStatus()`は純粋なREAD関数にする
2. 週次リセットやクレジット補充はpg_cronで定期バッチ実行するか、専用関数に切り出す
3. 呼び出し元でキャッシュし、1リクエスト内で2回以上呼ばない

---

#### CRITICAL-4: supabase.auth.getUser() の36回重複呼び出し — 認証のN+1問題

**該当ファイル**: `src/app/actions/` 配下の全Server Actionファイル

**問題**: 全Server Action関数の先頭で`supabase.auth.getUser()`を呼んでおり、1つの分析リクエストで4-6回呼ばれ、各呼び出しがSupabase Auth APIラウンドトリップを発生させる。

**影響度:** レイテンシ増加（各呼び出し50-100ms）、Supabase Auth APIのレート制限到達リスク。

**改善案:**
1. 認証済みコンテキストを1度だけ取得し、以後はuserIdを引数で渡す
2. 内部ヘルパーには`(userId: string, supabase: SupabaseClient)`を渡すパターンに統一

---

#### CRITICAL-5: fetchMatchDetail が cache: 'no-store' — Riot API Rate Limitの時限爆弾

**該当ファイル**: `src/app/actions/riot.ts` (L218-221)

**問題**: 試合データは不変にもかかわらず `cache: 'no-store'` が設定されている。`riot.ts`内に`cache: 'no-store'`が **7箇所** あり、不変データにも適用。100ユーザーで即座にRiot API Rate Limit到達、サービス全停止。

**影響度:** 100ユーザーでサービス全停止。

**改善案:**
1. `fetchMatchDetail`: `next: { revalidate: 86400 }` に変更（試合データは不変）
2. `fetchLatestVersion`: `next: { revalidate: 3600 }` に変更
3. `fetchRank`: `next: { revalidate: 300 }` に変更
4. `fetchMatchIds`のみ`cache: 'no-store'`が妥当

---

### 重要な問題（HIGH）

#### HIGH-1: Provider地獄によるグローバルre-render

**該当ファイル**: `src/app/layout.tsx` (L52-60)

**問題**: AuthProvider→SummonerProvider→VisionAnalysisProvider→VideoMacroAnalysisProviderの深いネスト。VisionAnalysisProviderは14個のstateを持ち、contextの値オブジェクトにuseMemoなし。

**改善案:**
1. Context valueを`useMemo`でメモ化
2. VisionAnalysis/VideoMacroAnalysisのProviderはCoachページ配下に限定配置
3. Zustandへの移行を検討

---

#### HIGH-2: Server Action内での巨大プロンプト構築

**該当ファイル**: `vision.ts` (約130行), `coach.ts` (1246行), `videoMacroAnalysis.ts` (1639行)

**問題**: 合計6290行のServer Actionファイル群にプロンプト、ビジネスロジック、DB操作、外部API呼び出しが全て混在。

**改善案:**
1. プロンプトを`src/prompts/`に外部化
2. ビジネスロジックを`src/services/billing.ts`に分離
3. Gemini API呼び出しを`src/services/ai.ts`に統一

---

#### HIGH-3: チャットAPIにRate Limitingなし

**該当ファイル**: `src/app/api/chat/route.ts`

**問題**: DBベースのレートリミットのみでリクエストレベルのレートリミットが存在しない。並行リクエストでTOCTOU競合が発生。カウントインクリメントもnon-atomic。

**改善案:**
1. カウント操作をRPC関数でアトミックにする
2. Upstash Ratelimit等でリクエストレベルのレートリミットを追加

---

#### HIGH-4: GoogleGenerativeAIクライアントの毎回再生成

**該当ファイル**: vision.ts, coach.ts, analysis.ts, chat/route.ts

**問題**: リクエストごと、さらにモデルフォールバックのループ内で毎回`new GoogleGenerativeAI()`。接続プール再利用不可。

**改善案:** APIキーごとにシングルトンをキャッシュする。

---

#### HIGH-5: useEffect依存配列の不備によるポーリングリーク

**該当ファイル**: `src/app/Providers/VisionAnalysisProvider.tsx` (L102, L185)

**問題**: ポーリングuseEffect内で翻訳関数`t`を使用しているが依存配列に含まれていない。VideoMacroAnalysisProviderにはハードコード日本語文字列も残存。

---

#### HIGH-6: 3つのフォント読み込み

**該当ファイル**: `src/app/layout.tsx` (L9-23)

**問題**: Geist, Geist_Mono, Outfitの3フォント同時ロード。`geistMono`は限定的に使用。

**改善案:** UIフォントを1つに統一。不要フォント削除。

---

### 中程度の問題（MEDIUM）

| # | 問題 | ファイル |
|---|------|---------|
| M-1 | テストカバレッジ絶望的不足（1ファイルのみ、課金ロジックゼロ） | `__tests__/constants.test.ts` |
| M-2 | CI/CDパイプライン弱い（デプロイジョブなし、Lighthouseなし） | `.github/workflows/ci.yml` |
| M-3 | AuthProviderでcreateClient()が毎render再生成 | `AuthProvider.tsx` L19 |
| M-4 | Stripe Checkoutのプロレーション手動計算（Stripe機能を使うべき） | `checkout/route.ts` L118 |
| M-5 | fetchMatchDetailの二重呼び出し（同じデータ2-3回フェッチ） | `VisionAnalysisProvider.tsx` |
| M-6 | console.logの大量残存（ユーザーデータ含む、GDPR懸念） | 全Server Action |
| M-7 | エラーバウンダリの不統一（Server Actionの戻り値型がバラバラ） | 複数 |
| M-8 | SWRのグローバル設定が弱い（revalidateOnFocus: false固定） | `SWRProvider.tsx` |
| M-9 | VisionAnalysisProviderのBase64 data URL保持（メモリ圧迫） | `VisionAnalysisProvider.tsx` |
| M-10 | ディレクトリ名の不一致（providers vs Providers、デプロイ時エラー） | `src/app/providers/` vs `src/app/Providers/` |

---

### 改善後の予想スコア: 72/100

---

### 総評

LoLCoachAIは「一人の開発者が全てを作った」プロダクトとしては驚くべき機能量を持っている。しかし、アーキテクチャ的には「動くコードを最速で書く」フェーズから「壊れないコードに育てる」フェーズへの移行が必要。

**最も緊急度が高い3つの改善:**
1. **Server Actionの100MBペイロード問題の解決**（CRITICAL-1）— Supabase Storage経由に変更
2. **Fire-and-Forgetの廃止**（CRITICAL-2）— waitUntilまたはジョブキューの導入
3. **Riot APIキャッシュ戦略の導入**（CRITICAL-5）— 不変データのキャッシュ有効化

この3つだけで、スコアは38から55に上がる。

6290行のServer Actionファイル群は、最低でも「認証・認可」「課金」「AI呼び出し」「外部API」の4レイヤーに分離してください。現在の状態では、Stripe WebhookのバグがRiot APIの呼び出しに影響し得る構造になっており、障害の影響範囲が制御不能です。

---

## 総合スコアサマリー

| 審査分野 | 現在 | 改善後（予想） |
|---------|------|--------------|
| プロダクト / UX（佐藤） | **38/100** | **72/100** |
| アーキテクチャ / パフォーマンス（中村） | **38/100** | **72/100** |

## 優先度順タスクリスト

### 最優先（今すぐ）
1. パスワードリセットリンクの修正 `/react-password` → `/reset-password`
2. `alert()` を全廃 → Toastコンポーネント（Sonner等）に統一
3. ハードコード英語文字列の全i18n化（LP、オンボーディング、ダッシュボード）
4. Riot API fetch に適切なキャッシュ戦略を導入
5. Fire-and-Forget廃止 → `waitUntil()` 導入

### 高優先度
6. `getAnalysisStatus()` のRead/Write分離
7. `supabase.auth.getUser()` の重複呼び出し削減
8. Server Actionの100MB bodySizeLimit問題の解決
9. CoachClientPageのモバイルレスポンシブ修正
10. チャットAPIのアトミックRate Limiting
11. Provider地獄の解消（useMemo、配置最適化）
12. サインアップフォームの`<form>`ラップ + `type="email"` 修正
13. 料金表示の不一致修正

### 中優先度
14. ゲスト→会員転換CTAの設計
15. PremiumFeatureGateのCTA強化
16. テストカバレッジ拡充（課金ロジック、Webhook）
17. Server Actionのレイヤー分離（認証/課金/AI/外部API）
18. console.log の構造化ログ移行
19. フォント読み込み最適化
20. ディレクトリ名の統一（providers/Providers）
21. アクセシビリティ基本対応
22. onboardingのエラーコード方式への移行
