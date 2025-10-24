# LoL Coach AI 🎮🤖

League of Legends の試合データを AI が自動分析してコーチングアドバイスを生成する Web アプリケーション。

---

## 🌟 概要

LoL Coach AI は Riot API を通じてプレイヤーの最新対戦データを取得し、  
OpenAI API を用いて「改善点」「練習タスク」「勝率アップのためのアドバイス」を生成します。

---

## 🧠 使用技術

- Next.js 14（App Router）
- TypeScript
- Tailwind CSS
- Riot API (summoner-v4 / match-v5)
- OpenAI API (gpt-4o-mini)
- pnpm

---

## 🧩 機能

- サモナーネーム入力による対戦データ取得（モックデータ対応）
- ロール選択によるロール別アドバイス生成
- AI出力を見やすくセクション分け表示
- 403/401エラーハンドリング

---

## ⚙️ セットアップ

```bash
# 依存関係インストール
pnpm install

# 開発環境起動
pnpm run dev

# 環境変数 (.env.local)
RIOT_API_KEY=your_riot_api_key
OPENAI_API_KEY=your_openai_api_key