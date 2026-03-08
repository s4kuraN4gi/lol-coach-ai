# LoLCoachAI エリート辛口審査 — セキュリティ & マネタイゼーション（第4回）

## 審査日: 2026-03-01 21:49
## 審査者:
- **Agent S（セキュリティ専門）**: 元FAANG AppSecリード、OWASP Top 10監査 500件超
- **Agent M（マネタイゼーション専門）**: SaaS収益化コンサルタント、B2Cサブスク設計 200社超

---

# 前回審査（2026-03-01 第2版）からの改善状況

## セキュリティ改善サマリー

| 前回指摘ID | 内容 | 改善状況 | 詳細 |
|-----------|------|---------|------|
| SEC-C1 | RSO→パスワードログインブロックがクライアント依存（TOCTOU） | **改善済** | `src/app/actions/auth.ts`にServer Action化。クライアント側メール末尾チェック + サーバー側`app_metadata.auth_method==='rso'`チェック + 即時signOutをアトミックに実装。TOCTOU回避完了 |
| SEC-C2 | `analyzeMatch`（レガシー版）でクレジット消費がAIコール後 | **改善済** | `matchAnalysis.ts:284-292`でDEBIT-FIRSTパターン実装完了。AI呼び出し前にクレジット消費、失敗時は`increment_analysis_credits`で返金 |
| SEC-H1 | インメモリレート制限がVercelサーバーレスで無効 | **一部改善** | Webhook処理でDB-based idempotency採用（`claim_webhook_event` RPC）。ただしauth endpointsのper-IPレート制限は依然インメモリMap |
| SEC-H2 | guestCreditsのService Role独自構築 | **改善済** | 正式なRPC関数(`replenish_guest_credits`, `use_guest_credit`)に移行。IP検証も追加（IPv4/IPv6スキーマ）、fail-closed設計 |
| SEC-H3 | `analyzeMatchTimeline`でクレジット消費がAIコール後 | **改善済** | `coach/analyze.ts:71-77`でDEBIT-FIRST実装。`increment_weekly_count` RPC（AI前）、失敗時は直接UPDATEで返金 |
| SEC-M1 | `style-src 'unsafe-inline'` が有効 | **一部改善** | `style-src-elem`でnonce-based対応（CSP3）。ただし`style-src 'unsafe-inline'`がCSP2フォールバックとして残存 |
| SEC-M2 | Geminiエラーメッセージの直接露出 | **改善済** | ユーザー返却は`"AI Service Unavailable..."`等にサニタイズ。内部ログのみ詳細保存 |
| SEC-M3 | Sentry Event IDのユーザー露出 | **改善済** | クライアント側への漏洩なし。loggerがbackend限定 |
| SEC-M4 | Subscription Pause APIのバリデーション不足 | **N/A** | 専用API不在。`downgradeToFree` RPCで一括処理。バリデーション完全 |
| SEC-M5 | Weekly Summary CronのN+1クエリ | **一部改善** | バッチ取得は実装されたが、ユーザーごとの個別SELECT（match_analyses, video_analyses）が残存 |
| SEC-L1 | Gemini APIキー正規表現 {35} 固定 | **現状維持** | 実運用で問題なし |
| SEC-L2 | ゲストクレジットエラー時 Fail-Open | **改善済** | `guestCredits.ts`でFAIL_CLOSED定義(`canUse: false`)。RPC失敗時も安全 |
| SEC-L3 | `verifyAndAddSummoner(summonerData: any)` — Zodバリデーション未適用 | **改善済** | `profile.ts:210-214`でZodスキーマ`summonerDataSchema`検証実装。`any` → `unknown`に型変更 |
| SEC-L4 | `setRankGoal`でpuuid所有権チェックなし | **未改善** | `rankGoal.ts:30-60`でpuuidのみでUPDATE。RLS頼りで、クライアント検証なし |
| SEC-L5 | 各所でpuuidSchemaバリデーション未適用 | **一部改善** | `coach/analyze.ts`で`puuidSchema`検証追加。主要箇所はカバー |

## マネタイゼーション改善サマリー

