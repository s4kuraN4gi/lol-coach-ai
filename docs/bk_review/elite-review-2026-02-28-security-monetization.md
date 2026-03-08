# LoLCoachAI エリート辛口審査 -- セキュリティ & マネタイゼーション

## 審査日: 2026-02-28
## 審査者: セキュリティ専門エージェント + 収益戦略専門エージェント

---

# Part 1: セキュリティ辛口審査

## 総合評価
- 現在のスコア: **48/100**
- 改善後の見込みスコア: **78/100**

前回のUX/アーキテクチャ審査(38/100)と比較すると、直近のマイグレーション（`harden_profiles_rls`, `atomic_daily_chat_count`, `atomic_credit_functions`）で重要なセキュリティ改善が施されている。しかし、まだ致命的な問題がいくつか残っている。

---

## 前回指摘の改善状況

| 指摘ID | 内容 | ステータス | コメント |
|--------|------|-----------|---------|
| CRITICAL-1 | Server Actionの100MB bodySizeLimit | **改善済** | 10MBに引き下げ済み（`next.config.ts` L50）。ただし10MBでも大きい（後述） |
| CRITICAL-2 | Fire-and-Forgetパターン | **改善済** | `vision.ts` で `after()` API使用に移行 |
| CRITICAL-3 | getAnalysisStatusのRead時Write問題 | **改善済** | `getAnalysisStatus()` を純粋READ、`refreshAnalysisStatus()` をWRITE付きに分離 |
| CRITICAL-4 | supabase.auth.getUser()の36回重複呼び出し | **一部改善** | `callerUserId` パラメータ導入で内部関数のgetUser()スキップを実装 |
| HIGH-3 | チャットAPIにRate Limitingなし | **改善済** | `increment_daily_chat_count` RPC関数でアトミックなレート制限を実装 |

---

## 致命的な問題（CRITICAL）

### CRITICAL-1: ユーザー提供APIキー（BYOK）がサーバーログに漏洩 + 悪意あるキー検証なし

**該当ファイル**:
- `src/app/actions/analysis.ts` L498, L646, L813
- `src/app/actions/vision.ts` L232
- `src/app/actions/coach.ts`
- `src/lib/gemini.ts` L9-16

**問題**: ユーザーが自前のGemini APIキーを提供できるBYOK機能がある。このキーに対して以下の問題がある:

1. **APIキーの検証が一切ない**: ユーザーが任意の文字列を `userApiKey` として渡せる。悪意あるユーザーが超長文字列を渡してメモリを消費させる可能性がある
2. **APIキーがGeminiクライアントキャッシュに永続化**: `gemini.ts` の `Map<string, GoogleGenerativeAI>` にユーザー提供キーが蓄積され、プロセスのメモリに無期限で残る
3. **console.log/console.warn にAPIキーの存在が示唆される**

**攻撃シナリオ**:
- 攻撃者が盗まれたAPIキーをサービス経由で使い、不正利用のログがLoLCoachAIのサーバーに残る
- 大量の偽キーを送り付けてキャッシュMapを肥大化させるメモリ枯渇攻撃

**改善案**:
1. `userApiKey` のフォーマットバリデーション（Gemini APIキーは `AIza` で始まる39文字の英数字）
2. `gemini.ts` のキャッシュにTTL（5分等）とサイズ上限（最大50エントリ）を設定
3. ユーザー提供キーはキャッシュせず毎回インスタンス生成するか、LRUキャッシュを使用

---

### CRITICAL-2: Auth Callbackの `x-forwarded-host` によるオープンリダイレクト

**該当ファイル**: `src/app/auth/callback/route.ts` L15-21

```typescript
const forwardedHost = request.headers.get('x-forwarded-host')
if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
}
```

**問題**: `x-forwarded-host` ヘッダーはプロキシ設定によっては攻撃者が偽装可能。ホワイトリスト検証なしに任意のホストにリダイレクトしている。

**攻撃シナリオ**:
1. 攻撃者が `x-forwarded-host: evil.example.com` を設定
2. 認証成功後、ユーザーが `https://evil.example.com/dashboard` にリダイレクト
3. フィッシングサイトでセッション情報を窃取

**改善案**:
1. `forwardedHost` を許可されたドメインのホワイトリスト（`NEXT_PUBLIC_APP_URL` のホスト部分）と照合
2. または `forwardedHost` の使用を廃止し、常に `origin` を使用

---

