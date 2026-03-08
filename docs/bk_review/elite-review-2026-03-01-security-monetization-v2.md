# LoLCoachAI エリート辛口審査 -- セキュリティ & マネタイゼーション（第3回）

## 審査日: 2026-03-01（第2版）
## 審査者:
- **Agent S（セキュリティ専門）**: 元FAANG AppSecリード、OWASP Top 10監査 500件超
- **Agent M（マネタイゼーション専門）**: SaaS収益化コンサルタント、B2Cサブスク設計 200社超

---

# 前回審査（2026-03-01 第1版）からの改善状況

## セキュリティ改善サマリー

| 前回指摘ID | 内容 | 改善状況 | 詳細 |
|-----------|------|---------|------|
| SEC-C1 | RSO認証ユーザーへのパスワードログイン拒否が未実装 | **改善済** | `login/page.tsx` L62で `@lolcoach.ai` ドメインをクライアント側でブロック。L92で `app_metadata.auth_method === 'rso'` チェック+即時signOut。ただしクライアント依存の後追い型防御で構造的弱点あり（後述） |
| SEC-C2 | CSP `script-src 'unsafe-inline'` が本番環境で有効 | **改善済** | nonce-based CSPに完全移行。`middleware.ts` L42で `'nonce-${nonce}' 'strict-dynamic'` を使用。CSP2+ブラウザでは `'unsafe-inline'` がnonceにより無視される |
| SEC-H1 | ゲストクレジットのIP偽装防御がCloudflareのみに依存 | **一部改善** | Turnstile CAPTCHA追加（`guestAnalysis.ts` L367）。IPフォールバックチェーンも維持。ただしCloudflare非経由アクセス時のリスクは残存 |
| SEC-H2 | フレームアップロードのサイズ制限とbodySizeLimitの不整合 | **改善済** | `validation.ts` でフレーム配列を `max(10)` に制限。各フレーム2MB上限。`bodySizeLimit: 5MB` と整合 |
| SEC-H3 | ログインページにレート制限なし | **改善済** | `middleware.ts` L4-28でIPベースのインメモリレート制限（10回/60秒）。`login/page.tsx` L54-59でクライアント側ロックアウト（5回失敗で60秒）も追加 |
| SEC-M1 | style-src 'unsafe-inline' が本番で有効 | **未改善** | `middleware.ts` L43: `"style-src 'self' 'unsafe-inline'"` が依然として存在 |
| SEC-M2 | connect-src に広範なドメインリスト | **改善済** | Supabase, Stripe, Sentryのみに絞り込み |
| SEC-M3 | Service Roleクライアントの使用箇所がまだ残存 | **現状維持** | 4箇所で使用（全て正当な用途）。ただし `guestCredits.ts` のみ独自構築でセキュリティ設定が共有されていない |
| SEC-M4 | RSO認証のCSRF state Cookie TTL未設定 | **改善済** | `maxAge: 600`（10分）、`httpOnly: true`、`secure: production`、`sameSite: "lax"` で適切に設定 |
| SEC-M5 | SameSite=Lax — GET経由の攻撃は防がない | **現状維持** | OAuth redirect flowとの互換性のためLax維持は合理的 |
| SEC-L1 | Gemini APIキー正規表現が{35}固定 | **未改善** | `^AIza[A-Za-z0-9_-]{35}$` のまま |
| SEC-L2 | エラーバウンダリのSentry eventID表示 | **未改善** | Sentry event IDがユーザーに表示される |
| SEC-L3 | Permissions-Policy camera/mic制限 | **改善済** | `camera=(), microphone=(), geolocation=()` で適切に制限 |
| SEC-L4 | Supabaseメールレート制限が2回/時 | **現状維持** | ローカル開発向け設定。本番はSupabase Dashboard側で管理 |

## マネタイゼーション改善サマリー