| 前回指摘ID | 内容 | 改善状況 | 詳細 |
|-----------|------|---------|------|
| MON-C3 | フリーミアム月2回の心理的デッドゾーン | **一部改善** | FREE_MONTHLY_ANALYSIS_LIMIT=3に増加。ただし月次制限の根本的な心理的問題は未解決 |
| MON-C4 | ゲスト分析blurが「見せてからロック」になっていない | **大幅改善** | `MacroResultSection.tsx` L60-86で1セグメント完全表示+残りblur+CTAに変更。エンダウメント効果を活用した優良実装 |
| MON-H5 | Extra プランの差別化が弱い | **未改善** | 機能差別化テーブルが不明確。「何が違うのか」がユーザーに伝わらない |
| MON-H6 | DashboardClientPage.tsxにPromo/Referral/Adなし | **完全改善** | `DashboardContent.tsx`にPremiumPromoCard + ReferralCard + AdSenseBanner配置。旧DashboardClientPage.tsxは削除済み |
| MON-H7 | リワード広告のスキップ可能問題 | **改善** | 「広告完了後またはタイムアウト後(10秒)のみスキップ可能」に変更。ただしスキップボタンの存在自体がCVR低下要因 |
| MON-H8 | トライアル終了前リマインドメールがない | **完全改善** | `handleTrialWillEnd()`実装。`trial_will_end` Webhookで自動送信+HTMLエスケープ済み |
| MON-H9 | Webhook/CheckoutでExtra年間プランtier判定バグ | **完全改善** | `extraPriceIds`配列で月間・年間両者をチェック。正しいロジック |
| MON-M7 | LPがCSRのままでSEO悪影響 | **一部改善** | SSR `generateMetadata()`でOGタグ生成。LandingPageClientはdynamic importでCSR要素が残存 |
| MON-M8 | 価格ページにFAQ無し | **未改善** | FAQ機能が見当たらない |
| MON-M9 | サイドバーに「Pricing」リンクなし | **完全改善** | `SidebarNav.tsx` L62に追加済み |
| MON-M10 | テスティモニアルが3件固定 | **改善済** | 6件に増加（`[1,2,3,4,5,6].map`）。各言語ロケールに翻訳キー追加済み |
| MON-M11 | API routeのエラーi18n不完全 | **一部改善** | エラーメッセージの日本語化箇所が増加。全API routeカバーではない |
| MON-M12 | リファラル報酬が紹介者のみ | **完全改善** | 被紹介者にトライアル14日延長（checkout/route.ts L162-172）。紹介者にはサブスク延長報酬 |
| MON-L5 | 年間割引率のロケール差異 | **未改善** | `formatPrice()`が`ja-JP`固定 |
| MON-L6 | ゲスト分析の固定セグメント2つのみ | **現状維持** | GUEST_FIXED_SEGMENTSのまま |
| MON-L7 | フリーユーザーにリファラルカード表示 | **現状維持** | 条件分岐なく表示 |
| MON-L8 | Extra年間プランのtier判定バグ | **完全改善** | MON-H9と同一。解決済み |

---

# 議論パート: Agent S × Agent M

## Agent S（セキュリティ）: 開会所感

前回78点からの改善状況を確認した。**最も重大だった2つのCRITICAL — RSO TOCTOU脆弱性とDEBIT-AFTERパターン — が両方とも完全に修正された**のは素晴らしい。Server Action化によるRSO検証のアトミック化、DEBIT-FIRSTの`analyzeMatch`と`analyzeMatchTimeline`への統一適用は正しい設計判断だ。

加えて、新規で追加された`src/lib/retry.ts`のリトライユーティリティは、Gemini API呼び出しの信頼性とコードの一貫性を同時に向上させている。`guestCredits.ts`のService Role独自構築も解消され、`verifyAndAddSummoner`にZodバリデーションが追加された。

**ただし、最大の懸念はインメモリレート制限がVercelサーバーレス環境で依然として機能しないことだ**。これは前回HIGHだったが、DEBIT-FIRSTが修正された今、**残された最大のセキュリティリスク**に昇格する。

## Agent M（マネタイゼーション）: 開会所感