### CRITICAL-3: RSO（Riot Sign-On）コールバックでのパスワードリセット脆弱性

**該当ファイル**: `src/app/api/auth/callback/riot/route.ts` L94-166

**問題**: RSO認証フローに深刻な設計上の問題がある:

1. **既存ユーザーのパスワードを無断でリセット** (L133): 毎回ランダムパスワードに変更。手動パスワード設定は上書きされる
2. **メール合成の予測可能性** (L91): `rso_${puuid}@lolcoach.ai` というパターンが予測可能

**攻撃シナリオ**:
- puuid（LoLでは公開情報に近い）を知っている攻撃者が `rso_${puuid}@lolcoach.ai` でパスワードリセットフローを悪用

**改善案**:
1. RSOユーザーにはパスワード認証を完全に無効化し、常にOAuth/マジックリンクのみを使用
2. `app_metadata` に `auth_method: 'rso'` を設定し、パスワード認証を拒否
3. 合成メールアドレスにランダムソルトを含める

---

### CRITICAL-4: Server Actionの入力バリデーションが事実上ゼロ

**該当ファイル**: 全Server Action / API Route

**問題**: プロジェクト全体でZod等のスキーマバリデーションライブラリが一切使用されていない。全入力値を型キャストのみで使用。

具体例:
- `chat/route.ts` L11: `message` が100万文字でも受け入れる
- `analysis.ts`: `matchId` のフォーマット検証なし
- `guestAnalysis.ts`: `language` パラメータが列挙型バリデーションなし

**攻撃シナリオ**:
- `message` に巨大文字列を送りGemini APIコストを爆発させる
- `language` パラメータにプロンプトインジェクション

**改善案**:
1. zodを導入し、全Server Action/API Routeの入力にスキーマバリデーションを適用
2. 最低限: `matchId` は `/^[A-Z]{2,4}\d?_\d+$/`、`message` は10,000文字以内、`frames` は30枚以内かつ各1MB以内

---

## 重大な問題（HIGH）

### HIGH-1: CSPで `'unsafe-eval'` が許可されている

**該当ファイル**: `next.config.ts` L6

**問題**: `'unsafe-eval'` はXSSの主要な緩和策であるCSPの効果を大幅に弱体化させる。

**改善案**: 開発/本番でCSPを分岐し、本番では `'unsafe-eval'` を除外。

---

### HIGH-2: ゲストクレジットのIPベース認証にスプーフィング脆弱性

**該当ファイル**: `src/app/actions/guestCredits.ts` L14-37

**問題**: `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` のフォールバックだが、Cloudflareを使っていない場合は攻撃者がヘッダー偽装可能。

**改善案**:
1. デプロイ先に応じたIP取得方法の固定
2. ゲスト機能にCAPTCHA（hCaptcha/Turnstile）を追加

---

### HIGH-3: Service Roleクライアントの多用 -- 最小権限の原則違反

**該当ファイル**: `analysis.ts`, `guestCredits.ts`, `checkout/route.ts`, `riot/route.ts` 等

**問題**: `createServiceRoleClient()` がRLSを完全にバイパスする形で多数のServer Action内で使用。`callerUserId` が渡された場合に`getUser()` チェックがスキップされるため、信頼できない入力から他ユーザーのプロフィールを更新できるリスク。

**改善案**: Service Roleの使用箇所を監査し、RPC関数（`SECURITY DEFINER` + `auth.uid()` チェック）に置き換え。

---

### HIGH-4: console.logにユーザーIDや内部状態が大量出力 -- 215件

**問題**: Server Actionファイル群に215件の `console.log/error/warn` が存在。ユーザーIDが出力されGDPR/個人情報保護法上のリスク。

**改善案**: 構造化ロギングライブラリ（pino等）を導入し、本番環境ではdebugレベルを抑制。

---

### HIGH-5: パスワード最低文字数が6文字

**該当ファイル**: `supabase/config.toml` L171

**改善案**: `minimum_password_length` を8以上に変更 + クライアントサイドで強度チェック追加。

---

### HIGH-6: Gemini APIへのプロンプトインジェクション防御なし

**該当ファイル**: `chat/route.ts`, `vision.ts`

**問題**: ユーザー入力がサニタイズされずにプロンプトに直接埋め込まれている。

