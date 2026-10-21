# Supabase 無料プランで使う DB 機能（pg_cron・Data API の遮断・匿名ユーザー削除・RLS・API 用ロール）調査

- 調査日: 2026-10-21
- 前提構成: Supabase 無料プラン（Postgres + Auth）。DB の読み書きはすべて Go の API（AWS Lambda、Supavisor の transaction mode）から行い、フロントから直接呼ぶのは Supabase Auth だけ。匿名投稿は匿名サインインで扱い、座席レポを 1 件も投稿していない匿名ユーザーを 30 日後に pg_cron で削除する（docs/adr/0002、docs/adr/0005）。マイグレーションは Supabase CLI（`supabase/migrations/*.sql`、ローカルは `supabase db reset`、クラウドは `supabase db push`）。環境はローカル・dev・prod
- 根拠: 一次情報（supabase.com/docs・Supabase 公式ブログ / Changelog、Supabase の GitHub リポジトリのソースコード、PostgreSQL 公式ドキュメント、pg_cron の公式リポジトリ）。GitHub Discussions のコミュニティ回答は参考扱いとし、その旨を書いた。Supabase のドキュメントページには更新日の表記がなく、閲覧日（2026-10-21）を確認日とする。確認できなかった点は「未確認」と書いた

## 要約

1. **pg_cron**: 無料プランで使えないという記述は公式のどこにもなく、料金ページにも Cron の項目はない（「無料プランで使える」と明記した公式の記述も見つからず、**未確認**）。有効化は `create extension pg_cron with schema pg_catalog;` を SQL で実行すればよく、マイグレーションに書ける。ローカルの Supabase CLI が使う `supabase/postgres` イメージには pg_cron が入っている。
2. **Data API の遮断**: クラウドでは Data API そのものを無効にする（`db_schema` を空にする）か、公開スキーマから外す。この設定は `config.toml` の `[api]` を `supabase config push` で送る、Management API（`PATCH /v1/projects/{ref}/postgrest`）を呼ぶ、Terraform の `supabase_settings` リソースを使う、のいずれかでコード管理できる。権限の面では、**2026-10-30 から既存プロジェクトも含め「`public` の新しいテーブルは anon / authenticated / service_role に自動で grant されない」が既定になる**（新規プロジェクトは 2026-05-30 から）。ローカルの CLI も同じ既定になっている。
3. **auth.users の SQL 削除**: 公式ドキュメント自身が、古い匿名ユーザーを `delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';` で消す例を載せている（自動削除の機能は「現在ない」）。`auth.identities`・`auth.sessions`・`auth.mfa_factors`・`auth.one_time_tokens` は `on delete cascade` で消える。`public` 側は自分で付けた外部キーの `on delete` 次第。削除しても発行済みの JWT は期限まで有効のまま。
4. **RLS の既定**: SQL（マイグレーション）で作ったテーブルの RLS は既定で無効（PostgreSQL の仕様どおり）。ダッシュボードで作ったテーブルだけ既定で有効になる。自動で有効にしたい場合は、公式ドキュメントにあるイベントトリガー（`ensure_rls`）を自分で入れる（ダッシュボードにワンクリックで作るボタンもある）。新規プロジェクトで自動的に入るかどうかは**未確認**。
5. **Go API の DB ロール**: 公式は「アプリのアクセスには RLS を使い、サービスごとに専用のユーザーを作る」ことを勧めており、`postgres` は管理者権限を持つロールとして扱っている。専用ロールは `create role ... login password ...` で作れ、共有プーラー（Supavisor）経由では `[ROLE].[PROJECT-REF]` の形のユーザー名でログインできる（公式に明記あり）。ローカルでは `supabase/roles.sql` でロールを作れる。

---

## 1. pg_cron（Supabase Cron）

### 1.1 無料プランで使えるか

- Supabase Cron は "Under the hood, Supabase Cron uses the pg_cron Postgres database extension" とされている。推奨値として "we recommend no more than 8 Jobs run concurrently"、"Each Job should run no more than 10 minutes." がある。プランごとの制限は書かれていない。
  出典: https://supabase.com/docs/guides/cron （更新日表記なし）