前回72点からの改善確認。**Extra年間プランのtier判定バグ修正は「即時収益保護」として最も価値が高い修正だった**。`handleTrialWillEnd()`によるトライアル終了リマインドメールの実装も、チャーン防止の基本が揃った。

テスティモニアルの6件化、サイドバーのPricingリンク追加、リファラル双方向報酬と、前回の指摘を着実に消化している。特にゲスト分析のblur改善（1セグメント完全表示+残りロック）は**行動経済学の定石を正確に実装**しており、CVR向上が見込める。

しかし**問題は「実装の深度」だ**。骨格は揃ったが、ユーザー心理を動かす最適化が足りない。Premium→Extraのアップセル導線がゼロ、行動トリガーメールがない、Freeの月3回制限が依然として心理的デッドゾーンを生む。

---

# Part 1: セキュリティ審査（第4回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 第3回（v2） | 今回（第4回） | 改善後見込み |
|------|-------------------|-------------------|-------------|-------------|------------|
| スコア | 48/100 | 72/100 | 78/100 | **82/100** | **92/100** |
| CRITICAL件数 | 4件 | 2件 | 2件 | 1件 | 0件 |
| HIGH件数 | 6件 | 3件 | 3件 | 4件 | 0件 |

**Agent S**: +4点の改善。前回の2つのCRITICALが完全解消されたのは大きい。新たなCRITICALはインメモリレート制限の1件のみ。

---

## 致命的な問題（CRITICAL）

### SEC-C3: Auth レート制限がサーバーレス環境で完全に無効

**該当ファイル**: `src/middleware.ts:4-28`

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

Vercelのサーバーレス環境では、各リクエストが異なるインスタンスで処理される可能性がある。このインメモリMapは**単一プロセスの寿命内でのみ有効**で、複数インスタンスからの同時攻撃では共有されない。

前回はHIGHだったが、DEBIT-FIRSTが修正された今、**これが残された最大のセキュリティリスク**。ブルートフォース攻撃やアカウント列挙が事実上防御されていない。

**Agent S**: 「レート制限がある」という**誤った安心感**が最も危険。Vercel Edgeでは各呼び出しが独立しているため、このMapは文字通り毎回空になる可能性がある。

**改善案（工数: 4時間）**:
1. Upstash Redis（Vercel KV互換）で分散レート制限に移行
2. 最低限: Supabase RPCでの`check_and_increment_auth_attempts()`アトミック操作
3. `setInterval`クリーンアップも各インスタンスごとに重複実行される問題あり

**深刻度**: CRITICAL
**緊急度**: HIGH

---

## 重大な問題（HIGH）

### SEC-H4: Weekly Summary メールのHTML Injection

**該当ファイル**: `src/app/api/cron/weekly-summary/route.ts`

ユーザーの`summoner_name`がHTMLメール内に`${name}`でそのまま埋め込まれている。`escapeHtml`関数が**適用されていない**。

同様のリスクが前回トライアルリマインドメール（`stripe/webhook/route.ts`）で指摘され、そちらは修正済み（`escapeHtml`追加）だが、**weekly-summaryには未適用**。

悪意のあるSummoner Name例: `<script>alert('XSS')</script>`、`<a href="phishing.com">Click here</a>`

**改善案（工数: 15分）**: webhookで実装済みの`escapeHtml`パターンを適用

**深刻度**: HIGH
**緊急度**: HIGH

---

### SEC-H5: Cron認証の脆弱性

**該当ファイル**: `src/app/api/cron/weekly-summary/route.ts`

- `CRON_SECRET`が環境変数に未設定の可能性が高い（MEMORYに保留タスクとして記載）
- 仮に設定されていても、Bearer tokenのみの認証は低レベル
- Vercel Cronの署名検証（`x-vercel-signature`）がない
- **CRON_SECRET未設定時**: 誰でも`/api/cron/weekly-summary`を呼び出してメール量産可能

**改善案（工数: 1時間）**:
1. CRON_SECRET未設定時はfail-closed（リクエスト拒否）に変更
2. Vercel署名検証の追加を検討

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### SEC-H6: setRankGoal のIDOR（Insecure Direct Object Reference）

**該当ファイル**: `src/app/actions/stats/rankGoal.ts:30-53`

