# LoLCoachAI エリート辛口審査 — セキュリティ & マネタイゼーション（第5回）

## 審査日: 2026-03-02 00:32
## 審査者:
- **Agent S（セキュリティ専門）**: 元FAANG AppSecリード、OWASP Top 10監査 500件超
- **Agent M（マネタイゼーション専門）**: SaaS収益化コンサルタント、B2Cサブスク設計 200社超

---

# 前回審査（第4回 2026-03-01 21:49）からの改善状況

## セキュリティ改善サマリー

| 前回ID | 内容 | 改善状況 | 詳細 |
|--------|------|---------|------|
| SEC-C3 | Auth レート制限がインメモリMap（サーバーレス無効） | **改善済** | Supabase RPC `check_rate_limit` による分散レート制限に移行。ただし**fail-open残存**（後述SEC-H8） |
| SEC-H4 | Weekly Summary メールのHTML Injection | **改善済** | `escapeHtml()` が `buildEmailHtml` 内で `name`, `tier` に適用（L147-148）。Subject行にも適用済み（L115） |
| SEC-H5 | Cron認証の脆弱性（CRON_SECRET未設定時fail-open） | **改善済** | `!cronSecret` 時に HTTP 500 を返す fail-closed に変更（L14-17）。`RESEND_API_KEY` 未設定時もガード済み |
| SEC-H6 | setRankGoal のIDOR | **改善済** | `setRankGoal` と `clearRankGoal` の両方で `getUser()` + 所有権チェック（`account.user_id !== user.id`）を実装（L36-42, L86-91） |
| SEC-H7 | Turnstile検証のFail-Open | **改善済** | `TURNSTILE_SECRET_KEY` 未設定時 `return false`（fail-closed）。fetch失敗時も `return false`（fail-closed） |
| SEC-M6 | Weekly Summary CronのN+1クエリ | **改善済** | `listUsers()` バッチ取得+Map lookupに置換（L82-99）。match/video_analysesもバッチ化 |
| SEC-M7 | Guest Analysis のゲスト検出が脆弱 | **改善** | `isGuestUser()` が `getUser()` ベースに統一。ゲストクレジットはIP+RPC原子操作 |
| SEC-M8 | Vision Analysis のtimeOffset計算 | **部分改善** | `initialGameTime` ベースの計算に統一。根本解決（クライアントからのタイムスタンプ送信）は未実装だがリスクは低い |
| SEC-M9 | CSP style-src unsafe-inline残存 | **改善済** | `style-src` に nonce ベース、`style-src-attr` に `unsafe-inline`（React/Framer Motion用）。CSP3 split directives対応。妥当な構成 |

## マネタイゼーション改善サマリー

