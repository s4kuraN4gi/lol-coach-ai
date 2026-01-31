# Supabase CLI ガイド

このドキュメントでは、Supabase CLIの基本的な使い方とマイグレーション管理について説明します。

## 目次

- [インストール](#インストール)
- [初期セットアップ](#初期セットアップ)
- [マイグレーション管理](#マイグレーション管理)
- [よく使うコマンド一覧](#よく使うコマンド一覧)
- [ワークフロー例](#ワークフロー例)
- [トラブルシューティング](#トラブルシューティング)

---

## インストール

### npm経由（プロジェクトローカル）

```bash
npm install supabase --save-dev
```

### Homebrew経由（グローバル・macOS）

```bash
brew install supabase/tap/supabase
```

### バージョン確認

```bash
npx supabase --version
```

---

## 初期セットアップ

### 1. Supabaseにログイン

```bash
npx supabase login
```

ブラウザが開き、Supabaseアカウントで認証します。認証後、アクセストークンが保存されます。

### 2. プロジェクトの初期化

```bash
npx supabase init
```

これにより `supabase/config.toml` が作成されます。

### 3. リモートプロジェクトにリンク

```bash
npx supabase link --project-ref <project-ref>
```

**`<project-ref>` の取得方法:**
1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. プロジェクトを選択
3. **Settings** → **General** → **Reference ID** をコピー
   - または、ダッシュボードURLの `https://supabase.com/dashboard/project/<project-ref>` から取得

リンク時にデータベースパスワードを求められます。

---

## マイグレーション管理

### マイグレーションとは

データベースのスキーマ変更（テーブル作成、カラム追加、RLSポリシーなど）を履歴として管理する仕組みです。

### ファイルの場所

```
supabase/
└── migrations/
    ├── 20260131_rank_history.sql
    ├── 20260202_rank_history_update_policy.sql
    └── ...
```

### 主要コマンド

#### 新しいマイグレーションを作成

```bash
npx supabase migration new <migration_name>
```

例:
```bash
npx supabase migration new add_user_profile
# → supabase/migrations/20260202120000_add_user_profile.sql が作成される
```

#### ローカルマイグレーションをリモートに適用

```bash
npx supabase db push
```

`supabase/migrations/` 内の未適用マイグレーションをリモートDBに適用します。

#### リモートのスキーマをローカルに取得

```bash
npx supabase db pull
```

リモートDBの現在のスキーマをマイグレーションファイルとして取得します。

#### マイグレーション状態を確認

```bash
npx supabase migration list
```

どのマイグレーションが適用済みかを確認できます。

#### スキーマの差分を確認

```bash
npx supabase db diff
```

ローカルとリモートのスキーマの差分を表示します。

---

## よく使うコマンド一覧

| コマンド | 説明 |
|---------|------|
| `npx supabase login` | Supabaseにログイン |
| `npx supabase init` | プロジェクト初期化（config.toml作成） |
| `npx supabase link --project-ref <ref>` | リモートプロジェクトにリンク |
| `npx supabase db push` | マイグレーションをリモートに適用 |
| `npx supabase db pull` | リモートスキーマをローカルに取得 |
| `npx supabase migration new <name>` | 新しいマイグレーションファイル作成 |
| `npx supabase migration list` | マイグレーション状態確認 |
| `npx supabase db diff` | スキーマ差分確認 |
| `npx supabase db reset` | ローカルDBをリセット（ローカル開発時） |
| `npx supabase start` | ローカルSupabaseを起動 |
| `npx supabase stop` | ローカルSupabaseを停止 |
| `npx supabase status` | ローカルSupabaseの状態確認 |

---

## ワークフロー例

### 新しいテーブルを追加する場合

```bash
# 1. マイグレーションファイルを作成
npx supabase migration new create_notifications_table

# 2. 生成されたファイルにSQLを記述
# supabase/migrations/20260202XXXXXX_create_notifications_table.sql

# 3. リモートに適用
npx supabase db push
```

### 既存テーブルにRLSポリシーを追加する場合

```bash
# 1. マイグレーションファイルを作成
npx supabase migration new add_notifications_rls

# 2. SQLを記述
# CREATE POLICY "Users can read own notifications" ...

# 3. 適用
npx supabase db push
```

### Dashboardで変更した後、ローカルに同期する場合

```bash
# リモートの変更をマイグレーションとして取得
npx supabase db pull

# 差分確認
npx supabase db diff
```

---

## トラブルシューティング

### `supabase db push` が失敗する

**原因1: リンクされていない**
```bash
npx supabase link --project-ref <project-ref>
```

**原因2: マイグレーションにエラーがある**
- SQLの構文エラーを確認
- 既に存在するオブジェクトを作成しようとしていないか確認
- `IF NOT EXISTS` を使用することで回避可能

**原因3: 認証が切れている**
```bash
npx supabase login
```

### マイグレーションの順序問題

マイグレーションはファイル名の日付順に実行されます。依存関係がある場合は、日付を適切に設定してください。

```
20260201_create_users.sql      # 先に実行
20260202_create_posts.sql      # 後に実行（usersに依存）
```

### 本番環境での注意点

- **バックアップを取る**: 重要な変更前は必ずバックアップ
- **ステージング環境でテスト**: 本番適用前に別環境で検証
- **破壊的変更に注意**: `DROP TABLE` や `ALTER COLUMN` は慎重に

---

## 参考リンク

- [Supabase CLI 公式ドキュメント](https://supabase.com/docs/guides/cli)
- [マイグレーション管理](https://supabase.com/docs/guides/cli/managing-environments)
- [ローカル開発](https://supabase.com/docs/guides/cli/local-development)