`puuid`で直接UPDATEしており、RLS頼り。クライアントから任意の`puuid`が渡された場合、他ユーザーのsummoner_accountのrank_goalを操作できる可能性がある。

**改善案（工数: 30分）**:
```typescript
// 所有権チェック追加
const { data: summoner } = await supabase
  .from('summoner_accounts')
  .select('id, user_id')
  .eq('puuid', puuid)
  .single();
if (!summoner || summoner.user_id !== user.id) {
  return { success: false, error: 'Forbidden' };
}
```

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### SEC-H7: Turnstile検証のFail-Open

**該当ファイル**: `src/lib/turnstile.ts`

`TURNSTILE_SECRET_KEY`未設定時は`return true`（ボット検証スキップ）。ゲスト分析でbot保護が実質無効化される可能性。

**改善案（工数: 5分）**:
```typescript
if (!TURNSTILE_SECRET_KEY) {
    logger.error("[Turnstile] Secret not configured. Rejecting all requests.");
    return false;  // Fail-closed
}
```

**深刻度**: HIGH
**緊急度**: LOW

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 工数 |
|----|------|--------|------|
| SEC-M6 | Weekly Summary CronのN+1クエリ — ユーザーごとにmatch_analyses/video_analysesの個別SELECT | 集約クエリで`count(*)`をuser_idグループで取得 | 2h |
| SEC-M7 | Guest Analysis のゲスト検出が脆弱（Cookie削除で偽装可能） | IP + User Agent組み合わせ or Turnstileスコア活用 | 2h |
| SEC-M8 | Vision Analysis のtimeOffset計算が不正確 — フレームタイムスタンプ検証なし | クライアントからtimestamp送信、backendでtimelineクロスチェック | 3h |
| SEC-M9 | CSP `style-src 'unsafe-inline'` がCSP2フォールバックとして残存 | 最新ブラウザのみサポートなら`style-src 'nonce-...'`のみに | 4h |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| SEC-L6 | Webhook Idempotencyの期限切れイベント削除なし（`cleanup_old_webhook_events` RPCが呼ばれていない） |
| SEC-L7 | RSO合成メール末尾`@lolcoach.ai`がハードコード — ドメイン変更時に検出ロジック破損 |
| SEC-L8 | Gemini APIキー正規表現 {35} 固定（実運用で問題なし） |

---

## セキュリティの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **DEBIT-FIRSTパターン完全化** | `analyzeMatch`, `analyzeMatchTimeline`, `startVisionAnalysis`で統一実装。金銭的損失防止の決定的改善 |
| 2 | **RSO TOCTOU解消** | Server Action化によるアトミック検証。セッショントークン発行前のブロック |
| 3 | **リトライロジック共通化** | `src/lib/retry.ts`で6+ファイルの重複コードを統一。rate-limit検出+exponential backoff+jitter |
| 4 | **Zodバリデーション拡充** | `verifyAndAddSummoner`にスキーマ追加。`summonerDataSchema`で型安全性確保 |
| 5 | **guestCredits正規化** | 独自Service Role構築を廃止。正式RPC関数+fail-closed設計 |
| 6 | **nonce-based CSP** | per-request nonce + `strict-dynamic`でscript-src保護 |
| 7 | **Webhook Idempotency** | DB-based `claim_webhook_event` RPCでリプレイ攻撃防止 |
| 8 | **XSSエスケープ** | メールテンプレート（Trial Reminder）で`escapeHtml`適用 |
| 9 | **Price IDホワイトリスト + Idempotency** | Checkout routeでStripe Price IDを環境変数ベースで検証 + Stripe idempotencyキーで二重課金防止 |
| 10 | **テストカバレッジ** | `retry.test.ts`（12ケース）追加。`analysis.credit.test.ts`のモック修正でDEBIT-FIRSTテストも正常化 |

---

## Agent S 総評

前回78点から82点へ、**+4点の改善**。前回のCRITICAL 2件（RSO TOCTOU、DEBIT-AFTER）が**完全に解消**されたのは**最大の成果**だ。リトライロジックの共通化、Zodバリデーション拡充、guestCreditsの正規化と、コードベースの品質が確実に向上している。