| 前回ID | 内容 | 改善状況 | 詳細 |
|--------|------|---------|------|
| MON-C5 | ゲスト分析後のアップグレードCTA配置が弱い | **改善済** | MacroResultSection L89-110: サマリー直後にインラインCTA。L308-329: ページ末尾にもCTA。MicroResultSection L152-173, L422-444も同様。計4箇所のCTA配置 |
| MON-C6 | Premium→Extraのアップセル導線がゼロ | **改善済** | PremiumPromoCard L27: `showExtraUpsell` — 使用率90%以上でExtra誘導表示。pricing/page.tsx L575-589: PremiumユーザーもExtraボタン活性化 |
| MON-H10 | フリーミアム月3回の心理的デッドゾーン | **改善済（要調整）** | `FREE_WEEKLY_ANALYSIS_LIMIT = 1` — 週1回に変更。方向は正しいが制限が厳しすぎるリスクあり（後述MON-C8） |
| MON-H11 | Cancel flowの解約阻止力不足 | **大幅改善** | 2段階フロー実装。利用実績サマリー+「失うもの」リスト+pause提案。ただし**Pause APIバグ**あり（後述MON-C7） |
| MON-H12 | 価格ページにFAQセクションがない | **改善済** | pricing/page.tsx L663-694: FAQ 5問のアコーディオン実装。全3言語対応 |
| MON-H13 | リワード広告のスキップボタンがCVR低下要因 | **改善済** | スキップボタン完全削除。広告未ロード時は10秒タイムアウト後に完了ボタン表示 |
| MON-M13 | PremiumPromoCardがFreeユーザー向け特化 | **改善済** | L25-77: Premiumユーザーには使用量バー+Extra誘導、Freeには従来のCTA。2モード表示 |
| MON-M14 | Cron jobがPremium限定 | **未改善** | `.eq('is_premium', true)` のまま。Freeユーザー向けリエンゲージメントメール未実装 |
| MON-M15 | Dashboard HeaderにUpgradeボタンなし | **改善済** | DashboardContent L141-148: `!is_premium` 条件でUpgradeボタン表示。グラデーション付き |
| MON-M16 | LP OGタグの多言語対応不完全 | **改善済** | page.tsx L7-33: ja/en/ko全3言語のOG/Twitter情報定義。cookieベースの出し分け |
| MON-M17 | formatPrice()がja-JP固定 | **改善済** | pricing.ts L29-37: `LOCALE_MAP` でja/en/ko→ja-JP/en-US/ko-KRマッピング。動的切替 |
| MON-M18 | Extraプランの差別化が弱い | **改善済** | AI Damage AnalysisをExtra限定機能として明示。50回/週 vs 20回/週の差別化明確 |

---

# 議論パート: Agent S × Agent M

## Agent S（セキュリティ）: 開会所感

前回82点からの改善状況を確認した。**前回のCRITICAL 1件（インメモリレート制限）を含め、HIGH 4件すべてが修正された**のは見事だ。特にTurnstileのfail-closed化とCron Secretのfail-closed化は「5分で直せるのに放置されがちな問題」の典型で、これを即座に潰したのは正しい判断。

分散レート制限への移行（Supabase RPC `check_rate_limit`）は構造的に正しいアプローチだが、**RPC呼び出し自体が失敗した場合のfail-open**が残っている。ここは「最後の1穴」だ。

新たに発見したerror.message直接露出（`guestAnalysis/micro.ts`, `rankGoal.ts`）は、前回修正したServer Actionのエラーコード標準化が**全箇所に適用されていない**ことを示している。体系的な棚卸しが必要。

## Agent M（マネタイゼーション）: 開会所感

前回74点からの改善確認。**前回のCRITICAL 2件（ゲストCTA配置、Premium→Extraアップセル）が両方とも完全に解消された**のは大きな進歩だ。Cancel Flowの2段階設計は業界ベストプラクティスそのものであり、これだけで+3点は付けたい。

しかし**致命的なバグを見つけた**。CancelConfirmModalのUIは`[1, 3, 6]`ヶ月のpauseを表示しているが、サーバーサイドのPause APIは`[1, 2, 3]`しか許可していない。6ヶ月pauseを選択すると400エラーで必ず失敗する。せっかくのChurn Prevention機能が壊れている。

もう1点。`FREE_WEEKLY_ANALYSIS_LIMIT = 1`（週1回）は制限が厳しすぎる。LoLは1日3-5試合プレイするゲームで、週1回の分析ではサービスの価値体感前にユーザーが離脱する。

## Agent S × Agent M: クロスドメイン議論

**Agent M**: セキュリティとマネタイゼーションの交差点を指摘する。SEC-H8のレート制限fail-openが悪用されると、Free/Guestユーザーがレート制限を回避して無制限にGemini APIを呼び出す可能性がある。これはAPI費用の暴走に直結する。

**Agent S**: 同意する。分散レート制限の`return false`（fail-open）は、セキュリティだけでなく**コスト管理の観点でも最優先で修正すべき**だ。1行の変更で済む。

