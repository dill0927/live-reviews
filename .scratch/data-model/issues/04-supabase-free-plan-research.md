# Supabase の無料プランで使える機能の調査

Type: research
Status: resolved
Blocked by:

## Question

データモデルの設計の前提になる、Supabase（無料プラン）の事実を公式ドキュメントで確かめる。
- `pg_cron` は無料プランで使えるか。有効にする方法（マイグレーションの SQL で `create extension` できるか）。
- Data API（PostgREST）から `public` スキーマ（または任意のスキーマ）を見えなくする方法。ローカルの `supabase/config.toml` の設定と、クラウドのプロジェクトの設定の違い。設定をコードで管理できるか（Management API、Terraform provider など）。権限（`anon`・`authenticated` ロールからの `revoke`）で塞ぐ方法との違い。
- SQL（`pg_cron` のジョブ）から `auth.users` の行を削除してよいか。公式に推奨される匿名ユーザーの削除方法と、削除したときに関連テーブルへどう波及するか（外部キーの `on delete`）。
- 新しく作るテーブルで、RLS が既定で有効になるかどうか（最近の Supabase の変更があれば）。
- Go の API が接続する DB ロールについて、公式に推奨される作り方（`postgres` をそのまま使うか、専用のロールを作るか）と、Supavisor 経由で専用のロールを使えるか。

## Answer

調査：[docs/research/supabase-free-plan-features.md](../../../docs/research/supabase-free-plan-features.md)（2026-10-21）

- **pg_cron**：無料プランで使えないという公式の記述はないが、使えると明記した記述もなく「未確認」。有効化は `create extension pg_cron with schema pg_catalog;` でマイグレーションに書ける。ローカルの CLI のイメージにも入っている。`cron.job_run_details` は自動で消えないので、履歴を消すジョブも要る。
- **Data API の封鎖**：公式は「使わないなら無効にする」を勧めている。`config.toml` の `[api] enabled = false` を `supabase config push` で送る、Management API、Terraform の `supabase_settings` のどれでもコードで管理できる。**既存プロジェクトでは 2026-10-30 から、`public` の新しいテーブルが anon・authenticated・service_role に自動で grant されなくなる**（新規プロジェクトは 2026-05-30 から）。それより前に作ったテーブルには grant が残るので、明示的に revoke が要る。
- **auth.users の削除**：公式ドキュメント自身が `delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days'` の例を載せている。auth スキーマ内の関連行は cascade で消える。`public` 側は自分で付ける外部キーの `on delete` 次第（restrict にすれば、条件の書き間違いをエラーで止められる）。削除しても発行済みの JWT は期限まで有効。
- **RLS の既定**：マイグレーションの SQL で作ったテーブルは RLS が既定で無効。自動で有効にするにはイベントトリガー（`ensure_rls`）を自分で入れるか、マイグレーションごとに明示する。
- **Go の API の DB ロール**：公式は「サービスごとに専用のユーザーを作る」を勧めている。共有プーラー経由では `[ROLE].[PROJECT-REF]` のユーザー名でログインできる（transaction mode での例はなく未確認）。ローカルは `supabase/roles.sql`、クラウドは `db push --include-roles` で作れる。RLS を有効にしてポリシーがないと専用ロールは何も読めないので、`bypassrls` かポリシーが要る。
- **実機で確かめること**（「dev への反映と確認」で扱う）：dev で `create extension pg_cron` が通るか、`config push` 後に Data API が本当に無効になるか、transaction mode で専用ロールでログインできるか。専用ロールのパスワードの管理方法は「Data API の封鎖と DB ロールの権限」で決める。