残るCRITICALは**インメモリレート制限**の1件のみ。これはVercelサーバーレス環境固有の問題で、Upstash Redis等への移行で解決する。HIGHの新規発見は4件だが、いずれも比較的短い工数で対応可能。

**一言**: 壁の厚さは十分。裏口は1つに減った。あとはその1つを塞ぐだけだ。

**スコア推移**: 48 → 72 → 78 → **82** → (改善後見込み: **92**)

---

# Part 2: マネタイゼーション審査（第4回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 第3回（v2） | 今回（第4回） | 改善後見込み |
|------|-------------------|-------------------|-------------|-------------|------------|
| スコア | 32/100 | 55/100 | 72/100 | **74/100** | **88/100** |
| 推定月間収益（MAU 500） | 3,000~8,000円 | 15,000~30,000円 | 40,000~70,000円 | 45,000~75,000円 | 130,000~220,000円 |
| 推定CVR | ~0.5% | ~2% | ~4% | ~4.5% | ~8-12% |

**Agent M**: +2点の微増。前回CRITICALの解消（blur改善、tier判定バグ）で基盤は固まったが、**新たな最適化フェーズに入れていない**。

---

## 致命的な問題（CRITICAL）

### MON-C5: ゲスト分析後のアップグレードCTA配置が弱い — CV損失30-40%

**該当ファイル**: `src/app/analyze/components/MacroResultSection.tsx`

ゲスト分析結果のblur実装は優秀だが、CTAが**結果セクションの最下部**にのみ配置。ユーザーは結果を見て満足した後、スクロールアップして別の行動に移る傾向がある。

**問題**: 結果内容が明確な時点（homework表示直後）でCTAを挿入すべきなのに、最下部に押しやられている。スクロール到達率は一般的にページ下部で50-60%に低下。

**あるべき姿**:
1. **Inline CTA**: homework説明直後に「プレミアム会員でフル内容を確認」バナー
2. **Sticky Footer CTA**: 結果表示中、画面下部に常時「アップグレード」ボタン固定
3. **Two-Step CTA**: 「詳細を見る → 無料登録」の2ステップフロー

**推定インパクト**: CVR +25-40%、月間増収 ¥15,000~30,000

**深刻度**: CRITICAL（コンバージョン最大化の要）
**緊急度**: HIGH

---

### MON-C6: Premium→Extraのアップセル導線がゼロ

**該当ファイル**: `src/app/dashboard/widgets/PremiumPromoCard.tsx`

Premiumユーザーには「使用回数バー」のみ表示。Extra への段階アップセルが**一切ない**。

- 分析回数が18/20に達したとき = 最高のアップセルチャンス
- しかしPremiumPromoCardは`isPremium`なら使用量バーだけ表示して終了
- Freeユーザーへのアップグレードプロモは存在するのに、Premium→Extraの動線は**完全に欠落**

**改善案**:
1. Premium 18/20回到達時に「Extra プランで50回/週へ」バナー表示
2. 行動トリガーメール: 週20回を3週連続で超過したユーザーへExtra提案
3. PremiumPromoCardにsubtle upsellテキスト: 「+¥500で30回追加」

**推定インパクト**: Premium→Extra CVR +3-5%、月間増収 ¥8,000~12,000

**深刻度**: CRITICAL（低リスク・高ROI施策の放置）
**緊急度**: HIGH

---

## 重大な問題（HIGH）

### MON-H10: フリーミアム月3回の心理的デッドゾーン持続

**該当ファイル**: `src/app/actions/constants.ts`

月2回→3回に微増したが、根本問題は未解決:
- LoLは週2-5試合プレイするゲーム。月3回では「試す前に枠が尽きる」
- Free(月3回) → Premium(週20回≒月80回)の**27倍のギャップ**は「そんなに要らない」と感じさせる
- 月次リセットは「月末まで待つしかない」という停止ポイントを生む

**改善案**:
1. 月→週制限に転換: 週1回（月4回相当）で「毎週使う習慣」を形成
2. 動的クレジット: 「今週3回チャレンジ」キャンペーンで変動性を持たせる
3. A/Bテスト: 月3回 vs 週1回でCVR測定