**Agent M**: もう1つ。前回指摘したPause APIのバリデーション不整合（SEC-H9/MON-C7）は、両エージェントが独立して発見した。UIが6ヶ月を提示しているのにサーバーが拒否するのは、ユーザー信頼を**完全に破壊**する。Cancel Flowの設計がどれだけ優れていても、このバグ1つで台無しだ。

**Agent S**: error.message直接露出の問題はセキュリティ面だけでなく、ユーザー体験にも影響する。「Cannot read properties of undefined」のようなエラーが表示されれば、ユーザーはサービスの品質を疑う。**サーバーエラーコード標準化の未完了箇所を体系的に洗い出す**必要がある。

**Agent M**: 今回最も評価したいのは**PremiumPromoCardの2モード表示**だ。Freeユーザーにはアップグレードプロモ、Premiumユーザーには使用量バー+Extra誘導（90%超時のみ）。不要な時に押し付けない抑制の効いた設計で、これはユーザー離脱を防ぎつつ自然にアップセルする理想形に近い。

**Agent S**: セキュリティ面でもう1つ。`verifyMatchVideo`（vision.ts L747）が`geminiRetry()`を使用していない。他のGemini呼び出しは統一されたのに、この1箇所だけ取り残されている。統一漏れはバグの温床になる。

---

# Part 1: セキュリティ審査（第5回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 第3回（v2） | 第4回 | 今回（第5回） | 改善後見込み |
|------|-------------------|-------------------|-------------|-------|-------------|------------|
| スコア | 48/100 | 72/100 | 78/100 | 82/100 | **87/100** | **93/100** |
| CRITICAL件数 | 4件 | 2件 | 2件 | 1件 | **0件** | 0件 |
| HIGH件数 | 6件 | 3件 | 3件 | 4件 | **3件** | 0件 |

**Agent S**: +5点の改善。前回のCRITICAL/HIGH 5件がすべて修正済み。**CRITICAL 0件は初**。残るHIGHは3件だがいずれも軽微な工数で対応可能。

---

## 致命的な問題（CRITICAL）

**なし** — 第5回にして初のCRITICAL 0件を達成。

---

## 重大な問題（HIGH）

### SEC-H8: isRateLimited() のFail-Open（分散レート制限バイパス可能）

**該当ファイル**: `src/middleware.ts` L22, L24-26

```typescript
if (!res.ok) return false  // ← DB RPCがエラーでもレート制限を無効化
// ...
} catch {
  return false // fail-open: don't block users on DB error
}
```

Supabaseが一時的にダウン、またはRPCがエラーを返した場合（`!res.ok`）、`return false`でレート制限が完全にバイパスされる。攻撃者がDB負荷をかけてRPC応答をエラーにすれば、ブルートフォースが可能になる。

**Agent S**: 分散レート制限への移行自体は正しかったが、**最後の1行**を直していない。

**改善案（工数: 5分）**: `catch` ブロックと `!res.ok` で `return true`（fail-closed）にする。

**深刻度**: HIGH
**緊急度**: HIGH

---

### SEC-H9: Pause API の months パラメータ不整合

**該当ファイル**:
- `src/app/api/subscription/pause/route.ts` L9-12
- `src/app/components/subscription/CancelConfirmModal.tsx` L191

```typescript
// route.ts: サーバー側は [1, 2, 3] を許可
const ALLOWED_MONTHS = [1, 2, 3] as const;

// CancelConfirmModal.tsx: UIは [1, 3, 6] を表示
{[1, 3, 6].map((months) => (
```

UIが6ヶ月pauseを提示しているがサーバーが拒否する。機能バグだが、ユーザー信頼を損なう。バリデーション自体は正常に機能（Zodでリジェクト）。

**改善案（工数: 15分）**: UIとサーバーの許可値を`[1, 3, 6]`に統一。

**深刻度**: HIGH
**緊急度**: HIGH

---

### SEC-H10: guestAnalysis/micro.ts のエラーメッセージ直接露出

**該当ファイル**: `src/app/actions/guestAnalysis/micro.ts` L369-376