- 料金ページ（https://supabase.com/pricing ）には Cron・pg_cron・拡張機能の行がなく、無料プランの可否は書かれていない。
- 機能紹介ページ（https://supabase.com/features/supabase-cron ）にもプランの記述はない（"Available on self-hosted: Yes" のみ）。
- 参考（公式ドキュメントではない）: GitHub Discussions で無料プランの制限を尋ねた質問に、Collaborator ラベルの付いた回答者（GaryAustin1、Supabase 社員かは不明）が "Cron is only limited by the resources it uses CPU/Memory/Disk wise on any tier." と答えている（2025-07-23）。
  出典: https://github.com/orgs/supabase/discussions/37405
- 結論: 無料プランで使えないという記述は公式にない。ただし「無料プランで使える」と明記した公式の記述も見つからなかったので、厳密には**未確認**。dev プロジェクトで実際に有効化して確かめるのが確実。

### 1.2 マイグレーションの SQL で有効にできるか

- 公式の手順（SQL）:

  ```sql
  create extension pg_cron with schema pg_catalog;

  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;
  ```

  無効化は `drop extension if exists pg_cron;`。無効にするとジョブはすべて消える。
  出典: https://supabase.com/docs/guides/cron/install （更新日表記なし）
- 拡張機能の一般論として "Even though the SQL code is `create extension`, this is the equivalent of enabling the extension." とある。
  出典: https://supabase.com/docs/guides/database/extensions （更新日表記なし）
- CLI のワークフローのドキュメントでは、自分で有効にした拡張機能（"`pg_net`, `pg_cron`, `pgcrypto`, and others"）は他のオブジェクトと同じく差分の対象になり、`DROP EXTENSION` が生成された場合は "a `DROP EXTENSION` applies silently on `db reset`" と注意している。
  出典: https://supabase.com/docs/guides/local-development/cli-workflows （更新日表記なし）
- ジョブの登録・解除の SQL: `select cron.schedule('ジョブ名', 'スケジュール', 'SQL');`、`select cron.unschedule('ジョブ名');`。同じジョブ名・同じユーザーで `cron.schedule` を呼ぶと既存のジョブが上書きされる（pg_cron のソースで `on conflict on constraint jobname_username_uniq do update` になっている。README には記述なし）ので、ジョブ名を付けておけばマイグレーションを再実行しても重複しない。
  出典: https://supabase.com/docs/guides/cron/quickstart 、 https://github.com/citusdata/pg_cron/blob/main/src/job_metadata.c
- 既知の問題（参考）: CLI v1.160.1（2023-10）で、最初のマイグレーションで `create extension pg_cron with schema extensions` を実行すると `cron` スキーマへの権限が付かない、という報告があった（報告者自身がクローズ。メンテナーの回答なし）。公式手順にある `grant` を書いておけば避けられる見込みだが、現行の CLI で再現するかは**未確認**。
  出典: https://github.com/supabase/cli/issues/1591

### 1.3 ローカル（Supabase CLI）で動くか

- CLI はローカルの DB に `supabase/postgres` イメージを使う（現在の develop ブランチの記述: `FROM supabase/postgres:17.11.0.006 AS pg`、`FROM supabase/postgres:15.19.0.006 AS pg15`）。
  出典: https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/templates/Dockerfile （CLI の最新リリースは v2.121.0、2026-10-14）
- `supabase/postgres` の拡張機能のバージョン定義に pg_cron があり、PG15 は 1.3.1〜1.6.4、PG17 は 1.6.4。
  出典: https://github.com/supabase/postgres/blob/develop/nix/ext/versions.json
- pg_cron はバックグラウンドワーカーのために `shared_preload_libraries` への登録が必要で（pg_cron README）、素の `postgres` イメージでは動かない。`supabase/postgres` イメージで `shared_preload_libraries` に入っているかはソースで確認しておらず、ローカルで実際に `create extension pg_cron` が通るかは**未確認**（`supabase db reset` で確かめる）。

### 1.4 運用上の注意

- ジョブは `cron.schedule` を呼んだユーザーの権限で、呼んだデータベースで実行される（"with the same permissions as the current user"）。タイムゾーンの既定は GMT。
  出典: https://github.com/citusdata/pg_cron