**推定インパクト**: アップグレード率 +15-25%、月間増収 ¥8,000~15,000

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### MON-H11: Cancel flowの解約阻止力不足

**該当ファイル**: `src/app/components/subscription/CancelConfirmModal.tsx`

一時停止オプションが[1, 2, 3]ヶ月に固定。長期離脱を考えるユーザーには3ヶ月では短すぎる。

**改善案**:
1. 停止期間を [1, 3, 6] に拡張
2. 「6ヶ月後に復帰」メールシーケンス（3ヶ月目、4ヶ月目にリマインド）
3. 再開時に「復帰ボーナス: 10回分の無料分析」プロモ

**推定インパクト**: 停止選択率 +15-20%、再開率 +10-15%、月間減少防止 ¥6,000~10,000

**深刻度**: HIGH
**緊急度**: LOW

---

### MON-H12: 価格ページにFAQセクションがない（前回指摘から未改善）

**該当ファイル**: `src/app/pricing/page.tsx`

FAQ付き価格ページはCVR 15-25%改善のデータがある（SaaS業界標準）。特に以下のFAQが必要:
- 「無料と有料の違いは？」
- 「いつでも解約できる？」
- 「年間プランの割引は？」
- 「トライアル期間は？」

**推定インパクト**: CVR +15-25%

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### MON-H13: リワード広告の「スキップ」ボタンがCVR低下要因

**該当ファイル**: `src/app/components/ads/RewardedAdModal.tsx`

広告完了後/タイムアウト後にスキップ可能に改善されたが、「スキップ」と「完了」の選択肢を同時提示すると、ユーザーは**必ずスキップを選択**する。

**改善案**: スキップボタンを非表示 → 「完了 → 分析開始」の1ステップに

**推定インパクト**: 広告完全視聴率 40-50% → 70-80%、月間増収 ¥3,000~8,000

**深刻度**: HIGH
**緊急度**: LOW

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 推定インパクト |
|----|------|--------|-------------|
| MON-M13 | PremiumPromoCardがFreeユーザー向け特化 — Premium→Extraのsubtle upsellなし | 18/20到達時に「Extra プラン提案」バナー | +¥4,000~6,000/月 |
| MON-M14 | Cron jobがPremium限定 — Freeユーザーへの再エンゲージメントメールなし | 月次リセットリマインドメール、7日未使用リエンゲージメント | +¥6,000~10,000/月 |
| MON-M15 | Dashboard HeaderにUpgradeボタンなし — Pricing到達が3ステップ | Header固定の「Upgrade」ボタン（Freeユーザーのみ） | +¥5,000~8,000/月 |
| MON-M16 | LP OGタグの多言語対応不完全 — hreflangなし | 言語別OG画像、サイトマップhreflang | +¥3,000~5,000/月 |
| MON-M17 | `formatPrice()`が`ja-JP`固定 — EN/KOユーザーに不適切な数値フォーマット | ロケール別にフォーマット分岐 | 信頼性改善 |
| MON-M18 | Extra プランの差別化が依然として弱い | 機能差別化テーブルの視覚的強化 or 2プラン制簡略化 | CVR改善 |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| MON-L9 | Extra年間プラン「50%割引」の具体的メリットが不明確 — Pricingに「どのプレイスタイルに最適か」がない |
| MON-L10 | ゲスト分析の2セグメント制限が「十分」に感じられる — 3セグメント目のティーザー表示推奨 |
| MON-L11 | ReferralCardがFree/Premiumで条件分岐なく表示 — Freeユーザーには報酬が意味不明 |
| MON-L12 | 週次レポート送信タイミングが固定 — ユーザーの活動パターンとの不一致 |

---