```typescript
} catch (error: any) {
    return {
        success: false,
        error: error.message,  // ← 内部エラーメッセージが直接クライアントに露出
    };
}
```

`error.message` がそのままクライアントに返される。DB接続エラー、Gemini APIエラー等が漏洩する可能性。同様の問題が `rankGoal.ts` L69（`error: error.message`）にもある。

前回修正したServer Actionのエラーコード標準化が全箇所に適用されていない。

**改善案（工数: 30分）**: エラーコード定数を返し、`error.message`はloggerにのみ出力。

**深刻度**: HIGH
**緊急度**: MEDIUM

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 工数 |
|----|------|--------|------|
| SEC-M10 | `setRankGoal` のDB error.message漏洩（L69） | エラーコード `DB_ERROR` を返す | 5分 |
| SEC-M11 | `getRankGoal` に認証チェックなし — RLS頼りだがdefense-in-depth不足 | `getUser()` チェック追加 | 10分 |
| SEC-M12 | `verifyMatchVideo`（vision.ts L747）に `geminiRetry()` 未使用 — 手動ループのまま | `geminiRetry()` に統一 | 15分 |
| SEC-M13 | CSP `connect-src` に pagead2 / challenges.cloudflare.com 不足 | `connect-src` にAdSense, Turnstileドメイン追加 | 10分 |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| SEC-L9 | Chat API（`/api/chat/route.ts`）で`geminiRetry()`未使用 — 手動のfor-of model fallback |
| SEC-L10 | CancelConfirmModal の handlePause にCSRF保護なし（SameSite=Laxのcookie依存）|
| SEC-L11 | login.tsx のクライアントサイドレート制限がページリロードでリセット（`failCountRef`）|
| SEC-L12 | signup.tsx の `referral_code` が localStorage に無期限保存（CookieStuffingリスク）|
| SEC-L13 | vision.ts L646 のDB errorカラムに内部エラーメッセージが保存（フロントに返される場合漏洩）|

---

## セキュリティの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **Supabase RPC による分散レート制限** | インメモリMapからRPCへの完全移行。`check_rate_limit` + `SECURITY DEFINER` の構成は正しい |
| 2 | **Turnstile のFail-Closed化** | `return false` でfail-closed。コメントに意図を明記しており保守性が高い |
| 3 | **Cron Secret のFail-Closed化** | 環境変数未設定時にHTTP 500で拒否。defensive codingの手本 |
| 4 | **RankGoal のIDOR修正** | `getUser()` + 所有権検証を `setRankGoal` / `clearRankGoal` 両方に適用 |
| 5 | **Weekly Summary のN+1解消** | `listUsers()` バッチ取得 + Map lookup。match/video_analysesもバッチ化 |
| 6 | **escapeHtml のメール全面適用** | Weekly Summary と Trial Reminder の両方で全ユーザー入力フィールドに適用 |
| 7 | **OAuth Callback のOpen Redirect対策** | `next` パラメータの正規表現バリデーション + `x-forwarded-host` ホワイトリスト |
| 8 | **Checkout の Price ID ホワイトリスト** | `allowedPriceIds` + Zod バリデーション + 5分バケット冪等性キー |
| 9 | **geminiRetry() 統一** | vision.ts, guestAnalysis/micro.ts が移行完了。指数バックオフ+ジッター |
| 10 | **Error Code 標準化** | `t('serverErrors.CODE', fallback)` パターンがVideoMacroProvider, analyze/page.tsx で適用 |
| 11 | **入力バリデーションの Zod 統一** | `validation.ts` に共通スキーマ集約。checkout, chat, vision で適用 |
| 12 | **CSP Nonce ベース化** | `crypto.randomUUID()` per-request nonce + `strict-dynamic` + CSP3 split directives |
| 13 | **セキュリティヘッダー包括設定** | HSTS (2年, includeSubDomains, preload)、X-Frame-Options DENY、nosniff |
| 14 | **DEBIT-FIRSTパターン完全化** | `analyzeMatch`, `analyzeMatchTimeline`, `startVisionAnalysis` で統一実装 |