**改善案**:
1. ユーザー入力をXMLタグ等で区切り境界を明確化
2. システムプロンプトに防御指示を追加
3. 出力フィルタリング

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 |
|----|------|--------|
| MEDIUM-1 | Middlewareが `/api/chat`, `/api/checkout`, `/api/billing` を保護していない | ミドルウェアで保護対象を拡大 |
| MEDIUM-2 | bodySizeLimitが10MB -- まだ大きい | 5MBに引き下げ |
| MEDIUM-3 | `use_guest_credit` RPCにレースコンディション | `UPDATE ... WHERE credits > 0 RETURNING` で1文に |
| MEDIUM-4 | Stripe `priceId` のホワイトリスト検証なし | 許可された priceId と照合 |
| MEDIUM-5 | Error Boundaryがエラーメッセージを表示 | SentryイベントIDを表示する方式に |
| MEDIUM-6 | billing/route.tsにStripe APIキー先頭7文字のコード残存 | 該当行を削除 |
| MEDIUM-7 | `match_cache` テーブルのRLS -- 認証ユーザー全員が全データにアクセス可能 | UPDATEポリシーに `user_id` チェック追加 |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| LOW-1 | `next` パラメータのオープンリダイレクト防止が不完全（バックスラッシュ未考慮） |
| LOW-2 | Sentryのsourcemapsがトークン未設定時に無効化 |
| LOW-3 | `SameSite` Cookieポリシーの明示的設定なし |
| LOW-4 | CSP `connect-src` に広範なワイルドカード |

---

## 良い点（評価できる実装）

1. **RLSポリシーの強化**: profilesテーブルのSELECTを自分のみに制限、UPDATEで機密カラム変更を防止
2. **Stripe Webhook署名検証**: 正しく実装済み
3. **RPC関数のauth.uid()チェック**: 全SECURITY DEFINER関数にIDOR防止を追加
4. **アトミックなクレジット操作**: TOCTOU防止のRPC関数群
5. **セキュリティヘッダーの網羅性**: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP
6. **RSO CSRFバリデーション**: `rso_state` Cookieによる検証
7. **DOMPurifyの使用**: `dangerouslySetInnerHTML` 箇所でサニタイズ
8. **エラーメッセージの抽象化**: 内部エラーとユーザー向けエラーの分離
9. **Geminiクライアントのシングルトンキャッシュ**
10. **Webhookルートのミドルウェア除外**

---

## セキュリティ改善ロードマップ

### Phase 1: 今すぐ（1-2日）
| 優先度 | 指摘ID | 作業内容 | 工数 |
|--------|--------|---------|------|
| CRITICAL | CRITICAL-2 | Auth Callbackの `x-forwarded-host` ホワイトリスト検証 | 30分 |
| CRITICAL | CRITICAL-4 | zodを導入し、chat API/主要Server Actionに入力バリデーション | 4時間 |
| HIGH | HIGH-1 | CSPから `'unsafe-eval'` を本番環境で除外 | 1時間 |
| HIGH | HIGH-5 | パスワード最低文字数を8に変更 + クライアント側バリデーション | 1時間 |
| MEDIUM | MEDIUM-4 | Stripe priceIdのホワイトリスト検証 | 30分 |
| MEDIUM | MEDIUM-6 | billing/route.tsの不要なキープレフィックス行を削除 | 5分 |

### Phase 2: 今週中（3-5日）
| 優先度 | 指摘ID | 作業内容 | 工数 |
|--------|--------|---------|------|
| CRITICAL | CRITICAL-1 | BYOKキーのバリデーション + Geminiキャッシュにサイズ上限/TTL | 2時間 |
| CRITICAL | CRITICAL-3 | RSO認証フローの再設計 | 4時間 |
| HIGH | HIGH-2 | ゲストIPスプーフィング対策 | 3時間 |
| HIGH | HIGH-6 | プロンプトインジェクション防御 | 2時間 |
| MEDIUM | MEDIUM-1 | ミドルウェアでAPI Route保護を拡大 | 1時間 |
| MEDIUM | MEDIUM-3 | guest_credits のuse_guest_credit をアトミック化 | 1時間 |

### Phase 3: 今月中
| 優先度 | 指摘ID | 作業内容 | 工数 |
|--------|--------|---------|------|
| HIGH | HIGH-3 | Service Roleの使用箇所削減 + RPC関数への移行 | 8時間 |
| HIGH | HIGH-4 | 構造化ロギングの導入 + console.logの整理 | 4時間 |
| MEDIUM | MEDIUM-2 | bodySizeLimitを5MBに引き下げ | 2時間 |
| MEDIUM | MEDIUM-5 | Error Boundaryのエラー情報抽象化 | 1時間 |
| LOW | LOW-1-4 | 各種低リスク問題の対応 | 3時間 |