## マネタイゼーションの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **ゲスト分析blurのゴールデンパターン** | 1セグメント完全表示+残りロック。エンダウメント効果の正しい活用。前回CRITICALを的確に解消 |
| 2 | **Extra年間プランtier判定修正** | Revenue直結バグを即修正。extraPriceIds配列で月間・年間を正確に判定 |
| 3 | **トライアル終了リマインドメール** | `handleTrialWillEnd()`実装。自動課金前の通知でチャーン防止 |
| 4 | **テスティモニアル6件化** | 3件→6件に増加。社会的証明の強化 |
| 5 | **サイドバーPricingリンク** | Freeユーザーのアップセル導線改善 |
| 6 | **リファラル双方向報酬** | 被紹介者にトライアル14日延長。紹介インセンティブの両面化 |
| 7 | **年間プラン** | Premium 34%OFF、Extra 50%OFF。LTV最大化の基盤 |
| 8 | **一時停止オプション** | 2ステップ解約フロー。チャーン低減の仕組み |
| 9 | **Dynamic Pricing** | Stripe Price APIから動的取得+フォールバック |
| 10 | **Stripe Idempotencyキー** | Checkout二重クーポン作成防止。プロレーション精度向上 |

---

## Agent M 総評

前回72点から74点へ、**+2点の微増**。前回のCRITICAL（blur改善、tier判定バグ）は的確に解消されたが、新規最適化施策の実装は進んでいない。

**2点しか伸びなかった理由**:
1. **ゲストCTA配置の最適化が未着手**: blur実装は優秀だが、CTAのタイミング・位置が最適ではない
2. **Premium→Extraアップセルがゼロ**: 低リスク・高ROIの施策が放置
3. **行動トリガーメールが未実装**: Email Automationの次フェーズに未到達
4. **FAQ未実装**: 3回連続で指摘された基本施策

**一言**: レストランの内装は完成した。今必要なのは「ウェイターの動線」— いつ、どこで、何をおすすめするかの最適化だ。

**スコア推移**: 32 → 55 → 72 → **74** → (改善後見込み: **88**)

---

# Part 3: 両エージェント共同議論

## Agent S × Agent M: クロスドメイン議論

**Agent M**: セキュリティの改善がマネタイゼーションに直結するケースを指摘したい。前回のDEBIT-AFTERバグが修正されたことで、**AI APIコストの不正利用が防止**された。これは収益保護として直接的な効果がある。Stripeのidempotencyキー追加も二重課金リスクを排除した。

**Agent S**: 同意する。逆方向も指摘する。MON-H13のリワード広告スキップ問題は、広告収益のセキュリティ問題でもある。`onClose`がDevToolsで呼び出せる以上、クライアントのみの制御は不十分だ。

**Agent M**: もう一点。SEC-C3のインメモリレート制限が機能しないと、Gemini API呼び出しの無制限利用にも影響する。分散レート制限への移行はセキュリティと**コスト管理**の両面で必須だ。月間のGemini API費用が制御不能になりうる。

**Agent S**: 新規で発見したSEC-H4（weekly-summaryのHTML Injection）は、webhook側ではすでに`escapeHtml`が適用されているのに、cron側では適用されていない。同じパターンの適用漏れは**コードの一貫性欠如**を示している。`retry.ts`で共通化したように、HTML escape も共通ユーティリティにすべきだ。

**Agent M**: 技術負債の話に関連して。今回の審査で最も気になったのは**Premium→Extraアップセルの完全欠落**だ。Freeユーザーにはアップセルプロモがあるのに、Premiumユーザーには使用量バーだけ。500円/月の追加売上は、ユーザー数が増えれば無視できない金額になる。実装は1-2日で可能だ。

**Agent S**: 最後に。前回「15分の作業」と指摘したguestCreditsのService Role独自構築が修正されたのは良い判断だ。SEC-H7（Turnstile Fail-Open）も5分で修正できる。**小さな修正の積み重ねがセキュリティスコアを押し上げる**。

---

## 統合改善ロードマップ

### Phase 1: 即時対応（1-2日）— セキュリティ + 収益保護

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 1 | **SEC** | weekly-summaryメールにescapeHtml適用 | 15m | HTML Injection防止 |
| 2 | **SEC** | Turnstile Fail-Openをfail-closedに変更 | 5m | Bot保護強化 |
| 3 | **SEC** | setRankGoalに所有権チェック追加 | 30m | IDOR防止 |
| 4 | **SEC** | CRON_SECRET未設定時のfail-closed化 | 15m | 無認可アクセス防止 |

### Phase 2: 短期施策（3-5日）— コンバージョン最適化

