# Go の API は専用のロールで接続し、RLS はそのロールだけに開ける

Go の API は `postgres` ではなく、`app` のテーブルの読み書きだけを持つ専用のロール `sekirepo_api` で DB に接続する。`app` の全テーブルで RLS を有効にし、`sekirepo_api` だけに `using (true)` のポリシーを付ける。決め手は被害を小さくすること。Lambda の接続文字列が漏れたり、SQL インジェクションがあったりしても、スキーマの変更や `auth.users` の書き換えはできない。RLS は行の認可には使わない（認可は Go の usecase 層で行う）。役割は「`sekirepo_api` 以外のロールには、誤って grant されても 1 行も見せない」という保険だけにする。Data API は `[api] enabled = false` で止め、`app` を公開スキーマに入れず、`anon`・`authenticated` に権限を与えない、の 3 層で塞ぐ。

## Considered Options

- **`postgres` で接続する**：設定がいちばん少ない。ただし管理者の権限を持つので、漏れたときの被害が最大になる。公式も第三者のサービスに渡さないよう注意している。
- **専用のロールに `bypassrls` を付ける**：テーブルごとのポリシーが要らない。ただし公式は、この属性を持つロールの資格情報を共有しないよう書いている。また RLS の保険が「どのロールなら通すか」をテーブルの定義に残さなくなる。
- **RLS を使わない**：grant だけで守る。`anon` などに誤って grant すると、その時点で全行が見える。
- **`ensure_rls` のイベントトリガーで RLS を自動で有効にする**：書き忘れはなくなるが、マイグレーションを読んでも見えないところで働く。書き忘れは `supabase test db` のテストで捕まえる。

## Consequences

- `app` にテーブルを作るときは、RLS の有効化、`sekirepo_api` のポリシー、grant の 3 つを必ず書く。`supabase/tests/database/api_role.test.sql` が全テーブルでそろっているかを確かめる。
- `sekirepo_api` のパスワードはリポジトリに書かない。ローカルは `make db-reset` で固定の値を設定し、dev / prod は SQL エディタで設定する。Supavisor 経由のユーザー名は `sekirepo_api.<project-ref>`。
- `sekirepo_api` は `auth`・`extensions` に触れない。匿名ユーザーの削除のように `auth` を触る処理は、pg_cron のジョブ（`postgres` の権限）で行う。
- `config.toml` は dev と prod で共通。prod は今のフロントが Data API を使っているので、切り替えまで prod には `supabase config push` しない。
