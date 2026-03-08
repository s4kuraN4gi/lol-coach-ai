# LoL Coach AI

League of Legends の試合データとリプレイ動画を AI が解析し、パーソナライズされたコーチングを提供する Web アプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) / React 19
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS 4
- **データフェッチ**: SWR
- **認証**: Supabase Auth (Google OAuth / Riot Sign On)
- **データベース**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.0 Flash
- **決済**: Stripe (サブスクリプション)
- **デプロイ**: Docker (standalone)
- **パッケージマネージャ**: npm

## 主な機能

- **ダッシュボード**: 戦績サマリー、ランク推移、チャンピオンパフォーマンス
- **マッチ分析**: Riot API + Gemini AI による自動コーチング
- **動画分析 (マクロ/ミクロ)**: リプレイ動画の Canvas フレーム抽出 + Gemini Vision
- **ダメージ計算機**: CommunityDragon データに基づくスペルダメージ計算
- **チャンピオン/アイテムDB**: DDragon データによる公開リファレンス
- **AIチャット**: Gemini ベースのコーチングチャット
- **多言語対応**: 日本語 / English / 한국어

## セットアップ

```bash
# 依存関係インストール
npm install

# 開発環境起動
npm run dev
```

### 環境変数

`.env.example` を `.env.local` にコピーして値を設定してください。

```bash
cp .env.example .env.local
```

必要な環境変数:

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット |
| `RIOT_API_KEY` | Riot Games API key |

## プロジェクト構成

```
src/
  app/
    (legal)/          # 法的ページ (特定商取引法等)
    (public)/         # 公開ページ (チャンピオン/アイテムDB)
    account/          # アカウント管理
    actions/          # Server Actions
    analyze/          # ゲスト動画分析
    api/              # API Routes (webhooks, auth, chat)
    chat/             # AIチャット
    components/       # 共有UIコンポーネント
    dashboard/        # ダッシュボード (メイン機能)
    onboarding/       # オンボーディング
    providers/        # React Context Providers
  contexts/           # LanguageContext
  hooks/              # カスタムフック (SWR)
  locales/            # 翻訳ファイル (ja/en/ko)
  utils/              # ユーティリティ
supabase/
  migrations/         # PostgreSQL マイグレーション
```

## ライセンス

LoL Coach AI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