| 前回指摘ID | 内容 | 改善状況 | 詳細 |
|-----------|------|---------|------|
| MON-C1 | フリーユーザーの週1回分析が「ちょうど十分」な罠 | **改善済** | `FREE_MONTHLY_ANALYSIS_LIMIT = 2`（月2回）に変更。週次→月次リセットへ移行し制限強化 |
| MON-C2 | ゲスト分析成功後のコンバージョンCTAが弱すぎる | **改善済** | `MacroResultSection.tsx`と`MicroResultSection.tsx`でblur+ロック表示+会員登録CTA。`upgradeModal`（クレジット切れ時の全画面モーダル）も追加 |
| MON-H1 | Extra ¥2,980の価値提案が弱い | **一部改善** | 1,480円/月に引き下げ。ただし差別化要素の追加は不十分 |
| MON-H2 | 分析回数使い切り時のUXが薄い | **改善済** | 専用アップグレードモーダル（FaCrown+CTA+セッション内1回表示） |
| MON-H3 | 年間プランが存在しない | **改善済** | Premium年額7,800円(34%OFF)、Extra年額8,800円(50%OFF)。月額/年額切替UI実装済 |
| MON-H4 | 広告収益の配置最適化が不十分 | **改善済** | 分析ページに上部・左右サイドバー・モバイル用・下部の計5箇所。Premiumユーザーには非表示 |
| MON-M1 | 価格がStripe Price APIから動的取得されていない | **改善済** | `pricing.ts`で`getStripePrices()`実装。4つのPrice IDから動的取得+フォールバック |
| MON-M2 | LPの一部がCSRのまま | **現状維持** | `page.tsx`は依然として`"use client"`。`LandingPageJsonLd`のみ追加 |
| MON-M3 | テスティモニアルが3件のみで「作り物感」 | **未改善** | `[1, 2, 3].map`で3件固定のまま |
| MON-M4 | チャーン防止フローに「一時停止」オプションがない | **改善済** | 2ステップフロー: 解約理由選択→1/2/3ヶ月一時停止。Stripeの`pause_collection`使用 |
| MON-M5 | メール通知が一切ない | **改善済** | 週次サマリーメール（Resend API）。Premium/Extra会員に分析回数・試合分析数を通知 |
| MON-M6 | リファラルプログラムが存在しない | **改善済** | コード生成・共有・報酬付与の一連フロー実装済 |
| MON-L1 | checkout.tsのエラーメッセージが英語混在 | **一部改善** | `t?.()`によるi18n対応導入。ただしフォールバック値とAPI routeは依然英語 |
| MON-L2 | 通貨が円固定 | **現状維持** | 当面のターゲットが日本市場中心なので許容範囲 |
| MON-L3 | Stripe Customer Portalのブランディング未カスタマイズ | **確認不可** | Stripe Dashboard側の設定 |
| MON-L4 | 「お試し分析」ボタンのLP配置が1箇所のみ | **改善済** | Hero+Badge+CTAセクションの計3箇所からAnalyzeへの動線 |

---

# 議論パート: Agent S × Agent M

## Agent S（セキュリティ）: 開会所感

前回72点からの改善状況を確認した。最大のCRITICALだった **CSP `unsafe-inline`** がnonce-basedに移行完了し、Turnstile CAPTCHAの導入、レート制限の追加と、方向性は正しい。

ただし、改善の裏で **新たな攻撃面が拡大** している。referral、cron、subscription pause等の新機能が追加され、各APIルートのバリデーション、認証、入力サニタイズの一貫性が問われる。特にDEBIT-FIRSTパターンの不完全な適用は、直接的な金銭損失に繋がるCRITICALだ。

## Agent M（マネタイゼーション）: 開会所感

前回55点からの改善は **圧巻** だ。年間プラン、一時停止、リファラル、メール通知、広告最適化、ゲスト分析blur — 前回のHIGH/MEDIUM指摘の大半が着実に実装されている。

しかし **72点は「仕組みが揃った」段階** に過ぎない。行動経済学的な最適化 — つまり「ユーザーの心理を動かす設計」がまだ足りない。特にゲスト→会員→有料のファネル設計が「見せてからロック」のゴールデンパターンを完全には採用していない。

---

