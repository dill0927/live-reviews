# ディレクトリの再配置（モノレポ化）

Type: task（AFK）
Status: resolved
Blocked by:

## Question

今の Next.js を `frontend/` に移し、`supabase init` で `supabase/` を作る。Makefile を置き、`db-reset` のターゲットだけ用意する（中身は `supabase db reset`。seed の投入は「会場とアーティストのマスタと seed」で足す）。`backend/`・`infrastructure/`・`api/` はここでは作らない。

確かめること：`frontend/` で `npm run dev` と `npm run build` が通る。Vercel のプロジェクト設定の Root Directory を `frontend/` に変える必要があれば、その手順をユーザーに渡す。Supabase CLI が未インストールならインストールする（ローカル開発環境のチケットの申し送り）。

## Answer

2026-10-21 に実施。

- **移動したもの**：`app/`・`lib/`・`public/`・`package.json`・`package-lock.json`・`tsconfig.json`・`next.config.ts`・`postcss.config.mjs`・`eslint.config.mjs` を `git mv` で `frontend/` に移した（履歴は引き継がれる）。Next.js 用の `.gitignore` も `frontend/.gitignore` に移し、ルートの `.gitignore` には共通の `.DS_Store` と `.env*` だけを置いた。
- **`supabase/`**：Supabase CLI 2.121.0 を Homebrew（`supabase/tap/supabase`）でインストールし、ルートで `supabase init` を実行した。`config.toml` は初期値のまま（`project_id = "live-reviews"`、Postgres 17、`[api] schemas = ["public", "graphql_public"]`）。Data API などの設定は後のチケットで変える。
- **Makefile**：ルートに `db-reset`（`supabase db reset`）だけを置いた。事前に `supabase start` が必要。マイグレーションがまだないので、実際の実行は「スキーマ全体の規約」で確かめる。
- **README**：セットアップ手順に `cd frontend` と `.env.local` の場所だけを足した。全体の書き直しは CI/CD・ドキュメントのマップで扱う。
- **確認したこと**：`frontend/` で `npm ci`、`npm run build`（Supabase の環境変数にダミーの値を渡して最後まで成功。値がないと sitemap の生成で `supabaseUrl is required` で止まるが、これは移動前からの挙動）、`npm run dev`（`/terms` が 200）。
- **ユーザーに残る作業**：この再配置を `main` にマージするときに、Vercel のプロジェクト設定で Root Directory を `frontend` に変える（Settings → Build and Deployment → Root Directory）。Root Directory はブランチごとではなくプロジェクトで 1 つの設定なので、先に変えると `main` の本番デプロイが失敗する。それまでの間、`develop` を push したときのプレビューのデプロイは失敗するが、本番には影響しない。
