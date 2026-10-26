# Data API の封鎖と DB ロールの権限

Type: grilling
Status: resolved
Blocked by: 04, 05

## Question

ADR 0002 で決めた「フロントから直接呼ぶのは認証だけ。Data API からは触れられないようにする」を、具体的な設定と権限にして、マイグレーション（と必要なら `config.toml`）に書く。
- Data API からアプリのテーブルを見えなくする方法（スキーマを公開しない、`anon`・`authenticated` から権限を外す、またはその両方）。
- Go の API が接続する DB ロール：`postgres` を使うか、必要な権限だけを持つ専用のロールを作るか。
- RLS を保険として有効にするか（Data API を塞いだうえで、さらに RLS を有効にして「ポリシーなし＝すべて拒否」にする、など）。
- 塞げていることをどう確かめるか（ローカルで `anon` のキーを使って REST を叩くテストなど）。

補足（Supabase の無料プランで使える機能の調査から）：Data API は `config.toml` の `[api] enabled = false` を `supabase config push` で送れば丸ごと無効にでき、コードで管理できる。既存プロジェクトでは 2026-10-30 より前に作ったテーブルに anon などへの grant が残るので revoke が要る（prod を作り直すなら関係しない）。公式は専用のロールを勧めており、プーラー経由のユーザー名は `[ROLE].[PROJECT-REF]`。ローカルは `supabase/roles.sql`、クラウドは `db push --include-roles` で作る。RLS を有効にしてポリシーがないと専用ロールは読めないので、`bypassrls` かポリシーが要る。専用ロールのパスワードをどう管理するかもここで決める。

補足（「dev と prod の Supabase プロジェクトの用意」から）：dev（re-sekirepo-dev）は、作成画面で「データ API を有効にする」「新しいテーブルを自動的に公開する」「自動 RLS を有効にする」をすべてオフにして作った。`config.toml` の `[api]` の設定を、この状態とそろえる（`config push` で上書きされるため）。prod は今のフロントのために Data API が有効のまま。

補足（「スキーマ全体の規約」から）：テーブルは `app` スキーマに置く（ADR 0007）。`app` は `anon`・`authenticated` に usage がなく、`[api] schemas` にも入れないので、Data API から見えない。Go の接続ロールには `app` の usage・テーブルの権限・`search_path` の設定が要る。RLS を全テーブルで有効にする仕組み（`ensure_rls` のイベントトリガーか、マイグレーションごとの明示か）も、ここで決める。

## Resolution（2026-10-21）

### 決めたこと（[ADR 0008](../../../docs/adr/0008-dedicated-api-role-with-rls-policy.md)）
- **Data API は 3 層で塞ぐ**：`config.toml` の `[api] enabled = false`（dev の作成時の設定とそろえる）、`app` を公開スキーマに入れない（ADR 0007）、`anon`・`authenticated` に `app` の権限を与えない。
- **Go の API は専用のロール `sekirepo_api` で接続する**。`app` の usage とテーブルの読み書きだけを持ち、`search_path` は `app`。`create`・`bypassrls`・管理者の属性は持たない。`auth`・`extensions` にも触れない。
- **RLS は保険として使う**：`app` の全テーブルで有効にし、`sekirepo_api` だけに `using (true) with check (true)` のポリシーを付ける。行の認可は Go の usecase 層で行う。`ensure_rls` のイベントトリガーは使わない（見えないところで働くため。書き忘れはテストで捕まえる）。
- **grant はテーブルごとに明示する**（default privileges は使わない）。テーブルを作るときの 3 行の決まり：
  ```sql
  alter table app.xxx enable row level security;
  create policy api_all on app.xxx to sekirepo_api using (true) with check (true);
  grant select, insert, update, delete on app.xxx to sekirepo_api;  -- 更新しないテーブルは update を外す
  ```
- **ロールはマイグレーションでパスワードなしで作る**。パスワードはリポジトリに書かない。ローカルは `make db-reset` が固定の値 `local-only` を設定する。dev / prod は SQL エディタで `alter role sekirepo_api password '...'` を 1 回だけ流し、Chrome のパスワードマネージャーに保存する。Lambda に渡す方法はバックエンドのマップで決める。

### 書いたもの
- `supabase/migrations/20261021091214_create_api_role.sql`：`sekirepo_api` の作成、`app` の usage、`search_path`。
- `supabase/config.toml`：`[api] enabled = false`（prod に config push しない旨のコメント付き）。
- `Makefile`：`db-reset` のあとにパスワードを設定する。`db-test`（`supabase test db`）を追加した。
- `supabase/tests/database/api_role.test.sql`（pgTAP・14 件）：`anon`・`authenticated` が `app` に触れない、`sekirepo_api` の権限と属性、`app` の全テーブルで「RLS・ポリシー・grant」がそろっている、決まりどおりのテーブルなら `sekirepo_api` は読み書きでき、誤って grant された `authenticated` には 0 行しか見えない。

### 確かめたこと（ローカル）
- `make db-reset` と `make db-test` が通る。決まりの 3 行を書かずにテーブルを作るとテストが失敗する。
- `sekirepo_api` / `local-only` で psql からログインでき、`search_path` は `app`。`auth.users` は `permission denied for schema auth`。
- Data API を止めると PostgREST のコンテナが起動せず、`/rest/v1/` は 503 になる。Auth（`/auth/v1/health`）は 200 のまま。

### 分かった事実
- Postgres 16 からは、ロールを作った `postgres` でも、そのロールに `set role` するには明示的な grant が要る（テストでは一時的に付けて rollback で消している）。
- `alter role ... set search_path` はログインのときにだけ効き、`set role` では効かない。

### 申し送り
- 「dev への反映と確認」：dev で `sekirepo_api` のパスワードを設定し、Supavisor の transaction mode（6543）で `sekirepo_api.<ref>` としてログインできるかを確かめる。`config push` は dev にだけ行う。
- テーブルを作る各チケット：上の 3 行の決まりを守る（`make db-test` で確かめる）。
