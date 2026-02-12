# サーバー移行手順書

LoLCoachAI を現在のサーバーから別のサーバー（VPS / コンテナサービス）へ移行する際の手順。

---

## 前提条件

- Next.js 16 + `output: "standalone"` 構成
- Supabase（外部ホスティング、サーバー移行の影響なし）
- Stripe Webhook（URL変更が必要）
- Riot API（コールバックURLにドメインを使用）

## 事前準備（移行の1週間前）

### 1. DNSのTTLを短縮

```
現在のDNS設定でTTLを 60〜300秒 に変更
```

- 通常TTLは3600秒（1時間）以上に設定されている
- 短縮することでDNS切り替え後の反映を早める
- 変更後、元のTTL時間だけ待ってから移行を実施する

### 2. 環境変数の確認

`.env.local` に含まれる全変数のリスト（バックアップと照合）:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Riot API
RIOT_API_KEY=
RIOT_RSO_CLIENT_ID=
RIOT_RSO_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Google AI
GEMINI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=

# OpenAI (if used)
OPENAI_API_KEY=
```

> 実際の値は安全な場所（1Password等）にバックアップ済みであること

---

## 移行手順

### Step 1: 新サーバーの環境構築

#### VPS（Lightsail / EC2 / その他）の場合

```bash
# Node.js 22 インストール
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git インストール（未導入の場合）
sudo apt-get install -y git

# pm2 インストール（プロセス管理）
sudo npm install -g pm2
```

#### コンテナサービス（Fly.io / Cloud Run）の場合

Dockerfile が同梱されているため、追加の環境構築は不要。

### Step 2: アプリケーションのデプロイ

#### VPSの場合

```bash
# リポジトリのクローン
git clone <repository-url> /var/www/lolcoachai
cd /var/www/lolcoachai

# 依存関係インストール
npm ci

# 環境変数を配置
# .env.local をバックアップから復元

# NEXT_PUBLIC_APP_URL を新ドメイン/IPに更新
# （ドメインが同じなら変更不要）

# ビルド
npm run build

# standalone で起動
cd .next/standalone
cp -r ../../public ./public
cp -r ../../.next/static ./.next/static
node server.js
# → http://0.0.0.0:3000 で起動

# pm2 でデーモン化
pm2 start server.js --name lolcoachai
pm2 save
pm2 startup  # OS再起動時の自動起動設定
```

#### Fly.ioの場合

```bash
fly launch
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... (各環境変数)
fly deploy
```

#### Docker（汎用）の場合

```bash
docker build -t lolcoachai .
docker run -d -p 3000:3000 \
  --env-file .env.local \
  --name lolcoachai \
  lolcoachai
```

### Step 3: SSL証明書の設定（VPSのみ）

```bash
# Nginx インストール
sudo apt-get install -y nginx

# Let's Encrypt (certbot)
sudo apt-get install -y certbot python3-certbot-nginx

# 証明書取得（ドメインのDNSが新サーバーを向いている必要あり）
# ※ DNS切り替え前は --standalone モードで取得可能
sudo certbot --nginx -d yourdomain.com
```

Nginx設定例（`/etc/nginx/sites-available/lolcoachai`）:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 100MB upload limit (video analysis)
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;  # 長時間リクエスト対応
    }
}
```

### Step 4: 動作確認（DNS切り替え前）

新サーバーのIP直接アクセスまたは `/etc/hosts` で確認:

```bash
# ローカルPCの /etc/hosts に追加（確認後に削除）
<新サーバーIP>  yourdomain.com
```

確認項目:

- [ ] トップページが表示される
- [ ] ログイン/サインアップが動作する
- [ ] マッチ検索・詳細表示が動作する
- [ ] 動画分析（ゲスト・プレミアム）が動作する
- [ ] Stripe決済ページが開ける
- [ ] SSL証明書が有効（`https://` でアクセス可能）

### Step 5: DNS切り替え

```
ドメインのAレコードを新サーバーのIPアドレスに変更
```

- TTLを事前に短縮済みなら、数分〜数十分で反映
- 旧サーバーは **最低48時間** は並行稼働させる（DNS伝播完了まで）

### Step 6: 外部サービスの設定更新

#### Stripe Webhook（ドメイン変更時のみ）

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) にアクセス
2. Webhook エンドポイントURLを新ドメインに更新
3. `STRIPE_WEBHOOK_SECRET` が変わる場合は `.env.local` も更新

#### Riot API（ドメイン変更時のみ）

1. [Riot Developer Portal](https://developer.riotgames.com/) にアクセス
2. アプリケーションのCallback URLを更新
3. 必要に応じてドメインの再認証

#### Supabase

1. [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → URL Configuration
2. Site URL を新ドメインに更新
3. Redirect URLs に新ドメインを追加（旧ドメインも一時的に残す）

### Step 7: 旧サーバーの停止

DNS完全伝播後（48時間以降）:

1. 旧サーバーのアクセスログを確認（アクセスが0になっていること）
2. 旧サーバーのアプリケーションを停止
3. 旧サーバーの環境変数（`.env.local`）を削除
4. 必要に応じて旧サーバーを解約

---

## トラブルシューティング

### ビルドエラー

```bash
# node_modules を削除して再インストール
rm -rf node_modules .next
npm ci
npm run build
```

### ポート3000が使用中

```bash
# 使用中のプロセスを確認
lsof -i :3000
# または別ポートで起動
PORT=3001 node server.js
```

### SSL証明書の取得失敗

- DNSがまだ旧サーバーを向いている場合は `--standalone` モードを使用
- ポート80/443が開放されているか確認: `sudo ufw allow 80 && sudo ufw allow 443`

### Supabase接続エラー

- Supabase側のNetwork Restrictions（IP制限）を確認
- 新サーバーのIPが許可されているか確認

---

## 移行チェックリスト

| # | 項目 | 完了 |
|---|------|------|
| 1 | .env.local バックアップ確認 | |
| 2 | DNS TTL短縮（1週間前） | |
| 3 | 新サーバー環境構築 | |
| 4 | アプリケーションデプロイ | |
| 5 | SSL証明書設定 | |
| 6 | 動作確認（IP直接 or hosts） | |
| 7 | DNS切り替え | |
| 8 | Stripe Webhook URL更新 | |
| 9 | Riot API Callback URL更新 | |
| 10 | Supabase URL設定更新 | |
| 11 | 旧サーバーで48時間並行稼働 | |
| 12 | 旧サーバー停止・解約 | |