- 実行履歴 `cron.job_run_details` は自動では消えない（"The records in the `cron.job_run_details` table are not cleaned up automatically."）。公式は 7 日より古い履歴を消すジョブの例を載せている。無料プランは DB 500 MB なので、掃除のジョブも一緒に登録しておくのがよい。
  出典: https://supabase.com/docs/guides/cron/quickstart
- 無料プランのプロジェクトは 7 日間活動がないと一時停止され、その間はジョブも動かない。pg_cron のジョブの実行が「活動」に数えられるかは公式に書かれておらず**未確認**（ADR 0002 のとおり、外部からのヘルスチェックで止めない前提にする）。

---

## 2. Data API（PostgREST）からアプリのテーブルを見えなくする方法

### 2.1 手段は 3 つ

| 手段 | 効き方 | 設定の場所 |
|---|---|---|
| A. Data API を無効にする | REST / GraphQL のエンドポイント自体が応答しなくなる。権限や RLS とは無関係 | プロジェクト設定（クラウド）、`config.toml` の `[api] enabled`（ローカル） |
| B. 公開スキーマ（exposed schemas）から外す | そのスキーマのテーブル・ビュー・関数にエンドポイントが作られない | 同上（`[api] schemas`） |
| C. `anon`・`authenticated`（・`service_role`）から権限を `revoke` する | エンドポイントはあるが、権限エラー（42501）になる | マイグレーションの SQL |

- A について公式は "If your app never uses Supabase client libraries, REST, or GraphQL data endpoints, turn the Data API off" とし、無効にすると権限や RLS の設定にかかわらず自動生成の REST エンドポイントが応答しなくなる、としている。
  出典: https://supabase.com/docs/guides/database/hardening-data-api 、 https://supabase.com/docs/guides/api/securing-your-api （どちらも更新日表記なし）
- このプロジェクトはフロントから Supabase Auth しか使わないので、A が公式の勧める形にそのまま当てはまる。A・B は設定で、C は DB の中の権限なので、重ねておくと「設定を戻してしまった」ときの保険になる。

### 2.2 ローカル（config.toml）とクラウドの違い・コードでの管理

- ローカルの `config.toml`:
  - `api.enabled`（既定 `true`）: "Enable the local PostgREST service."
  - `api.schemas`（既定 `["public", "storage", "graphql_public"]`）: "Schemas to expose in your API." ドキュメントには "`public` and `storage` are always included." とも書かれている。ただし CLI のソースでは `schemas` をそのまま `PGRST_DB_SCHEMAS` に連結しているだけで、`public` を強制的に足す処理は見当たらなかった。どちらが実際の挙動かは**未確認**。
  出典: https://supabase.com/docs/guides/local-development/cli/config 、 https://github.com/supabase/cli/blob/develop/apps/cli/src/commands/start/services/postgrest.service.ts
- `config.toml` はローカル用だが、`supabase config push` で "Updates the configurations of a linked Supabase project with the local `supabase/config.toml` file." できる。
  出典: https://supabase.com/docs/reference/cli/supabase-config-push
  - CLI のソースでは、`config push` は `[api]`・`[db]`・`[auth]`・`[storage]`・`[experimental]` をクラウドに送る。`[api]` は Management API の PostgREST 設定に変換され、**`enabled = false` のときは `db_schema` を空文字にして送る**（＝クラウドの Data API 無効化に当たる）。`schemas` はカンマ区切りの `db_schema` になる。
    出典: https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/api.go 、 https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/updater.go
  - dev と prod で値を変えたい場合は `[remotes.<name>]` ブロックで上書きできる（"All other configuration options available in the root config are also supported in the remotes block."）。ただしこのブロックは Branching 用の説明なので、Branching を使わない dev / prod の 2 プロジェクトで `config push --project-ref` と組み合わせて使えるかは**未確認**。
- Management API: `GET` / `PATCH /v1/projects/{ref}/postgrest`。ボディは `db_schema`・`db_extra_search_path`・`max_rows`・`db_pool` など（`db_schema` は文字列。例 `"public,storage"`）。
  出典: https://api.supabase.com/api/v1-json （OpenAPI 定義）