---

## Agent S 総評

48→72→78→82→**87** は堅実な改善トレンドを維持している。**CRITICAL 0件を初めて達成**したのは大きなマイルストーンだ。

前回のCRITICAL/HIGH 5件がすべて修正済みという結果は、指摘事項を確実に消化する実行力を示している。特にTurnstile fail-closed化、Cron Secret fail-closed化、IDOR修正の3件は「言われてすぐ直した」のではなく「正しいパターンで直した」点が評価できる。

残るHIGH 3件:
1. **isRateLimited() fail-open** — 1行変更。最優先。
2. **Pause API months不整合** — 15分。UI/サーバー定数統一。
3. **error.message直接露出** — 30分。体系的な棚卸し。

合計50分以内の作業で90点に到達可能。93点には、verifyMatchVideoのgeminiRetry統一、getRankGoalの認証追加、CSP connect-src整備が必要。

**一言**: 壁に穴はなくなった。残るは目地の仕上げだけだ。

**スコア推移**: 48 → 72 → 78 → 82 → **87** → (改善後見込み: **93**)

---

# Part 2: マネタイゼーション審査（第5回）

## 総合評価

| 指標 | 第1回（2026-02-28） | 第2回（2026-03-01） | 第3回（v2） | 第4回 | 今回（第5回） | 改善後見込み |
|------|-------------------|-------------------|-------------|-------|-------------|------------|
| スコア | 32/100 | 55/100 | 72/100 | 74/100 | **80/100** | **88/100** |
| 推定月間収益（MAU 500） | ~¥5,000 | ~¥15,000 | ~¥32,000 | ~¥35,000 | ~¥42,000 | ~¥55,000 |
| 推定CVR | ~1% | ~3% | ~5.5% | ~6% | ~7.5% | ~10% |

**Agent M**: +6点の大幅改善。前回CRITICALの2件が完全解消。Cancel Flow、FAQ、リワード広告、Extra差別化と、指摘事項を網羅的に消化。ただし**致命的バグ発見**（Pause API不整合）。

---

## 致命的な問題（CRITICAL）

### MON-C7: Pause APIとUIの不整合 — 6ヶ月pauseが必ず失敗する

**該当ファイル**:
- `src/app/components/subscription/CancelConfirmModal.tsx` L191
- `src/app/api/subscription/pause/route.ts` L9-12

```typescript
// CancelConfirmModal: UIは [1, 3, 6] を表示
{[1, 3, 6].map((months) => (

// route.ts: サーバーは [1, 2, 3] のみ許可
const ALLOWED_MONTHS = [1, 2, 3] as const;
const pauseRequestSchema = z.object({
  months: z.number().int().refine((v): v is 1 | 2 | 3 => ([1, 2, 3] as number[]).includes(v))
});
```

ユーザーが「6ヶ月pause」を選択すると400エラーが必ず返る。Cancel Flowの最重要機能が壊れている。

**推定インパクト**: 解約阻止率 -15%

**深刻度**: CRITICAL
**緊急度**: CRITICAL（即時修正）

---

### MON-C8: Freeプラン週1回制限 — リテンション崩壊リスク

**該当ファイル**: `src/app/actions/constants.ts` L5

```typescript
export const FREE_WEEKLY_ANALYSIS_LIMIT = 1;  // Free users: 1 analysis per week
```

月3回→週1回に変更したのは方向として正しいが、**制限が厳しすぎる**。LoLは1日3-5試合プレイするゲームで、週1回の分析ではサービスの価値体感前にユーザーが離脱する。

業界標準の「フリーミアムの黄金比」は「十分に価値を感じるが、もっと欲しくなる量」。Free(週1回) → Premium(週20回)の**20倍のギャップ**は価格正当化が困難。

**改善案**: `FREE_WEEKLY_ANALYSIS_LIMIT = 3`。週3→20（Premium）のステップは約7倍で心理的許容範囲。

