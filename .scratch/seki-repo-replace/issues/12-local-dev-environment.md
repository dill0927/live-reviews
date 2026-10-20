# ローカル開発環境

Type: grilling
Status: resolved
Blocked by: 06

## Question

ローカルでフロント・API・DB をどう動かすか（Supabase CLI のローカルスタック、Go の cmd/api、Docker の要否）と、マイグレーションツール（Supabase CLI のマイグレーション／golang-migrate／Atlas など）に何を使うかを決める。

## Answer

**手元の Mac の状況（2026-10-20 に確認）**：Docker Desktop（28.3）、Node.js（v24）、make はインストール済み。Go と Supabase CLI は未インストール。

**決定**
- **ローカルの DB と認証**：Supabase CLI のローカル環境（`supabase start` で Docker の中に Postgres、Auth、Studio を立ち上げる）を使う。クラウドの本番 Supabase には、ローカルからつながない。本番は 1 環境だけなので、自由に壊してよい場所はローカルにしかないため。
- **マイグレーション**：Supabase CLI のマイグレーション（`supabase/migrations/*.sql`）を使う。ローカルは `supabase db reset` で作り直し、本番には `supabase db push` で反映する。Data API を塞ぐ設定や RLS など、Supabase 固有の設定も同じ仕組みで管理する。golang-migrate と Atlas は使わない。
- **ローカル構成**：Next.js（`localhost:3000`）→ Go API（`go run ./cmd/api`、`localhost:8080`）→ Supabase のローカル環境。
- **よく使う作業のまとめ方**：Makefile にまとめる。CI からも同じターゲットを呼ぶ。
  - `make dev`：Supabase の起動、Go API の起動（`air` で保存時に自動で再起動）、Next.js の起動
  - `make gen`：oapi-codegen と openapi-typescript によるコード生成
  - `make db-reset`：ローカル DB の作り直しと、会場とアーティストの seed の投入
- **Lambda 固有の部分**：ローカルでは再現しない（LocalStack と SAM CLI は使わない）。
  - 普段の開発は `cmd/api` で行う。
  - 画像変換は「画像を受け取って WebP を返す」純粋な関数に切り出し、手元の画像ファイルでテストする。
  - API Gateway のイベントの変換と S3 イベントとのつなぎ込みは、サンプルのイベント JSON を使ったテストと、本番へのデプロイで確かめる。
- **環境変数**：Git に含めない `.env` に書き、必要な項目の見本として `.env.example` をコミットする。
- 申し送り（バックエンドのマップ）
  - Go、Supabase CLI、air をインストールする。
  - ローカルで Google と X のログインを試す方法を決める（Supabase のローカル環境の `config.toml` での OAuth 設定と、コールバック URL）。
- 申し送り（CI/CD のマップ）：`supabase db push` を本番にいつ、誰が実行するかを決める。
