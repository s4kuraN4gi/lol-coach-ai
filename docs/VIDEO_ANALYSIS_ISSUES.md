# 動画解析機能 - 問題点と対応状況まとめ

最終更新: 2026-02-04

## 概要
MACRO動画解析の非同期バックグラウンド処理実装中に発見された問題点と、その対応状況をまとめたドキュメントです。

---

## 1. 解決済みの問題

### 1.1 MACRO分析結果が復元されない問題
**症状**: ページ遷移後にMACRO分析結果が復元されない

**原因**:
- `video_analyses`テーブルに`analysis_type`カラムが存在しなかった
- DB挿入時に`analysis_type: "macro"`を設定していなかった

**対応**:
- マイグレーション追加: `supabase/migrations/20260203000002_add_analysis_type.sql`
- `videoMacroAnalysis.ts`の`startVideoMacroAnalysis`関数でinsert時に`analysis_type: "macro"`を追加
- `vision.ts`にも同様に`analysis_type: "micro"`を追加

**関連ファイル**:
- `src/app/actions/videoMacroAnalysis.ts` (1213行目)
- `src/app/actions/vision.ts`
- `src/app/actions/analysis.ts` (`getLatestMicroAnalysisForMatch`関数追加)

---

### 1.2 無限ループ問題 (PremiumPromoCard)
**症状**: `Setting Status AutoRenew to: true`がコンソールに繰り返し出力される

**原因**:
- `useEffect`の依存配列に`initialStatus`全体を含めていたため、syncSubscriptionStatus後の状態更新で再度effectが発火

**対応**:
- `useRef(false)`フラグを使用して、sync処理が一度だけ実行されるように修正

**関連ファイル**:
- `src/app/Components/subscription/PremiumPromoCard.tsx` (19行目, 27-43行目)

```typescript
const hasSynced = useRef(false);

useEffect(() => {
    if (hasSynced.current) return;
    if (!initialStatus?.is_premium) return;

    hasSynced.current = true;
    syncSubscriptionStatus().then(...);
}, [initialStatus?.is_premium]);
```

---

### 1.3 無限ループ問題 (restoreResultForMatch)
**症状**: 結果復元関数が繰り返し呼び出される

**原因**:
- `useCallback`の依存配列に状態変数(`asyncStatus`, `result`, `matchId`)を含めていた
- 関数呼び出し時にこれらの状態が更新され、関数参照が変わり、useEffectが再発火

**対応**:
- `useCallback`の依存配列を空配列`[]`に変更
- useEffect側でも関数を依存配列から除外（eslint-disableコメント付き）

**関連ファイル**:
- `src/app/Providers/VideoMacroAnalysisProvider.tsx` (`restoreResultForMatch`関数)
- `src/app/Providers/VisionAnalysisProvider.tsx` (`restoreResultForMatch`関数)
- `src/app/dashboard/coach/page.tsx` (MICRO復元のuseEffect)
- `src/app/dashboard/components/Analysis/VideoMacroAnalysis.tsx` (MACRO復元のuseEffect)

---

### 1.4 Gemini APIモデル名エラー
**症状**: `gemini-2.0-flash-exp`モデルが見つからない (404エラー)

**原因**: モデル名が変更された

**対応**: `gemini-2.0-flash-exp` → `gemini-2.0-flash`に変更

**関連ファイル**:
- `src/app/actions/videoMacroAnalysis.ts` (127行目, 661行目, 1325行目)

---

### 1.5 Gemini API 429エラー (クォータ制限) - モデル変更で対応
**症状**: `429 Too Many Requests` / `Resource exhausted`エラーが継続

**原因**:
- Gemini無料トライアルのクォータ制限
- `gemini-2.0-flash`系モデルに既知のバグあり（リセットされない問題が報告されている）

**対応** (2026-02-04):
- 全ファイルでプライマリモデルを`gemini-2.0-flash` → `gemini-2.5-flash`に変更
- フォールバック順序も`gemini-2.5-flash`を最優先に変更

**変更したファイル**:
- `src/app/actions/videoMacroAnalysis.ts` - `gemini-2.5-flash`に変更
- `src/app/actions/analysis_timeline.ts` - `gemini-2.5-flash`に変更
- `src/app/actions/analysis.ts` - MODELS_TO_TRY配列の順序変更
- `src/app/actions/coach.ts` - MODELS_TO_TRY配列の順序変更
- `src/app/actions/vision.ts` - modelsToTry配列の順序変更
- `src/app/api/chat/route.ts` - MODELS_TO_TRY配列の順序変更

**参考情報**:
- [Google AI Developers Forum](https://discuss.ai.google.dev/t/gemini-api-returning-constant-429-errors-and-free-quota-is-not-resetting/111141): 2.0-flashで429エラーがリセットされないバグの報告
- 2.5-flashは問題なく動作するとの報告あり

---

## 2. 保留中の問題

（現在なし - モデル変更で429問題は解決見込み）

**遅延設定**（参考用、変更なし）:
```typescript
// detectGameTimeFromFrame内
maxRetries = 3
waitTime = Math.pow(2, attempt) * 2000  // 4s, 8s, 16s

// callGeminiWithRetry内 (analyzeVideoMacro, performVideoMacroAnalysisInBackground)
maxRetries = 3
waitTime = Math.pow(2, attempt) * 1000  // 2s, 4s, 8s

// セグメント間の遅延
delay(1500)  // 1.5秒
```

---

## 3. 未検証の機能

### 3.1 MACRO分析結果の復元
- DBスキーマとコードは修正済み
- クォータ制限のため実際のE2Eテストは未完了
- 再開時に以下をテスト:
  1. MACRO分析を実行
  2. 別ページに遷移
  3. 戻った時に結果が復元されるか確認

### 3.2 セグメント分析の完全性
- 一部セグメントでフレームが取得できない可能性あり
- 動画ファイルがページ遷移で保持されないため、セグメント情報が消える問題の調査が必要かもしれない

---

## 4. 関連ファイル一覧

| ファイル | 役割 |
|---------|------|
| `src/app/actions/videoMacroAnalysis.ts` | MACRO分析のサーバーアクション |
| `src/app/actions/vision.ts` | MICRO分析のサーバーアクション |
| `src/app/actions/analysis.ts` | 分析ステータス・結果取得 |
| `src/app/Providers/VideoMacroAnalysisProvider.tsx` | MACROのグローバル状態管理 |
| `src/app/Providers/VisionAnalysisProvider.tsx` | MICROのグローバル状態管理 |
| `src/app/dashboard/components/Analysis/VideoMacroAnalysis.tsx` | MACROのUIコンポーネント |
| `src/app/dashboard/coach/page.tsx` | コーチページ（両分析の親） |
| `src/app/Components/subscription/PremiumPromoCard.tsx` | プレミアム表示カード |
| `supabase/migrations/20260203000002_add_analysis_type.sql` | DBマイグレーション |

---

## 5. 再開時のチェックリスト

- [ ] Gemini APIのクォータ状況を確認
- [ ] DBマイグレーションが適用されているか確認 (`analysis_type`カラム)
- [ ] MACRO分析の実行テスト
- [ ] MACRO分析結果の復元テスト
- [ ] MICRO分析結果の復元テスト（進捗表示含む）
- [ ] 無限ループが発生しないことを確認