# Part 1: セキュリティ審査（第3回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 今回（第3回） | 改善後見込み |
|------|-------------------|-------------------|-------------|------------|
| スコア | 48/100 | 72/100 | **78/100** | **90/100** |
| CRITICAL件数 | 4件 | 2件 | 2件 | 0件 |
| HIGH件数 | 6件 | 3件 | 3件 | 0件 |

**Agent S**: +6点の改善。CSPのnonce化は大きい。残るCRITICALは構造的なもので、修正には設計変更が必要。

---

## 致命的な問題（CRITICAL）

### SEC-C1: RSO→パスワードログインブロックがクライアント依存（TOCTOU脆弱性）

**該当ファイル**: `src/app/login/page.tsx` L62-66, L91-97

**現在の防御フロー**:
1. クライアント側: `@lolcoach.ai` メールドメインをブロック（L62）
2. サーバー側: `signInWithPassword` 成功後に `app_metadata.auth_method === 'rso'` を確認し `signOut()` を実行（L92）

**問題点**:
- ステップ2は「ログイン成功 → セッション取得 → app_metadata確認 → signOut」という流れで、**signInWithPasswordが成功してからsignOutするまでの間にセッショントークンが発行されている**
- 攻撃者はレスポンスを途中で切断するか、並行リクエストでこのウィンドウを悪用できる可能性がある
- 理想的にはSupabaseのAuth Hook（`custom_access_token`）でRSOユーザーのパスワードログインをサーバーレベルで拒否すべき

**Agent S**: puuidはRiot APIで半公開情報。合成メールパターンが `rso_` + puuid で予測可能である以上、サーバーサイドでの拒否が必須。現時点ではメールが配達されないため即座の脅威は低いが、構造的な問題として残存。

**改善案（工数: 3時間）**:
1. Server Actionとして `signInWithPassword` + 即時チェック + 即時revoke をアトミックに実装
2. または Supabase Auth Hook `custom_access_token` でRSOユーザーのパスワードベースセッション発行を拒否
3. 合成メールにランダムソルトを含める: `rso_${puuid}_${randomBytes(4).toString('hex')}@lolcoach.ai`

**深刻度**: CRITICAL
**緊急度**: MEDIUM（現時点では合成メールが配達されないため即時の脅威は低い）

---

### SEC-C2: `analyzeMatch`（レガシー版）でクレジット消費がAIコール後（非DEBIT-FIRST）

**該当ファイル**: `src/app/actions/analysis/matchAnalysis.ts` L341-356

`analyzeMatchQuick`（L115-124）はDEBIT-FIRSTパターンを正しく実装しているが、レガシーの`analyzeMatch`関数（L225以降）は**AIコール完了後にクレジット消費**を行っている:

```typescript
// L341-356: AIコール成功後にクレジット消費
const { error } = await supabase.from("match_analyses").insert({...});
if (shouldIncrementCount) {
    await supabase.rpc('update_daily_analysis_count', {...});
} else if (!userApiKey && useEnvKey && !status.is_premium) {
    await supabase.rpc('decrement_analysis_credits', {...});
}
```

**リスク**: 攻撃者がタイミング攻撃で並行リクエストを送信した場合、クレジットチェック（L276）とクレジット消費（L353-356）の間にTOCTOUの窓が存在し、無料クレジットを超えてGemini APIを呼び出せる。**AIコストは直接的な金銭損失**。

**Agent M**: これはセキュリティ問題であると同時に収益保護の問題だ。1回のGemini APIコールは¥1程度だが、自動化された攻撃で100回呼ばれれば¥100。規模が大きくなれば無視できない。

**改善案（工数: 2時間）**:
1. `analyzeMatch` にもDEBIT-FIRSTパターンを適用
2. クレジット消費 → AIコール → 失敗時リファンドのフロー
3. `analyzeMatchTimeline`（`coach/analyze.ts` L409-411）にも同様に適用

**深刻度**: CRITICAL（金銭損失の経路）
**緊急度**: HIGH

---

## 重大な問題（HIGH）

### SEC-H1: インメモリレート制限のサーバーレス環境での限界