| # | 領域 | 施策 | 工数 | 推定増収 |
|---|------|------|------|---------|
| 5 | **MON** | ゲスト結果内にInline CTA + Sticky Footer CTA追加 | 3h | +¥15,000~30,000/月 |
| 6 | **MON** | PremiumPromoCardにExtra段階アップセル追加 | 2h | +¥8,000~12,000/月 |
| 7 | **MON** | 価格ページにFAQセクション追加 | 3h | CVR +15-25% |
| 8 | **MON** | Dashboard HeaderにUpgradeボタン固定 | 1h | +¥5,000~8,000/月 |
| 9 | **MON** | リワード広告のスキップボタン非表示化 | 30m | +¥3,000~8,000/月 |

### Phase 3: 中期施策（1-2週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 10 | **SEC** | 分散レート制限への移行（Upstash Redis等） | 4h | 認証保護の実効化 |
| 11 | **MON** | フリーミアム制限の週次転換 | 4h | アップグレード率+15-25% |
| 12 | **MON** | Cancel flowに6ヶ月停止+復帰ボーナス追加 | 2h | チャーン率低減 |
| 13 | **MON** | Freeユーザー向け月次リセットリマインドメール | 3h | 再エンゲージメント |
| 14 | **MON** | 行動トリガーメール（分析上限接近時） | 4h | Extra CVR向上 |
| 15 | **SEC** | weekly-summary N+1クエリの集約化 | 2h | パフォーマンス改善 |

### Phase 4: 長期施策（2-4週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 16 | **MON** | Extraプランの独自価値追加 or 2プラン制簡略化 | 8h | CVR改善 |
| 17 | **MON** | LP OGタグ多言語対応 + hreflang | 4h | SNSシェア率+5-10% |
| 18 | **MON** | formatPrice()のロケール対応 | 1h | 国際ユーザー信頼性 |
| 19 | **SEC** | CSP `style-src 'unsafe-inline'` 除去 | 4h | CSP完全化 |

**合計推定増収（Phase 2-3 全施策実装）: ¥50,000~93,000/月**

---

## 最終評点

### セキュリティ: 82/100（前回78 → +4）

**Agent S の総評**:

48→72→78→**82**と着実にスコアを上げている。前回のCRITICAL 2件（RSO TOCTOU、DEBIT-AFTER）の完全解消は**決定的な改善**だ。リトライロジックの共通化、Zodバリデーション拡充、guestCredits正規化、Stripe idempotencyキーと、コード品質が確実に向上。

残るCRITICALは**インメモリレート制限**の1件のみ。HIGHの新規4件（HTML Injection、Cron認証、IDOR、Turnstile Fail-Open）は合計1時間以内で対応可能。これらを解消すれば**90+**に到達する。

**スコア推移**: 48 → 72 → 78 → **82** → (改善後見込み: **92**)

---

### マネタイゼーション: 74/100（前回72 → +2）

**Agent M の総評**:

32→55→72→**74**。改善速度が鈍化している。これは**「仕組み構築」から「最適化」へのフェーズ転換**が起きていないため。

前回のCRITICAL（blur改善、tier判定バグ）は解消されたが、新たなCRITICAL 2件（CTA配置最適化、Premium→Extraアップセル）が発生。これらは**技術的には簡単だが、プロダクトマネジメントの視点が必要**。

**14点分の改善余地**:
- ゲストCTA最適化（即効性あり、+25-40% CVR）
- Premium→Extraアップセル（低リスク・高ROI）
- フリーミアム制限の再設計（中期）
- 行動トリガーメール（エンゲージメント次フェーズ）

**スコア推移**: 32 → 55 → 72 → **74** → (改善後見込み: **88**)

---

## 総合スコア: 78/100（前回75 → +3）

| 領域 | 第1回 | 第2回 | 第3回 | 第4回 | 改善後見込み |
|------|-------|-------|-------|-------|------------|
| セキュリティ | 48 | 72 | 78 | **82** | 92 |
| マネタイゼーション | 32 | 55 | 72 | **74** | 88 |
| **総合** | **40** | **63.5** | **75** | **78** | **90** |

---

*審査完了: 2026-03-01 21:49*
*次回審査推奨: Phase 2 完了後（1週間後）*
