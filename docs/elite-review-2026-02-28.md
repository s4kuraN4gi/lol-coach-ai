# LoLCoachAI 辛口審査レポート (2026-02-28)

**審査チーム:**
- **田中 誠** — Security Architect (ex-Google/LINE) — セキュリティ担当
- **山本 彩** — Head of Growth (ex-Stripe/SmartNews) — マネタイゼーション担当

---

## 1. セキュリティ審査結果

### 現在の評価: 62/100点

前回対応でCSRF・IDOR・DOMPurify・RLS修正・アトミック操作など多数の改善が入っている点は認める。しかしゼロベースで見ると、まだプロダクションレベルとは言い難い問題が複数残っている。

---

### 発見事項（深刻度順）

#### [CRITICAL-1] profiles テーブルの SELECT RLS が全公開 — Stripe顧客情報・課金状態が全ユーザーに漏洩可能

- **ファイル**: `supabase_schema.sql:22-23`
- **問題**: `create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);` により、認証済みの全ユーザーがSupabase JS clientを使って全profilesレコードを読める。profilesテーブルには `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `verification_challenge`（アイコン認証チャレンジ含む）等のセンシティブデータが格納されている。
- **攻撃シナリオ**:
  1. 攻撃者がアカウント作成後、ブラウザコンソールで `supabase.from('profiles').select('*')` を実行
  2. 全ユーザーの `stripe_customer_id`, `verification_challenge`（targetIconId含む）を取得
  3. `verification_challenge` を見ることで他人のアイコン認証チャレンジを突破し、他人のサモナーを自分のアカウントに紐付ける（アカウント乗っ取り）
- **修正案**:
```sql
DROP POLICY "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);
```

#### [CRITICAL-2] profiles テーブルの UPDATE RLS がカラム制限なし — ユーザーが自分の `is_premium`, `analysis_credits` を自由に書き換え可能

- **ファイル**: `supabase_schema.sql:28-29`, `supabase_schema_v3.sql:19-39`
- **問題**: `create policy "Users can update their own profile." on public.profiles for update using ((select auth.uid()) = id);` により、ユーザーは自分のprofileの **全カラム** を更新できる。
- **攻撃シナリオ**:
  1. ブラウザコンソールで `supabase.from('profiles').update({ is_premium: true, subscription_tier: 'extra', analysis_credits: 999 }).eq('id', myUserId)` を実行
  2. 即座にPremium/Extra権限を無料で取得
- **修正案**: PostgreSQL の RPC 関数を使って、センシティブカラムの更新を Service Role 経由のみに制限。

#### [HIGH-1] `analyzeTurningPoints` Server Action に認証チェックなし — Gemini APIを無料消費可能

- **ファイル**: `src/app/actions/analysis_timeline.ts:13-57`
- **問題**: `'use server'` 宣言のエクスポート関数だが、`supabase.auth.getUser()` による認証チェックが一切ない。
- **攻撃シナリオ**: 攻撃者が任意のリクエストボディで直接呼び出し、Gemini API Keyを使って無制限にAI分析を実行。
- **修正案**: 関数冒頭に認証チェックを追加。

#### [HIGH-2] `claimDailyReward` にレースコンディション — 同日に複数回クレジット取得可能

- **ファイル**: `src/app/actions/analysis.ts:885-924`
- **問題**: SELECT（日付チェック）とUPDATE（クレジット付与）が非アトミック。
- **攻撃シナリオ**: `Promise.all([claimDailyReward(), ...])` を10回同時実行し、1日10クレジットを取得。
- **修正案**: PostgreSQL RPC関数にして `UPDATE ... WHERE last_reward_ad_date < TODAY RETURNING ...` のようなアトミック操作にする。

#### [HIGH-3] API ルートでの内部エラーメッセージ直接露出

- **ファイル**: `src/app/api/billing/route.ts:53`, `src/app/api/chat/route.ts:182`, `src/app/api/checkout/route.ts:173`
- **問題**: catch ブロックで `error.message` をそのままレスポンスに含めている。
- **修正案**: 汎用エラーメッセージに置換し、詳細はサーバーログ（Sentry）のみに出力。

#### [HIGH-4] Content-Security-Policy (CSP) ヘッダー未設定

- **ファイル**: `next.config.ts:4-21`
- **問題**: CSPが完全に欠如。DOMPurifyが回避された場合のフォールバックがない。
- **修正案**: 適切なCSPヘッダーを追加。

#### [HIGH-5] Strict-Transport-Security (HSTS) ヘッダー未設定

- **ファイル**: `next.config.ts`
- **問題**: HTTPS 強制のための HSTS ヘッダーが設定されていない。
- **修正案**: `Strict-Transport-Security: max-age=31536000; includeSubDomains` を追加。

#### [MEDIUM-1] Server Actions の bodySizeLimit が100MB — メモリ枯渇DoS

- **ファイル**: `next.config.ts:28`
- **問題**: 全Server Actionに100MB制限が適用。認証済みユーザーが大量のリクエストでOOMを引き起こせる。
- **修正案**: ビデオ分析ルートのみに大きなリミットを設定し、それ以外は1MB程度にする。

#### [MEDIUM-2] RSO認証コールバックでの既存ユーザーのパスワード強制リセット

- **ファイル**: `src/app/api/auth/callback/riot/route.ts:118-166`
- **問題**: 既存RSO認証ユーザーのログイン時に毎回パスワードを更新。Google OAuthで同じメールのユーザーが存在する場合の衝突リスク。
- **修正案**: RSO専用のカスタムクレームで識別する設計に変更。

#### [MEDIUM-3] `getReplayData` にユーザー認証チェックなし

- **ファイル**: `src/app/actions/replay.ts:14-79`
- **問題**: 認証チェックがなく、DBキャッシュ不在時にRiot APIを消費させる攻撃が可能。
- **修正案**: 関数冒頭に認証チェックを追加。

#### [MEDIUM-4] SECURITY DEFINER 関数の権限エスカレーション リスク

- **ファイル**: `supabase/migrations/20260227000001_atomic_credit_functions.sql`
- **問題**: 4つのRPC関数全てが `SECURITY DEFINER` だが、`p_user_id` が呼び出し元ユーザーと一致するかの検証がない。他人のクレジットを操作可能。
- **修正案**: 各関数内に `IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'unauthorized'; END IF;` を追加。

#### [MEDIUM-5] IP偽装によるゲストクレジット無限取得

- **ファイル**: `src/app/actions/guestCredits.ts:14-37`
- **問題**: Cloudflare以外の環境では `x-forwarded-for` が偽装可能。
- **修正案**: `cf-connecting-ip` が存在しない場合は `x-forwarded-for` を信頼しない設計に。

#### [MEDIUM-6] `performFullUpdate` で外部入力のpuuidに認可チェックなし

- **ファイル**: `src/app/actions/stats.ts:351-503`
- **問題**: RLSが唯一の防御線。コード上に明示的な所有権チェックがない。
- **修正案**: コード上でも `account.user_id === authUser.id` を検証。

#### [LOW-1] Server Action での API レート制限なし

- **ファイル**: 全Server Actions
- **問題**: クレジット消費しない関数にはレート制限がない。
- **修正案**: `@upstash/ratelimit` などを middleware に導入。

#### [LOW-2] `x-forwarded-host` を使ったリダイレクト先制御

- **ファイル**: `src/app/auth/callback/route.ts:15-24`
- **問題**: ヘッダー偽装でリダイレクト先を制御できる可能性。
- **修正案**: 環境変数ベースのリダイレクトに統一。

#### [LOW-3] `verifyAndAddSummoner` でのエラーメッセージに内部情報含有

- **ファイル**: `src/app/actions/profile.ts:240-241,287`
- **問題**: アイコンIDの詳細やDBエラーメッセージが露出。
- **修正案**: 汎用メッセージに置換。

#### [LOW-4] テーブルスキーマがリポジトリに未管理

- **問題**: `video_analyses`/`match_analyses` テーブルのCREATE文とRLSポリシーがマイグレーションに含まれていない。
- **修正案**: 全テーブルのスキーマをマイグレーションファイルとしてバージョン管理。

#### [LOW-5] RSO ログインフローでのデッドコード

- **ファイル**: `src/app/api/auth/callback/riot/route.ts:121`
- **問題**: `adminClient.auth.admin.listUsers({ perPage: 1 })` が結果未使用のデッドコード。
- **修正案**: 削除。

### セキュリティ改善後の想定評価: 82/100点

---

## 2. マネタイゼーション審査結果

### 現在の評価: 38/100点

技術的な穴は塞がれつつあるが、**収益構造として致命的な設計欠陥**が複数残っている。

---

### 発見事項（インパクト順）

#### [CRITICAL-1] UIテキストと実際の制限値が乖離 — 「週3回」と表示しつつ実際は「週1回」

- **ファイル**:
  - `src/app/actions/constants.ts:5` — `FREE_WEEKLY_ANALYSIS_LIMIT = 1`
  - `src/locales/ja.json:1093` — `"weeklyAnalysis": "週3回"`
  - `src/locales/en.json:1093` — `"weeklyAnalysis": "3x/week"`
  - `src/locales/ko.json:1093` — `"weeklyAnalysis": "주 3회"`
  - `src/app/actions/guestAnalysis.ts:104,371,593` — ハードコードされた `"週3回まで分析できます！"`
  - `src/app/actions/coach.ts:221` — コメントに `"3 analyses per week"`
- **問題**: 前回の審査で週3→週1に変更したが、**UIテキストの更新が漏れている**。特定商取引法・景品表示法上の「優良誤認表示」に該当しうる。
- **ビジネスインパクト**: 法的リスク（景表法違反）、登録後のDay1チャーン激増。
- **改善案**: 即座に全ロケールファイルとハードコード文字列を実値に合わせて修正。

#### [CRITICAL-2] `invoice.payment_failed` をハンドリングしていない — 支払い失敗時もPremiumが維持される

- **ファイル**: `src/app/api/webhooks/stripe/route.ts:33-46`
- **問題**: `invoice.payment_failed` が未処理。カード期限切れユーザーが数日〜数週間、無課金でPremium機能を使い続ける。
- **ビジネスインパクト**: Involuntary churnの20-40%が未回収。年間MRR 100万円規模で年20-40万円の損失。
- **改善案**:
  1. `invoice.payment_failed` をハンドリングし、ユーザーに通知
  2. Stripeの Smart Retries を有効化
  3. `past_due` 状態で猶予期間付きの制限モードに切り替え

#### [CRITICAL-3] 無料トライアル（Free Trial）が存在しない — 最大の課金障壁

- **ファイル**: `src/app/api/checkout/route.ts` — `trial_period_days` 未設定
- **問題**: ユーザーはPremium機能を一度も体験せずに課金する必要がある。競合（Mobalytics, Blitz.gg, Porofessor）は全て無料で大半の機能を提供。
- **ビジネスインパクト**: Free→PremiumのCVRが業界標準を大幅に下回ると推定。
- **改善案**: 3日間のトライアル導入（カード登録必須）。

#### [HIGH-1] 解約理由収集ゼロ — チャーン分析不能

- **ファイル**: `src/app/components/subscription/PremiumPromoCard.tsx:71-78`
- **問題**: Stripeポータルに直接リダイレクト。解約理由アンケートもリテンションオファーもない。
- **改善案**: 解約前にアンケートモーダルを挟む。「高い」の場合は50%OFFクーポンを即提示。

#### [HIGH-2] メール通知の仕組みが完全に不在

- **問題**: ウェルカムメール、分析完了通知、週次サマリー、支払い失敗通知、ウィンバックメールが全て未実装。
- **改善案**: Resend（月100通無料）を導入。最低限: ウェルカム、支払い失敗通知、ウィンバックメール。

#### [HIGH-3] Free→Premiumの壁が「硬すぎる」— 週1回制限では価値実感が困難

- **問題**: 週1回のマクロ分析のみではAha Momentに到達する前にドロップアウト。LoLは週5-20試合プレイが一般的。
- **改善案**:
  1. 初回登録時に「ウェルカムボーナス」として3回分のクレジットを付与
  2. ミクロ分析を月1回だけ無料体験可能に

#### [HIGH-4] 年額プランが存在しない — LTV最大化の機会損失

- **問題**: 月額のみ。LoLは1シーズン約半年で、年額プラン需要がある。
- **改善案**: Premium 9,800円/年、Extra 29,800円/年を追加（2ヶ月分お得）。

#### [HIGH-5] ゲスト→会員登録のコンバージョン導線が弱い

- **問題**: ゲスト分析結果画面で「保存するにはログイン」のCTAが弱い。Premium限定のティーザー表示もない。
- **改善案**: 分析完了時に登録モーダル表示。Premium限定フィールドの「ロック状態」プレビュー追加。

#### [HIGH-6] Premium→Extraのアップセル導線が事実上ゼロ

- **問題**: Extraの存在を知れるのは料金ページのみ。コンテキスチュアルなアップセルがない。
- **改善案**: ダメージ計算画面やセグメント制限到達時にExtraのティーザーを表示。

#### [MEDIUM-1] レガシーコード残存 — `daily_analysis_count` と `weekly_analysis_count` の二重管理

- **ファイル**: `src/app/actions/analysis.ts:456-509`
- **問題**: `analyzeVideo` 内で旧 `daily_analysis_count` を使用。新しい weekly システムとの不整合。
- **改善案**: 全て `weekly_analysis_count` に統一。

#### [MEDIUM-2] 広告リワード機能が半実装

- **ファイル**: `src/app/actions/analysis.ts:884-924`, `src/app/components/ads/RewardedAdModal.tsx`
- **問題**: 広告SDKの統合なしにクレジット付与が可能。上限チェックもない。
- **改善案**: 正式統合するか機能を削除。リワード上限を1日1回・最大3クレジットに制限。

#### [MEDIUM-3] 価格設定が競合対比で不利

- **問題**: 競合は無料で大半の機能を提供。Extra 2,980円/月は高い。
- **改善案**: トライアル必須。初月50%OFF。学割（500円/月）の検討。

#### [MEDIUM-4] LPに社会的証明（Social Proof）がゼロ

- **問題**: ユーザー数、レビュー、ビフォーアフター、実績表示が一切ない。
- **改善案**: 「AI分析 X万件突破」「平均ランク1.5ティア向上」等のデータを表示。

#### [MEDIUM-5] 解約後のリテンション施策ゼロ

- **ファイル**: `src/app/api/webhooks/stripe/route.ts:166-182`
- **問題**: 解約後にメール通知もウィンバック施策もない。
- **改善案**: 解約14日後に50%OFFウィンバックメール送信。

#### [LOW-1] `downgradeToFree()` がStripeの解約をキャンセルしていない

- **ファイル**: `src/app/actions/analysis.ts:149-169`
- **問題**: DBのみ更新でStripeは請求を続ける可能性。チャージバックリスク。
- **改善案**: `stripe.subscriptions.update(subId, { cancel_at_period_end: true })` を呼ぶ。

#### [LOW-2] リファラル/紹介プログラムが不在

- **問題**: LoLはフレンドとプレイするソーシャルゲーム。紹介導線があればバイラルポテンシャルが高い。
- **改善案**: 「友達招待で1週間Premiumプレゼント」の軽量プログラムを検討。

### マネタイゼーション改善後の想定評価: 72/100点

---

## 3. 総合サマリー

| 分野 | 現在 | 改善後 | 最優先タスク |
|------|------|--------|-------------|
| セキュリティ | **62点** | **82点** | profiles RLS修正（CRITICAL-1,2） |
| マネタイゼーション | **38点** | **72点** | UIテキスト乖離修正（CRITICAL-1） |

### 即日対応すべき項目（Top 5）

1. **profiles SELECT RLS を自分のみに制限** — 全ユーザー情報漏洩
2. **profiles UPDATE RLS でセンシティブカラムを保護** — Premium無料取得
3. **UIテキスト「週3回」→「週1回」に修正** — 景表法リスク
4. **SECURITY DEFINER関数にauth.uid()チェック追加** — 他人のクレジット操作
5. **`analyzeTurningPoints` に認証チェック追加** — API無料消費

### 1週間以内に対応すべき項目

6. CSP / HSTS ヘッダー追加
7. `invoice.payment_failed` ハンドリング
8. API エラーメッセージの汎用化
9. `claimDailyReward` のアトミック化
10. 無料トライアル（3日間）の導入

---

*Generated: 2026-02-28 by Security Architect 田中 誠 & Head of Growth 山本 彩*