---
---

# Part 2: マネタイゼーション辛口審査

## 総合評価

| 指標 | 値 |
|------|-----|
| 現在のスコア | **32/100** |
| 改善後の見込みスコア | **71/100** |
| 現在の推定月間収益ポテンシャル | **3,000~8,000円**（MAU 500想定） |
| 改善後の推定月間収益ポテンシャル | **50,000~120,000円**（MAU 500想定） |

率直に言います。技術的には面白いプロダクトですが、マネタイゼーションの設計は「収益化を後回しにして機能を作り続けた開発者」の典型パターンです。フリーミアムモデルのあらゆるアンチパターンが揃っています。無料ユーザーに与えすぎ、有料ユーザーへの差別化が弱すぎ、コンバージョン導線がほぼ存在しない。

---

## 前回指摘の改善状況

| 指摘ID | 内容 | ステータス | コメント |
|--------|------|-----------|---------|
| C-2 | `alert()` によるエラー通知 | **一部改善** | `checkout.ts` が `toast` に移行済み。但し他箇所は未改善 |
| C-4 | 料金表示の不一致 | **改善済み** | 料金ページは `¥2,980` で統一表示 |
| H-7 | フッターの著作権年ハードコード | **改善済み** | `new Date().getFullYear()` を使用 |
| H-8 | PremiumFeatureGateのCTAが弱すぎる | **一部改善** | ベネフィット説明とCTAボタン追加。但し配置箇所が少なすぎる |
| M-4 | ゲスト→無料→有料のファネル導線が不明確 | **未改善** | ゲスト分析後の転換CTAが依然として存在しない |

---

## 致命的な問題（CRITICAL）

### CRITICAL-1: フリーミアムの「フリー」が太っ腹すぎて課金動機が消滅している

**該当ファイル**: `src/app/actions/constants.ts`, `src/app/actions/guestConstants.ts`

**問題**: 現在のプラン階層:

| 項目 | ゲスト（IP制） | Free | Premium ¥980/月 | Extra ¥2,980/月 |
|------|-------------|------|----------------|----------------|
| 週次分析回数 | 3回/3日補充 | **1回/週** | 20回/週 | 50回/週 |
| セグメント数 | 2固定 | 2 | 4 | 5 |
| Riot API連携 | x | o | o | o |
| 試合履歴 | x | o | o | o |
| ビルドアドバイス | x | x | o | o |
| AIチャット | x | x | o | o |
| 広告非表示 | x | x | o | o |
| AIダメージ分析 | x | x | x | o |

致命的な問題点:
1. **Free→Premiumの価値ギャップが曖昧**: Freeで週1回分析+全ダッシュボード機能が使える。カジュアルプレイヤーには十分
2. **ゲストが使いやすすぎる**: VPN使えば無限
3. **BYOK（後述CRITICAL-4）で課金ロジックが完全にバイパスされる**

**ビジネスインパクト**: コンバージョン率は1%以下と推定。MAU 500人でもPremium課金者は5人以下。

**改善案**:
1. Free分析をゼロに（閲覧のみ）。分析は全てPremium以上
2. ゲストクレジットを1回に削減
3. Premiumの独自価値を増加（週次レポート、トレンドグラフ等）

---

### CRITICAL-2: ダッシュボード内にアップグレード導線がゼロ

**該当ファイル**: `src/app/dashboard/components/DashboardContent.tsx`

**問題**: ダッシュボードのメインコンテンツに以下のウィジェットがあるが:
- ProfileCard, RankGraph, RankGoalTracker, QuickStats, NextGameFocus, SkillRadar, ChampionPerformance, WinConditionWidget, NemesisWidget

**この中にPremiumPromoCard、PremiumFeatureGate、または任意のアップグレードCTAは一切存在しない。** PremiumPromoCardは作ったが配置していない。

**ビジネスインパクト**: コンバージョンの最大機会損失。ダッシュボードのインプレッションの95%以上が課金導線なしで消費。

**改善案**:
1. ダッシュボードにPremiumPromoCardを常時表示
2. 分析回数残り0のときに大きなアップグレードバナー表示
3. SkillRadarやChampionPerformanceの一部をPremiumFeatureGateでラップ
4. 「あなたの今週のAI分析：0/1（残り0回）」+「Premiumなら週20回」の使用状況バー