**推定インパクト**: Free→Premium CVR +2-3%

**深刻度**: CRITICAL
**緊急度**: HIGH

---

## 重大な問題（HIGH）

### MON-H14: Referral報酬の非対称性 — 被紹介者にインセンティブがない

**該当ファイル**: `src/app/components/subscription/ReferralCard.tsx` L47

```tsx
{t("referral.description", "When your friend signs up and subscribes to Premium, your subscription is extended by 1 week.")}
```

紹介者には「サブスク1週間延長」の報酬があるが、被紹介者には何の特典もない。B2Cリファラルの成功には「双方向インセンティブ」が必須。

**改善案**: 紹介リンク経由のサインアップ者にPremiumトライアル期間を14日間に延長（通常7日→14日）。

**推定インパクト**: リファラルCVR +30-50%

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### MON-H15: ReferralCardの表示条件が甘い — 全ログインユーザーに表示

**該当ファイル**: `src/app/dashboard/components/DashboardContent.tsx` L168-169

ReferralCardは `referral_code` を持つ全ユーザーに無条件で表示。Freeユーザーが「使ったことないサービスを友達に勧める」のは不自然。Premiumユーザーのみに表示すべき。

**改善案**: `ReferralCard` にstatusを渡して `is_premium` の場合のみ表示。

**推定インパクト**: ダッシュボードCTA最適化で Free→Premium CVR +1%

**深刻度**: HIGH
**緊急度**: LOW

---

### MON-H16: 年間プランの価格アンカリングが弱い

**該当ファイル**: `src/app/pricing/page.tsx` L227-245

billingトグルのデフォルトが `monthly`。年間プランの割引率がファーストビューに見えない。SaaS業界では年間プランを**デフォルト表示**にするのがベストプラクティス。

**改善案**:
1. `setBilling` のデフォルトを `'annual'` に変更
2. 月額カードに「年間なら34%OFF」ラベルを常時表示
3. 年間プランカードに「Most Popular」バッジ追加

**推定インパクト**: 年間プラン選択率 +15%、ARPU +20%

**深刻度**: HIGH
**緊急度**: MEDIUM

---

### MON-H17: 分析結果後のFreeユーザー向けアップセルCTAが不在

**該当ファイル**:
- `src/app/analyze/components/MacroResultSection.tsx` L308
- `src/app/analyze/components/MicroResultSection.tsx` L423

```tsx
{isGuest && (  // ← Freeユーザーにはアップセルが表示されない
```

ゲストのみにCTA表示。ログイン済みFreeユーザーが分析結果を見た後にはアップセルCTAが一切ない。

**改善案**: `isGuest` を `isGuest || !creditInfo?.isPremium` に拡張。

**推定インパクト**: Free→Premium CVR +1.5%

**深刻度**: HIGH
**緊急度**: MEDIUM

---

## 中程度の問題（MEDIUM）

| ID | 問題 | 改善案 | 推定インパクト |
|----|------|--------|---------------|
| MON-M19 | Cron（weekly-summary）がPremium限定。Freeユーザーへのリエンゲージメントメールなし | 週次リセット通知+「Premiumなら20回分析」CTAメール | リテンション +5%、CVR +0.5% |
| MON-M20 | PremiumPromoCard L85に日本語フォールバック残存: `'AI分析 (今週)'` | 英語 `'AI Analysis (This Week)'` に統一 | UX一貫性 |
| MON-M21 | Upgrade Modal出現条件が結果表示後のみ。制限到達時点で即表示すべき | `canAnalyze === false` 時点でmodal表示 | CVR +0.5% |
| MON-M22 | pricing/page.tsx のCTA bottomセクションでPremium/Extraが同一翻訳キー共有 | PremiumユーザーにはExtra誘導CTAに変更 | Premium→Extra CVR +1% |
| MON-M23 | オンボーディング後のプラン紹介ステップなし | ウェルカムモーダル（「7日間無料トライアル」CTA） | 新規→トライアル率 +5% |
| MON-M24 | `alternates.languages` が全言語で同一URL — hreflang設定の意味が薄い | 言語別URLルーティング or alternates削除 | SEO改善 |