**該当ファイル**: `src/middleware.ts` L7

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
```

Vercel等のサーバーレス環境ではリクエストごとにプロセスが異なるインスタンスで処理される可能性がある。このインメモリMapは**単一プロセスの寿命内でのみ有効**であり、分散環境では実質的にレート制限が機能しない可能性が高い。

**Agent S**: これは「レート制限がある」という**誤った安心感**を生む最も危険なパターン。ないよりマシだが、防御として信頼してはならない。

**改善案（工数: 4時間）**:
1. Vercel KV（Redis互換）やUpstash Redisを使用した分散レート制限に移行
2. 最低限 Supabase RPCでのアトミックなレート制限チェックを検討

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### SEC-H2: ゲストクレジットのService Role独自構築

**該当ファイル**: `src/app/actions/guestCredits.ts` L8-12

```typescript
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}
```

他の箇所では共通の `createServiceRoleClient()` を使用しているが、ここだけ独自構築。`auth.autoRefreshToken: false` / `auth.persistSession: false` の安全設定が適用されていない。

**改善案（工数: 15分）**: 共通の `createServiceRoleClient()` に統一

**深刻度**: HIGH
**緊急度**: LOW

---

### SEC-H3: `analyzeMatchTimeline`でもクレジット消費がAIコール後

**該当ファイル**: `src/app/actions/coach/analyze.ts` L409-411

SEC-C2と同様の問題。タイムラインデータの取得 + AI生成は数十秒かかるため、TOCTOUの窓がさらに大きい。

**深刻度**: HIGH
**緊急度**: HIGH

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 工数 |
|----|------|--------|------|
| SEC-M1 | `style-src 'unsafe-inline'` が依然として有効 | Tailwind CSS v4はビルド時CSS生成のため `unsafe-inline` 不要の可能性。段階的にnonceベースへ移行 | 4h |
| SEC-M2 | `analyzeMatch`レガシー関数でGeminiエラーメッセージの直接露出（L334） | `analyzeMatchQuick`と同様にサニタイズ | 15m |
| SEC-M3 | Sentry Event IDのユーザー露出 | 内部システム情報の露出。サポートIDとして有用だが `ref-XXXX` 形式に置換推奨 | 30m |
| SEC-M4 | Subscription Pause APIのバリデーション不足（`months`の型チェックなし） | Zodバリデーション適用 | 15m |
| SEC-M5 | Weekly Summary CronのN+1クエリ — ユーザー増加時にタイムアウト | バッチクエリに変更 | 2h |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| SEC-L1 | Gemini APIキー正規表現が `{35}` 固定 → `{30,50}` に緩和を検討 |
| SEC-L2 | `analyze/page.tsx` L163-170: ゲストクレジット確認エラー時に `canAnalyze: true` にフォールバック（Fail-Open） |
| SEC-L3 | `verifyAndAddSummoner(summonerData: any)` — 型安全性なし、Zodバリデーション未適用 |
| SEC-L4 | `setRankGoal` でpuuidの所有権チェックなし（RLS依存） |
| SEC-L5 | `getRankGoal`, `getStatsFromCache` 等で `puuidSchema` バリデーション未適用 |

---

## セキュリティの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **nonce-based CSP** | per-request nonce + `strict-dynamic` で `unsafe-inline` を実質無効化。exemplary |
| 2 | **Turnstile CAPTCHA導入** | ゲスト分析にCloudflare Turnstile + サーバー側Fail-Closed検証 |
| 3 | **認証レート制限の二重防御** | middleware + クライアント側ロックアウト |
| 4 | **DEBIT-FIRSTパターンの部分導入** | `analyzeMatchQuick`と`startVisionAnalysis`で正しく実装 |
| 5 | **RSO CSRF防御** | state Cookie: 10分TTL + HttpOnly + Secure + SameSite |
| 6 | **Stripe Webhook idempotency** | DB-based `claim_webhook_event` RPCでリプレイ攻撃防止 |
| 7 | **DOMPurify全箇所適用** | `dangerouslySetInnerHTML` 使用箇所全てでサニタイズ |
| 8 | **価格IDホワイトリスト** | checkout routeでStripe Price IDを環境変数ベースで検証 |
| 9 | **Supabase Cookieのsecureフラグ** | `secure: process.env.NODE_ENV === 'production'` を一貫適用 |
| 10 | **入力バリデーション体系** | Zodスキーマ一元管理 + 主要APIルート/Server Action適用 |

---

## Agent S 総評

前回72点から78点へ、**+6点の改善**。CSPのnonce化という最大のCRITICALが解消されたのは大きい。Turnstile CAPTCHA、認証レート制限の追加も正しい方向。

しかし **致命的な構造的問題が2つ残存**:

1. **RSOパスワードブロックがクライアント依存**: `signInWithPassword` 成功時点でセッショントークン発行済み。サーバーレベルでの拒否が必要。
2. **DEBIT-FIRSTパターンの不完全な適用**: `analyzeMatch`（レガシー）と`analyzeMatchTimeline`がDEBIT-AFTERのまま。AI APIコストの直接損失リスク。

さらに **インメモリレート制限はVercelのサーバーレス環境では事実上無意味** という点を強く指摘する。

**一言**: 壁は厚くなったが、裏口がまだ2つ開いている。DEBIT-FIRSTの統一適用は今すぐ対応すべき。

---

# Part 2: マネタイゼーション審査（第3回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 今回（第3回） | 改善後見込み |
|------|-------------------|-------------------|-------------|------------|
| スコア | 32/100 | 55/100 | **72/100** | **88/100** |
| 推定月間収益（MAU 500） | 3,000~8,000円 | 15,000~30,000円 | 40,000~70,000円 | 120,000~200,000円 |
| 推定CVR | ~0.5% | ~2% | ~4% | ~7-10% |

**Agent M**: +17点の大幅改善。仕組みは揃った。次は「心理を動かす設計」のフェーズ。

---

## 致命的な問題（CRITICAL）

### MON-C3: フリーミアム月2回の心理的デッドゾーン

**該当ファイル**: `src/app/actions/constants.ts`

前回の「週1回」から「月2回」に変更。数値だけ見れば制限強化で課金動機は上がった。しかし**月2回ではユーザーがサービスの価値を体験する前に離脱するリスクが高い**。

- LoLは週2-5試合プレイするゲーム。月2回の分析では「使い慣れる」前にフラストレーションが溜まる
- Free(月2回) → Premium(週20回=月80回)の**40倍のギャップ**は心理的に「そんなに要らない」と感じさせる
- 中間ステップ（週3-5回程度のライトプラン）がない

**Agent S**: セキュリティの観点から補足。月2回に減らしたことでGemini APIコストは削減されたが、離脱率が上がれば結果的にLTVは下がる。

**改善案**:
1. 週1回（月4回相当）に戻し、代わりにゲーティングを強化（無料ではマクロ分析のみ、ミクロは有料限定）
2. フリーミアム最初の2週間だけ週3回にして「体験期間」を設ける
3. 中間プランの導入: Lite ¥480/月（週5回）→ Premium ¥980/月

**深刻度**: CRITICAL（ユーザー獲得のボトルネック）
**緊急度**: HIGH

---

### MON-C4: ゲスト分析のblur/ロックが「見せてからロック」のゴールデンパターンになっていない

**該当ファイル**: `src/app/analyze/components/MacroResultSection.tsx`

ゲストには `overallSummary` の `mainIssue` と `homework` の `title` は表示し、`description` と `howToCheck` をblurにしている。しかし**セグメント分析は全てblur**。

**問題**: 全blurではユーザーは「何が隠れているか分からない」ため、アンロックする動機が弱い。行動経済学の「エンダウメント効果」を活用していない。

**あるべき姿**: セグメント1件目は完全表示 → 「こんなに詳しく分析できるのか」と体験 → 2件目以降をblur+CTA → 「もっと見たい」欲求

**改善案（工数: 2時間）**:
1. セグメント1件目を完全表示、2件目以降をblur+CTA
2. MicroResultSectionでも同様に最初のセクションのみ完全表示

**深刻度**: CRITICAL（コンバージョン最大化の要）
**緊急度**: HIGH

---

## 重大な問題（HIGH）

### MON-H5: Extra プランの差別化が依然として弱い

**該当ファイル**: `src/app/pricing/page.tsx`

Extra(1,480円)とPremium(980円)の差額500円/月。追加価値:
- AIダメージ分析（Extra限定）
- セグメント 4 → 5（+1）
- 週間分析 20 → 50（+30）

**500円の追加でダメージ分析+セグメント1個+30回では弱い**。特にダメージ分析の実用性がユーザーに伝わりにくい。

**改善案**:
1. Extra限定機能の追加: チャンピオンピック推薦AI、週次レポートPDF出力、対面別勝率推移
2. または2プラン制に簡略化: Free → Pro ¥980/月（全機能）

---

### MON-H6: `DashboardClientPage.tsx`にPremiumPromoCard/ReferralCard/AdSenseBannerがない

`DashboardContent.tsx`（新SWRバージョン）にはアップセル・リファラル・広告が配置されているが、`DashboardClientPage.tsx`（旧SSRバージョン）には**一切ない**。旧バージョン経由のユーザーにはアップセル動線も広告も表示されていない可能性。

**改善案**: `DashboardClientPage.tsx`にも同様のウィジェットを追加するか、完全に統一する。

---

### MON-H7: リワード広告の実装が不完全 — 広告なしでスキップ可能

**該当ファイル**: `src/app/components/ads/RewardedAdModal.tsx`

広告が10秒以内に読み込まれない場合、カウントダウンが開始されない。しかし**スキップボタン（`onClose`）は常に表示**。ユーザーは広告を一切見ずにスキップして分析を実行できる。さらに**広告視聴の完了を検証するサーバーサイドの仕組みがない**。

**改善案（工数: 2時間）**:
1. スキップボタンは広告ロード完了+カウントダウン終了後のみ表示
2. サーバーサイドでリワード検証を行う

---

### MON-H8: トライアル終了前リマインドメールがない

**該当ファイル**: `src/app/api/checkout/route.ts`

`trial_period_days: 7` を設定しているが、トライアル終了前のリマインドメールがない。自動課金はチャーンの主因になりうる。

**改善案（工数: 3時間）**:
1. Stripe webhook `customer.subscription.trial_will_end` をハンドル
2. トライアル終了2日前にリマインドメール送信

---

### MON-H9: Webhook/CheckoutでのExtra年間プランtier判定に不具合の可能性

**該当ファイル**: `src/app/api/webhooks/stripe/route.ts` L113

```typescript
const subscriptionTier = (EXTRA_PRICE_ID && subscribedPriceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';
```

年間Extra（`NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID`）との比較が**欠落**している。年間Extraで加入しても tier が `premium` になる可能性。**収益に直結するバグ**。

**改善案（工数: 30分）**:
```typescript
const isExtra = subscribedPriceId === EXTRA_PRICE_ID || subscribedPriceId === EXTRA_ANNUAL_PRICE_ID;
const subscriptionTier = isExtra ? 'extra' : 'premium';
```

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 工数 |
|----|------|--------|------|
| MON-M7 | LPがCSRのままでSEO/Core Web Vitalsに悪影響 | SSR/SSG化。Framer MotionをIntersection Observer + CSS transitionに置換 | 8h |
| MON-M8 | 価格ページにFAQセクションがない | FAQ付き価格ページはCVRが15-25%高いデータあり | 3h |
| MON-M9 | サイドバーに「Pricing」リンクがない | 無料ユーザーがPricingに到達する動線が受動的すぎる | 30m |
| MON-M10 | テスティモニアルが3件ハードコード | 5件以上+ランク・ロール等のバリエーション | 2h |
| MON-M11 | API routeのエラーメッセージのi18n不完全 | エラーコードを返してクライアント側で翻訳するパターンに変更 | 4h |
| MON-M12 | リファラル報酬が紹介者のみ（被紹介者インセンティブなし） | 双方向報酬: 被紹介者にもトライアル延長2週間 | 2h |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| MON-L5 | 年間プランの割引率表示がロケール差異を考慮していない |
| MON-L6 | ゲスト分析の固定セグメントが2つだけ — 第一印象の品質に影響 |
| MON-L7 | フリーユーザーにリファラルカード表示 — 報酬が「サブスク延長」で無意味 |
| MON-L8 | Extra年間プランのtier判定にWebhookバグの可能性（MON-H9参照） |

---

## マネタイゼーションの良い点

| # | 実装 | 評価 |
|---|------|------|
| 1 | **年間プラン導入** | Premium年額7,800円(34%OFF)、Extra年額8,800円(50%OFF)。月額/年額切替UIも実装。LTV最大化への重要なステップ |
| 2 | **一時停止オプション** | 2ステップの解約フロー + 1/2/3ヶ月休止。Stripeの`pause_collection`を正しく使用。チャーン低減に直結 |
| 3 | **リファラルプログラム** | コード生成・共有・Webhook報酬付与の一連フロー。有機的成長への布石 |
| 4 | **週次サマリーメール** | Resend API + Cron Job。Premium/Extra会員のエンゲージメント維持 |
| 5 | **ゲスト分析のblur/ロック** | 結果の一部を隠して会員登録を促す設計。方向性は正しい |
| 6 | **アップグレードモーダル** | クレジット切れ時にFaCrown+CTA。セッション内1回のクールダウン |
| 7 | **Dynamic Pricing** | Stripe Price APIから動的取得+フォールバック。A/Bテストの基盤 |
| 8 | **プラン切替プロレーション** | 日割りクレジット+クーポン自動発行 |
| 9 | **広告配置の最適化** | 分析ページに5箇所+Premiumユーザーには非表示 |
| 10 | **Extra値下げ** | 2,980円→1,480円でアップグレードのハードルを下げた |

---

## Agent M 総評

前回55点から72点へ、**17点の改善**。前回CRITICALだった2件は適切に対処され、年間プラン・一時停止・リファラル・メール通知と「収益化の仕組み」は一通り揃った。

しかし **28点分の改善余地** が残る:

1. **フリーミアムの月2回制限は攻めすぎた**: 体験前離脱リスク。Free→Premiumの間に中間ステップがない
2. **ゲスト分析のblur設計**: 「1件見せて残りロック」のゴールデンパターン未採用
3. **Extraプランの差別化**: 価格引き下げは応急処置。根本的な価値提案の拡充が必要
4. **Extra年間プランのtier判定バグ**: Revenue直結。即修正必須
5. **トライアル終了リマインドなし**: 自動課金によるチャーン発生リスク

**一言**: 「レストランにレジもメニューも揃った」。次は「ウェイターの接客」— ユーザーを席に着かせ、最高の一皿を味わわせ、常連になってもらう設計だ。

---

# Part 3: 両エージェント共同議論

## Agent S × Agent M: クロスドメイン議論

**Agent M**: セキュリティ問題がマネタイゼーションに直結するケースがある。SEC-C2のDEBIT-AFTERはAPI利用料の直接損失だし、MON-H9のExtra年間プランtier判定バグはtierを`premium`にしてしまう＝Extra機能へのアクセスを不正に制限する。ユーザーから見れば「お金を払ったのにExtraの機能が使えない」という最悪の体験になる。

**Agent S**: 同意する。逆方向も指摘したい。MON-H7のリワード広告スキップ問題は、広告収益のセキュリティ問題でもある。クライアントサイドのみの検証はブラウザのDevToolsで簡単にバイパスできる。

**Agent M**: もう一つ。インメモリレート制限（SEC-H1）が機能しないと、ログインブルートフォースだけでなく、Gemini APIの無断呼び出しにも影響する。分散レート制限への移行はセキュリティとコスト管理の両面で必須だ。

**Agent S**: 最後に。今回新たに発見されたguestCreditsのService Role独自構築（SEC-H2）は、共通クライアントに統一するだけで解決する。15分の作業だ。セキュリティの改善に大きな工数は必ずしも必要ない。

---

## 統合改善ロードマップ

### Phase 1: 即時対応（1-2日）— バグ修正 + セキュリティ

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 1 | **MON+SEC** | Extra年間プランのtier判定バグ修正（webhook + checkout） | 30m | Revenue直結バグ修正 |
| 2 | **SEC** | DEBIT-FIRSTパターンを`analyzeMatch`と`analyzeMatchTimeline`に統一適用 | 2h | APIコスト保護 |
| 3 | **SEC** | guestCreditsのService Roleを共通クライアントに統一 | 15m | セキュリティ標準化 |
| 4 | **SEC** | Geminiエラーメッセージの直接露出修正 | 15m | 情報漏洩防止 |
| 5 | **SEC** | Subscription Pause APIにZodバリデーション適用 | 15m | 入力安全性 |

### Phase 2: 短期施策（3-5日）— コンバージョン最適化

| # | 領域 | 施策 | 工数 | 収益インパクト |
|---|------|------|------|-------------|
| 6 | **MON** | ゲスト分析blurを「1件表示+残りロック」に変更 | 2h | CVR +2-3% |
| 7 | **MON** | リワード広告のスキップ制御修正 | 2h | 広告収益保護 |
| 8 | **MON** | 価格ページにFAQセクション追加 | 3h | CVR +15-25% |
| 9 | **MON** | サイドバーに「Pricing」リンク追加（Freeユーザーのみ） | 30m | アップセル導線 |
| 10 | **MON** | DashboardClientPageにPremiumPromoCard等追加 | 1h | アップセル漏れ修正 |

### Phase 3: 中期施策（1-2週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 11 | **SEC** | 分散レート制限への移行（Upstash Redis等） | 4h | 認証保護の実効化 |
| 12 | **MON** | トライアル終了リマインドメール | 3h | チャーン率低減 |
| 13 | **MON** | リファラル報酬の双方向化 | 2h | 紹介率向上 |
| 14 | **MON** | テスティモニアル5件+バリエーション追加 | 2h | 社会的証明強化 |
| 15 | **SEC** | RSO認証のサーバーサイドブロック強化 | 3h | アカウント保護 |

### Phase 4: 長期施策（2-4週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 16 | **MON** | Extraプランの独自価値追加 or 2プラン制への簡略化 | 8h | CVR改善 |
| 17 | **MON** | フリーミアム制限の再設計（月2回→週1回+ゲーティング変更） | 4h | 離脱率低減 |
| 18 | **MON** | LPのSSR/SSG化 | 8h | SEO/CWV改善 |
| 19 | **SEC** | `style-src 'unsafe-inline'` の除去 | 4h | CSP完全化 |

---

## 最終評点

### セキュリティ: 78/100（前回72 → +6）

**Agent S の総評**:

CSPのnonce化は**決定的な改善**だ。48→72→78と着実にスコアを上げており、個人開発プロジェクトとして極めて高い水準に達しつつある。

残る課題は構造的なもの — DEBIT-FIRSTの統一適用とインメモリレート制限の分散化。これらを対応すれば**88-90点**に到達する。90点超えにはペネトレーションテストが必要だが、個人開発の段階では不要。

**スコア推移**: 48 → 72 → **78** → (改善後見込み: **90**)

---

### マネタイゼーション: 72/100（前回55 → +17）

**Agent M の総評**:

32→55→72と大幅な改善。年間プラン、一時停止、リファラル、メール通知、広告最適化、ゲスト分析blur — 「収益化の仕組み」は一通り揃った。

次の17点分の改善は **「仕組み」から「最適化」へのフェーズ転換** が必要:
- ゲスト分析のblurパターン改善（即効性あり）
- Extra年間プランのtier判定バグ修正（即修正必須）
- フリーミアムの段階設計見直し（中期）
- Extraプランの独自価値追加（長期）

**スコア推移**: 32 → 55 → **72** → (改善後見込み: **88**)

---

## 総合スコア: 75/100（前回63.5 → +11.5）

| 領域 | 第1回 | 第2回 | 第3回 | 改善後見込み |
|------|-------|-------|-------|------------|
| セキュリティ | 48 | 72 | **78** | 90 |
| マネタイゼーション | 32 | 55 | **72** | 88 |
| **総合** | **40** | **63.5** | **75** | **89** |

---

*審査完了: 2026-03-01（第2版）*
*次回審査推奨: Phase 2 完了後（1-2週間後）*