- Terraform: `supabase/supabase` プロバイダの `supabase_settings` リソースに `api`（"API settings as serialised JSON"、中身は上の PostgREST 設定）がある。例は `api = jsonencode({ db_schema = "public,storage,graphql_public", ... })`。最新リリースは v1.11.0（2026-09-02）。
  出典: https://github.com/supabase/terraform-provider-supabase/blob/main/docs/resources/settings.md
- `db_schema` を空文字にしたときにクラウドで Data API が無効になる、という対応関係は CLI のソースのコメント（"When the api is disabled, remote side it just set the dbSchema to an empty value"）によるもので、Management API のドキュメントには書かれていない。Terraform で同じことをする場合も同じ値になるはずだが**未確認**。

### 2.3 新しいテーブルへの自動 grant の既定の変更（重要）

Changelog「Breaking Change: Tables not exposed to Data and GraphQL API automatically」（2026-04-28 公開）:
- これまでは `public` のテーブルに `anon`・`authenticated`・`service_role` へ `select, insert, update, delete` が自動で付いていた。今後は "New tables in the public schema will no longer be exposed to the Data API automatically." 明示的な `grant` が必要になる。
- 日程:
  - 2026-04-28: 新規プロジェクトの作成時にオプトアウトできるようになった
  - 2026-05-18: pg_graphql が既定で有効にならなくなった
  - 2026-05-30: 新規プロジェクトの既定になった（数週間かけて順次）
  - **2026-10-30: 既存プロジェクトすべてに適用**（調査日の 9 日後）
- 対象は `public` スキーマのみ。`storage`・`auth`・`realtime`・独自スキーマは従来どおり。既存のテーブルの権限は変わらない（"Existing tables are not affected in your project"）。
- 直接接続（psql・ORM・アプリサーバー）には影響しない（"If your app reads and writes Postgres over a direct connection... this change will not affect you."）。
- 既存プロジェクトを先に新しい挙動にする SQL（ダッシュボードがプロジェクト作成時に流すもの）が載っている。
  出典: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically 、 https://github.com/orgs/supabase/discussions/45329

ローカル（CLI）の挙動（ソースより）:
- `supabase start` / `db reset` のときに、クラウドと同じ revoke を流す:

  ```sql
  alter default privileges for role postgres in schema public
    revoke select, insert, update, delete on tables from anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke usage, select on sequences from anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    revoke execute on functions from anon, authenticated, service_role;
  ```

- `config.toml` の `[api] auto_expose_new_tables` が未設定（既定）か `false` ならこの revoke を流し、`true` なら旧挙動のまま。`true` は非推奨で、2026-10-30 に項目ごと削除される。
  出典: https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/db/start/start.go 、 https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/api.go

補足:
- この revoke は「`postgres` が今後作るオブジェクト」の既定の権限を変えるだけ。それ以前に作られたテーブルの権限は残る。Hardening ガイドは、ダッシュボードの "Automatically expose new tables" を切っても `truncate`・`references`・`trigger`・`maintain`（テーブル）と `update`（シーケンス）が残ること、関数は `PUBLIC` への既定の `execute` で全ロールから呼べることを注意している。
  出典: https://supabase.com/docs/guides/api/securing-your-api 、 https://supabase.com/docs/guides/database/hardening-data-api
- 2025-04-21 から `auth`・`storage`・`realtime` スキーマでは「API ロールからの権限の revoke」などが禁止されているが、`public` は対象外。
  出典: https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025

---

## 3. SQL から auth.users を削除してよいか

### 3.1 公式の匿名ユーザー削除の例

- "Automatic cleanup of anonymous users is currently not available." 代わりに次の SQL で消せる、とある:

  ```sql
  -- deletes anonymous users created more than 30 days ago
  delete from auth.users
  where is_anonymous is true and created_at < now() - interval '30 days';
  ```

  出典: https://supabase.com/docs/guides/auth/auth-anonymous （更新日表記なし）
- つまり SQL で `auth.users` の行を直接消すことは、公式の手順として示されている。pg_cron のジョブにこの SQL を入れるのは、この例をそのまま定期実行する形になる（pg_cron と組み合わせた例そのものは公式にはない）。
- ユーザー削除の別の手段として、ダッシュボード（Authentication > Users）と Admin API の `auth.admin.deleteUser()` がある。
  出典: https://supabase.com/docs/guides/auth/managing-user-data