---

## 低リスクの問題（LOW）

| ID | 問題 |
|----|------|
| MON-L13 | pricing/page.tsx のFAQが5問のみ。「AI分析の精度は?」「データは安全か?」等が不足 |
| MON-L14 | loginPage.tooManyAttempts のフォールバックに日本語残存 |
| MON-L15 | ReferralCard のコピーボタンで絵文字 `✓` をフォールバックに使用 |
| MON-L16 | CancelConfirmModal の「失うもの」リストが4項目固定。Extraユーザー向け追加項目なし |
| MON-L17 | Pricing ページのExtra カードの `border-2` + `BEST`バッジが二重強調 |

---

## マネタイゼーションの良い点（新規評価含む）

| # | 実装 | 評価 |
|---|------|------|
| 1 | **Cancel Flowの2段階設計** | 理由選択→pause提案のフロー。「失うもの」リストの赤い警告、「Keep Subscription」をprimary（青）で維持誘導。業界ベストプラクティス |
| 2 | **ゲスト分析のブラー+CTA戦略** | 最初のセグメント完全表示→残りブラー化。エンダウメント効果の心理的活用が優秀 |
| 3 | **PremiumPromoCardの2モード表示** | Free向けアップグレードCTA / Premium向けExtra誘導（90%超時）。押し付けない抑制の効いた設計 |
| 4 | **動的価格取得** | `getStripePrices()` でStripeから直接取得+フォールバック。運用コスト最小化 |
| 5 | **Google OAuth + Email 2系統認証** | 認証障壁低減。Googleボタンを最上位配置は正しい優先順位 |
| 6 | **FAQ 5問のアコーディオン** | 3言語対応。CVR改善の基本施策を実装 |
| 7 | **Feature Comparison Table** | 4プラン横並び比較。AIダメージ分析のExtra限定が視覚的に明確 |
| 8 | **リワード広告のスキップ廃止** | 完全視聴を促す設計。タイムアウトフォールバックも適切 |
| 9 | **年間プラン** | Premium 34%OFF、Extra 50%OFF。LTV最大化の基盤 |
| 10 | **Stripe Idempotencyキー** | Checkout二重クーポン作成防止。プロレーション精度向上 |

---

## Agent M 総評

32→55→72→74→**80**。+6点の改善は今回が最大幅。前回のCRITICAL 2件（ゲストCTA、Extra誘導）の完全解消に加え、Cancel Flow、FAQ、リワード広告改善、Extra差別化と、指摘事項を網羅的に消化した実行力は高く評価する。

Cancel Flowの2段階設計は特に秀逸。ただし**Pause APIバグ（6ヶ月が必ず失敗）が全てを台無しにしている**。即時修正が必須。

Freeプランの週1回制限は議論の余地があるが、MAU 500規模では**新規獲得コスト > リテンション**のため、週3回に緩和してA/Bテストを推奨。

**一言**: レストランの内装もウェイターの動線も整った。あとは「おすすめメニュー」の書き方を間違えている1箇所を直せば、予約が倍増する。

**スコア推移**: 32 → 55 → 72 → 74 → **80** → (改善後見込み: **88**)

---

# Part 3: 両エージェント共同議論 — 統合改善ロードマップ

## 最優先修正（30分以内 — 即日対応）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 1 | **SEC/MON** | Pause API `ALLOWED_MONTHS` を `[1, 3, 6]` に統一 | 15分 | Cancel Flow修復 |
| 2 | **SEC** | middleware.ts `isRateLimited()` を fail-closed に変更 | 5分 | ブルートフォース防止 |
| 3 | **SEC** | guestAnalysis/micro.ts, rankGoal.ts の `error.message` 直接露出を排除 | 30分 | 情報漏洩防止 |