---

### CRITICAL-3: ゲスト分析後の転換ファネルが完全に欠如

**該当ファイル**: `src/app/analyze/page.tsx`, `src/app/actions/guestAnalysis.ts`

**問題**: `GuestAnalysisResult` に `isGuest` と `remainingCredits` が返却されるが、分析結果表示後にアップセルUIが実装されていない。ゲストは無料で分析を受け取り、そのまま離脱。

**ビジネスインパクト**: ゲスト分析のGemini APIコストを回収する手段がない。

**改善案**:
1. 分析結果の下にアップセルバナー表示
2. 「残りクレジット: X / 3」を常時表示
3. 分析結果の一部をブラーにし「続きを読むには会員登録」
4. 「分析履歴を保存するには会員登録」のインセンティブ

---

### CRITICAL-4: BYOKモデルが課金ロジックを根本的にバイパスしている

**該当ファイル**: `src/app/actions/analysis.ts` L487-496, L800-811 他6ファイル

**問題**: Freeユーザーが自前のGemini API Key（Google AI Studioで無料取得可能）を使えば、**クレジット消費なしで無制限に分析可能**。

```typescript
if (userApiKey) {
    useEnvKey = false;  // Use provided key, NO CREDIT CHECK
}
```

技術リテラシーの高いLoLプレイヤー（=最も課金見込みの高い層）ほどBYOKを使い、課金しない。

**ビジネスインパクト**: Premiumの価値提案を根本から破壊。

**改善案**:
1. **BYOKをPremium以上限定に変更**
2. Freeユーザーは一切のBYOKを不可に
3. 代替としてFreeの分析回数を週2回に引き上げ

---

## 重大な問題（HIGH）

### HIGH-1: 価格設定が市場と乖離 -- Extra ¥2,980は正当化できない

**問題**: Extra（¥2,980/月）とPremium（¥980/月）の差額¥2,000に対して追加価値が分析回数増とセグメント1増のみ。競合（u.gg Pro $2.99/月、Mobalytics Pro $7.99/月）と比較しても高い。

**改善案**: Extraを¥1,980に引き下げるか、Extra限定機能を大幅に追加、あるいはExtraを廃止してPremium一本に。

---

### HIGH-2: PremiumFeatureGateの使用箇所が少なすぎる

**問題**: 使用箇所は**3ファイルのみ**（ChampionDetailView, AIAnalysisPanel, chat/page）。ダッシュボードの大半の機能はFreeに丸見え。

**改善案**: SkillRadar詳細、NemesisWidget対策アドバイス、WinConditionWidget改善案等、合計10-15箇所にゲーティングを配置。

---

### HIGH-3: 解約フローがStripe Customer Portalへの丸投げ -- チャーン防止策がゼロ

**問題**: 自社アプリ内にチャーン防止の仕組みが一切ない。解約理由の収集、割引オファー、一時停止オプション、失うものの可視化 -- 何もない。

**改善案**:
1. 解約理由選択 → 無料延長オファー → 一時停止オプション → 最終確認
2. 「これまでに受けたAI分析: 47回、節約したAPI費用: ¥2,350」等の価値の可視化
3. 「解約すると失うもの」リストの表示

---

### HIGH-4: トライアル訴求が弱すぎる（3日間は短すぎる）

**問題**: 3日間の無料トライアルは実装済みだが、料金ページでの訴求は小さなバッジのみ。LoLのプレイ頻度は週2-3回なので、3日では1-2試合しか分析できない。

**改善案**: 7日間に延長。CTAを「**7日間無料で試す**」に変更。

---

### HIGH-5: 広告収益の実装が非機能的

**問題**:
1. **AdSenseBannerのslotIdがダミー**: デフォルト値 `"1234567890"`
2. **RewardedAdModalが広告なしでクレジット付与**: 5秒カウントダウンだけで「広告視聴完了」として1クレジット付与
3. **AdSenseがダッシュボード内に未配置**