- 2025-04-21 からの `auth` スキーマの制限で禁止されたのは、マイグレーション管理用のテーブル（`auth.schema_migrations` など）への INSERT / UPDATE / DELETE / TRUNCATE と、テーブル・関数の作成・削除など。`auth.users` の行の削除は制限の対象として挙げられていない。
  出典: https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025

### 3.2 削除したときの注意

- "deleting a user from the `auth.users` table does not automatically sign out a user." JWT は期限が切れるまで「有効」なまま。
  出典: https://supabase.com/docs/guides/auth/managing-user-data
  - このプロジェクトでは Go が JWT を自前で検証する（ADR 0006）ので、削除済みの匿名ユーザーの JWT が期限内に届く可能性がある。投稿時に `public` 側で外部キー違反になるなど、どう扱うかは決めておく必要がある。
- Supabase Storage のオブジェクトを所有するユーザーは削除できない（"You cannot delete a user if they are the owner of any objects in Supabase Storage."）。このプロジェクトは画像を S3 に置く（ADR 0003）ので該当しない見込み。
  出典: 同上

### 3.3 auth スキーマ内への波及（外部キー）

Supabase Auth（GoTrue）のマイグレーションで、次の外部キーが `on delete cascade` になっている:

| テーブル | 外部キー |
|---|---|
| `auth.identities` | `user_id` → `auth.users(id)` `ON DELETE CASCADE` |
| `auth.sessions` | `user_id` → `auth.users(id)` `on delete cascade` |
| `auth.refresh_tokens` | `session_id` → `auth.sessions(id)` `on delete cascade`（セッション経由で消える） |
| `auth.mfa_factors` | `user_id` → `auth.users(id)` `on delete cascade` |
| `auth.one_time_tokens` | `user_id` → `auth.users` `on delete cascade` |

出典: https://github.com/supabase/auth/tree/master/migrations （`20210909172000_create_identities_table.up.sql`、`20220811173540_add_sessions_table.up.sql`、`20221003041349_add_mfa_schema.up.sql`、`20240427152123_add_one_time_tokens_table.up.sql`）

- そもそも匿名ユーザーは "Anonymous users aren't tied to any identities." とされている。
  出典: https://supabase.com/docs/guides/auth/users

### 3.4 public 側の参照テーブルへの波及

- 公式は `auth.users` を参照するときに "Specify `on delete cascade` in the reference." と勧めている。また "Only use primary keys as foreign key references for schemas and tables like `auth.users` which are managed by Supabase." としている。
  出典: https://supabase.com/docs/guides/auth/managing-user-data
- `public` 側に何が起きるかは、自分で付けた外部キーの `on delete` で決まる（PostgreSQL の通常の挙動）。
  - `on delete cascade`: ユーザーと一緒に行も消える
  - `on delete set null`: 列が null になる
  - 既定（`no action`）/ `restrict`: 参照している行があるとユーザーの削除自体がエラーになる
- このプロジェクトの削除ジョブは「座席レポが 0 件の匿名ユーザー」だけを対象にするので、公式例の条件に `not exists (select 1 from public.<座席レポ> where user_id = auth.users.id)` を足す形になる。座席レポの外部キーを `cascade` にすると、条件を書き間違えたときにレポごと消えるので、座席レポ側は `restrict`（または既定）にして削除ジョブの誤りをエラーで止める、という選択肢もある（設計判断）。投稿数カウンタなど、匿名ユーザーと一緒に消えてよいテーブルは `cascade` が向く。

---

## 4. 新しいテーブルで RLS が既定で有効になるか

- PostgreSQL の仕様: "By default, tables do not have any policies"。RLS は `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` で有効にする。有効にしてポリシーがなければ "a default-deny policy is used, meaning that no rows are visible or can be modified." スーパーユーザーと `BYPASSRLS` を持つロールは常に RLS を素通りし、テーブルの所有者も通常は素通りする（`FORCE ROW LEVEL SECURITY` で所有者にもかけられる）。
  出典: https://www.postgresql.org/docs/current/ddl-rowsecurity.html （PostgreSQL 18 のドキュメント）
