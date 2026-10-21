# ディレクトリの再配置（モノレポ化）

Type: task（AFK）
Status: open
Blocked by:

## Question

今の Next.js を `frontend/` に移し、`supabase init` で `supabase/` を作る。Makefile を置き、`db-reset` のターゲットだけ用意する（中身は `supabase db reset`。seed の投入は「会場とアーティストのマスタと seed」で足す）。`backend/`・`infrastructure/`・`api/` はここでは作らない。

確かめること：`frontend/` で `npm run dev` と `npm run build` が通る。Vercel のプロジェクト設定の Root Directory を `frontend/` に変える必要があれば、その手順をユーザーに渡す。Supabase CLI が未インストールならインストールする（ローカル開発環境のチケットの申し送り）。