**改善案**: 実際のAdSenseスロットID設定、RewardedAdModalは実際の広告読み込み確認後にのみクレジット付与。

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 |
|----|------|--------|
| MEDIUM-1 | ランディングページにソーシャルプルーフが不在 | テスティモニアル、利用者数カウンター、Before/After事例を追加 |
| MEDIUM-2 | チャット50回/日は寛大すぎる | 20回/日に削減 |
| MEDIUM-3 | Webhook処理に冪等性がない | `event.id` で処理済みイベントをスキップ |
| MEDIUM-4 | 価格がハードコード -- A/Bテスト不可能 | Stripe Price APIから動的取得 or 環境変数管理 |
| MEDIUM-5 | ランディングページがCSR -- SEOに不利 | コアコンテンツをServer Componentで静的生成 |
| MEDIUM-6 | ゲストクレジットのIPベース制御がVPNで無効化 | ブラウザフィンガープリンティング or reCAPTCHA追加 |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| LOW-1 | `checkout.ts` のエラーメッセージが英語のみ |
| LOW-2 | PremiumPromoCardで `confirm()` を使用（toast未移行） |
| LOW-3 | Stripe APIバージョンが最新固定（breaking changeリスク） |

---

## 良い点（評価できる実装）

1. **3層プラン設計の骨格は正しい**: Guest → Free → Premium → Extra の4段階ファネル構造
2. **Stripe Webhook処理が堅牢**: 4イベントを処理、`invoice.payment_failed` で `past_due` マーキング
3. **3日間無料トライアルの存在**: checkout APIに実装済み
4. **プラン切替時のプロレーション計算**: 日割りクレジットのクーポン発行
5. **PremiumFeatureGateの設計思想**: ブラー+ロックアイコン+CTAの構造は正しい
6. **週次リセットロジック**: LoLプレイヤーの週間リズムに合致
7. **i18nの料金ページ対応**: ほぼ全て `t()` でラップ済み
8. **checkout.tsのtoast移行**: alert問題の一部が改善

---

## マネタイゼーション改善ロードマップ（収益インパクト順）

### Phase 1: 即時対応（1-2週間）-- 推定収益インパクト: +300%

| # | 施策 | 工数 | 収益インパクト |
|---|------|------|-------------|
| 1 | **BYOK廃止**（FreeユーザーのuserApiKey受入を停止） | 2h | 極大 |
| 2 | **ダッシュボードにPremiumPromoCard配置** | 1h | 大 |
| 3 | **ゲスト分析結果後のアップセルCTA追加** | 4h | 大 |
| 4 | **PremiumFeatureGateの配置箇所を10箇所に拡大** | 4h | 大 |
| 5 | **RewardedAdModalの無条件クレジット付与を修正** | 1h | 中 |

### Phase 2: 短期施策（2-4週間）-- 推定収益インパクト: +150%

| # | 施策 | 工数 | 収益インパクト |
|---|------|------|-------------|
| 6 | **トライアル期間を7日間に延長** + CTA文言改善 | 2h | 大 |
| 7 | **Free分析回数の見直し**（週1→週0、閲覧のみに） | 3h | 大 |
| 8 | **ゲストクレジットを3→1に削減** | 1h | 中 |
| 9 | **チャーン防止フロー構築** | 8h | 大 |
| 10 | **AdSenseの実スロットID設定と配置最適化** | 3h | 中 |

### Phase 3: 中期施策（1-2ヶ月）-- 推定収益インパクト: +100%

| # | 施策 | 工数 | 収益インパクト |
|---|------|------|-------------|
| 11 | **ランディングページにソーシャルプルーフ追加** | 8h | 中 |
| 12 | **価格のStripe API動的取得** | 4h | 低 |
| 13 | **Webhook冪等性チェック追加** | 3h | 低 |
| 14 | **Extra プランの価値再設計または価格改定** | 8h | 中 |
| 15 | **SEO最適化**（LPのSSR化、構造化データ） | 16h | 中 |
| 16 | **週次パーソナライズレポートメール**（Premium限定） | 16h | 大 |

---

## 総評（両エージェント共同）

### セキュリティ（48/100）
前回審査からの改善は着実（RLS強化、アトミックRate Limiting、bodySizeLimit削減）。しかし**入力バリデーションの不在**と**BYOK APIキーの取り扱い**が根本的な問題として残る。即座にzodの導入とAuth Callbackのホワイトリスト検証を行うべき。

### マネタイゼーション（32/100）
現在の状態を例えるなら：**素晴らしい料理を出すレストランだが、入口に全品試食コーナーがあり、しかも裏口から入れば食べ放題。レジに行く通路すら案内されていない。**

最も収益に直結する単一の改善は **BYOKを廃止し、ダッシュボードにPremiumPromoCardを配置すること**。この2つだけでコンバージョン率は現在の推定0.5%から2-3%に上がる。