- Supabase:
  - "For tables created via the dashboard, RLS is enabled by default." マイグレーションや外部ツールで作ったテーブルは有効にならないことがあり、そのために 2025 年にイベントトリガーで RLS を自動で有効にする方法を文書化し、ダッシュボードにワンクリックで設定するボタンを付けた。RLS をすべてのテーブルで既定にする計画は書かれていない。
    出典: https://supabase.com/blog/supabase-security-2025-retro （2026-01-07 公開）
  - イベントトリガーの例: `ddl_command_end` で `CREATE TABLE`・`CREATE TABLE AS`・`SELECT INTO` のときに `alter table ... enable row level security` を実行する `SECURITY DEFINER` 関数を呼ぶ（`public` スキーマのみ）。"Note that this applies to tables created after the trigger is installed." "Only the `postgres` user can create event triggers"。
    出典: https://supabase.com/docs/guides/database/postgres/event-triggers （更新日表記なし）
  - 参考（公式ではない）: 2026-05-11 の GitHub Discussions のコメントでは、ダッシュボードの Authentication に "Auto-enable RLS for new tables" があり、"create ensure_rls trigger" を押す opt-in 方式だとされている。
    出典: https://github.com/orgs/supabase/discussions/21747
- 結論: マイグレーションの SQL で作るテーブルは、**RLS が既定で無効**。新規プロジェクトでトリガーが最初から入っているかは**未確認**（dev プロジェクトで `select * from pg_event_trigger;` を見れば分かる）。各マイグレーションで `alter table ... enable row level security;` を明示するのが、ローカル・dev・prod で挙動をそろえる一番確実な方法。
- 2.3 の自動 grant の変更とは別の層。grant は「そのロールがテーブルに触れるか」、RLS は「どの行が見えるか」を決める（Changelog の説明）。

---

## 5. Go の API が接続する DB ロール

### 5.1 公式の推奨

- "Generally you wouldn't use these roles for your own application"（Supabase が用意しているロールのこと）、アプリのアクセスには RLS を使う。サービスごとにユーザーを作ることを勧めている: "we recommend that you create a new user for every service that you want to give access too."
- `postgres` は "The default Postgres role. This has admin privileges." で、パスワードは "You should never give this to third-party service unless you absolutely trust them."
- ロールの作り方: `create role "role_name" with login password 'extremely_secure_password';`
  出典: https://supabase.com/docs/guides/database/postgres/roles （更新日表記なし）
- RLS を素通りするロールも作れる: `alter role "role_name" with bypassrls;`、"can be useful for system-level access."、"**Never** share login credentials for any Postgres Role with this privilege."
  出典: https://supabase.com/docs/guides/database/postgres/row-level-security
- 公式ブログでも、スーパーユーザー的なロールについて "you should avoid working with this role as much as possible" としている。
  出典: https://supabase.com/blog/postgres-roles-and-privileges （2024-04-11 公開）
- 「サーバーから直接接続するバックエンドはこのロールを使え」という特定の推奨は見つからなかった（**未確認**）。

### 5.2 Supavisor（transaction mode）で専用ロールでログインできるか

- できる。"If you connect as a custom role through the shared pooler, the username is `[ROLE].[PROJECT-REF]`."
  出典: https://supabase.com/docs/guides/database/connecting-to-postgres 、 https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found
- プロジェクト ref を付けずにロール名だけを渡すと、認証エラーではなく "Tenant or user not found" になる（同 troubleshooting ページ）。
- 公式の具体例: バックアップ用の専用ロールを `create role backup_reader login password '<strong-password>' bypassrls;` で作り、共有プーラーでは "change `postgres.<project-ref>` to `backup_reader.<project-ref>`" とする。
  出典: https://supabase.com/docs/guides/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy-1d5783
- 公式ブログにも共有プーラーで `junior_dev.[YOUR-PROJECT-REF]` として接続する例がある（5432 番ポートの例）。
  出典: https://supabase.com/blog/postgres-roles-and-privileges
- 公式の例はいずれも session mode（5432）か、モードを区別していない記述。transaction mode（6543）で専用ロールを使った例はなく、6543 で同じように使えるかは記述上は**未確認**（ユーザー名の形式はポートに依存しない書き方になっている）。

### 5.3 ロールの作り方とマイグレーションの関係