## Phase 1: 即時対応（1-2日）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 4 | **MON** | `FREE_WEEKLY_ANALYSIS_LIMIT` を 1→3 に変更 | 5分 | リテンション改善 |
| 5 | **SEC** | getRankGoal に認証チェック追加 | 10分 | defense-in-depth |
| 6 | **SEC** | verifyMatchVideo に geminiRetry() 適用 | 15分 | リトライ統一 |
| 7 | **MON** | 年間プランをデフォルト表示に変更 | 10分 | ARPU +20% |

## Phase 2: 短期施策（3-5日）

| # | 領域 | 施策 | 工数 | 推定増収 |
|---|------|------|------|---------|
| 8 | **MON** | Referral双方向インセンティブ（被紹介者にトライアル14日延長） | 2h | リファラルCVR +30-50% |
| 9 | **MON** | ReferralCardをPremiumユーザーのみ表示 | 30m | ダッシュボードCTA最適化 |
| 10 | **MON** | 分析結果CTAを `isGuest || !isPremium` に拡張 | 1h | Free→Premium CVR +1.5% |
| 11 | **MON** | オンボーディング後ウェルカムモーダル追加 | 2h | トライアル開始率 +5% |
| 12 | **SEC** | CSP connect-src にAdSense/Turnstileドメイン追加 | 10m | CSP完全化 |

## Phase 3: 中期施策（1-2週間）

| # | 領域 | 施策 | 工数 | インパクト |
|---|------|------|------|----------|
| 13 | **MON** | Freeユーザー向け週次リエンゲージメントメール | 3h | リテンション +5% |
| 14 | **MON** | PricingページFAQを8-10問に拡張 | 1h | CVR +5% |
| 15 | **MON** | pricing CTA bottomをプラン別に分岐 | 1h | Premium→Extra CVR +1% |
| 16 | **SEC** | Chat API に geminiRetry() 適用 | 15m | リトライ完全統一 |

---

## 最終評点

### セキュリティ: 87/100（前回82 → +5）

**Agent S**:

48→72→78→82→**87**と着実にスコアを伸ばし、**CRITICAL 0件を初達成**。前回のCRITICAL/HIGH 5件がすべて修正済みという結果は、問題を「正しいパターンで」確実に解決する実行力を証明している。

残るHIGH 3件（isRateLimited fail-open、Pause API不整合、error.message露出）は合計50分で対応可能。これらを解消すれば**90+**に到達する。93点には、MEDIUM 4件の解消が追加で必要。

**スコア推移**: 48 → 72 → 78 → 82 → **87** → (改善後見込み: **93**)

---

### マネタイゼーション: 80/100（前回74 → +6）

**Agent M**:

32→55→72→74→**80**。+6点は今回の最大改善幅。前回のCRITICAL 2件を含む指摘事項の大半を解消し、Cancel Flow、FAQ、Extra差別化など「仕組みの完成度」が大幅に向上した。

ただしPause APIバグとFreeプラン制限の厳しさが新たなCRITICALとして浮上。技術的には軽微な修正で対応可能であり、これらを解消すれば**84-85点**、Phase 2の施策を含めれば**88点**に到達可能。

**スコア推移**: 32 → 55 → 72 → 74 → **80** → (改善後見込み: **88**)

---

## 総合スコア: 83.5/100（前回78 → +5.5）

| 領域 | 第1回 | 第2回 | 第3回 | 第4回 | 第5回 | 改善後見込み |
|------|-------|-------|-------|-------|-------|------------|
| セキュリティ | 48 | 72 | 78 | 82 | **87** | 93 |
| マネタイゼーション | 32 | 55 | 72 | 74 | **80** | 88 |
| **総合** | **40** | **63.5** | **75** | **78** | **83.5** | **90.5** |

---

*審査完了: 2026-03-02 00:32*
*次回審査推奨: Phase 1-2 完了後（1週間後）*