- ローカル: `supabase start` / `db reset` のとき、マイグレーションより前に `supabase/roles.sql` を実行する（CLI のソースで、`SetupDatabase` が `roles.sql` を流したあとに `MigrateAndSeed` を呼んでいる）。
  出典: https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/db/start/start.go
- クラウド: `supabase db push --include-roles` で "Include custom roles from supabase/roles.sql."。ロールはクラスタ単位のオブジェクトなので、リモートの `db reset` では消えない。
  出典: https://supabase.com/docs/reference/cli/supabase-db-push 、 https://supabase.com/docs/reference/cli/supabase-db-reset
- パスワードをマイグレーションや `roles.sql` にそのまま書くとリポジトリに残る。`roles.sql` ではパスワードなしでロールを作り、dev / prod のパスワードは別途（ダッシュボードの SQL エディタなどで）設定する、などの運用が必要（どの方法が公式の推奨かは**未確認**。CLI のソースには「`roles.sql` から Vault のシークレットを参照できるように先に Vault を作る」とのコメントがあり、`config.toml` の `[db.vault]` を使う方法もありそうだが詳細は未確認）。

### 5.4 RLS と組み合わせたときの注意（上の一次情報から導いたこと）

- 4 の方針どおりテーブルの RLS を有効にしてポリシーを作らない場合、専用ロールは**所有者でも `BYPASSRLS` 持ちでもなければ 1 行も読めない**（PostgreSQL の default-deny）。選択肢は次の 3 つ:
  1. 専用ロールに `bypassrls` を付ける（公式の `backup_reader` の例と同じ形）。認可は Go の usecase 層で行う前提になる。
  2. 専用ロール向けのポリシー（例: `to <ロール> using (true)`）をテーブルごとに作る。
  3. `postgres` で接続する。`postgres` は `bypassrls` を持つ（"on Supabase the owner is `postgres`, which has `bypassrls`"）が、管理者権限なので公式の勧め方からは外れる。
- 専用ロールには、使うテーブルへの `select, insert, update, delete` と、シーケンスへの `usage` を明示的に grant する（2.3 のとおり自動では付かない）。`create` 権限やスキーマ変更の権限は付けず、マイグレーションは `postgres`（CLI）で流す、と役割を分けられる。
- `pg_cron` の削除ジョブは `cron.schedule` を呼んだロール（マイグレーションなら `postgres`）の権限で動くので、Go 用の専用ロールに `auth.users` の削除権限を渡す必要はない。

---

## 設計判断への示唆（事実から言えること）

- Data API は「無効化（`[api] enabled = false` → `config push`、または Terraform の `db_schema = ""`）」と「`anon`・`authenticated`・`service_role` から権限を外す」の 2 層で塞げる。前者はプロジェクト設定、後者はマイグレーションなので、ローカル・dev・prod すべてで同じ状態を再現できる。
- 2026-10-30 以降は `public` の新しいテーブルに API ロールへの grant が自動で付かなくなるので、「付けない」側は既定に任せられる。ただし既存プロジェクトでそれ以前に作ったテーブルには grant が残るので、移行時点で作ってあるテーブルは明示的に revoke しておく。
- 匿名ユーザーの削除は公式の SQL 例を pg_cron で定期実行する形にでき、`auth.identities` などは cascade で消える。`public` 側の外部キーの `on delete` を「座席レポは restrict、カウンタ類は cascade」のように分けると、削除ジョブの誤りに強くなる。`cron.job_run_details` の掃除ジョブも一緒に入れる。
- マイグレーションで作るテーブルの RLS は既定で無効なので、各テーブルで明示的に有効にする。その場合、Go の専用ロールには `bypassrls` を付けるかポリシーを作る必要がある。
- 実機で確認すべき**未確認**事項: 無料プランで `create extension pg_cron` が通ること（dev）、ローカルの `supabase db reset` で pg_cron が有効になりジョブが動くこと、`[api] enabled = false` を `config push` したときにクラウドの Data API が無効表示になること、ローカルの `api.schemas` から `public` を外せるか、新規プロジェクトに `ensure_rls` トリガーが最初から入っているか、transaction mode（6543）で `[ROLE].[PROJECT-REF]` でログインできること、専用ロールのパスワードの管理方法。
