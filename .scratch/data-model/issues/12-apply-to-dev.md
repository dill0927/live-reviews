# dev への反映と確認

Type: task（HITL）
Status: resolved（2026-10-26）
Blocked by: 03, 06, 10, 11, 13

## Question

ここまでのマイグレーションと seed を、dev の Supabase プロジェクトに `supabase db push` で反映し、クラウド上でも意図どおりに動くかを確かめる。
- Data API（`anon` のキー）からアプリのテーブルに触れないこと
- `pg_cron` の 3 つのジョブ（`delete-stale-anonymous-users`・`delete-old-post-logs`・`delete-old-cron-run-details`）が登録されていること
- 会場とアイドルのマスタが入っていること（マスタはマイグレーションで入れるので、`db push` だけで会場 28 件・アイドル 44 件になる。ADR 0009）
- `config.toml` の `[api] enabled = false` を dev にだけ `supabase config push` する（prod には push しない。今のフロントが Data API を使っているため）
- SQL エディタで `sekirepo_api` のパスワードを設定し、Chrome のパスワードマネージャーに保存する。Supavisor の transaction mode（6543）で `sekirepo_api.<ref>` としてログインでき、`app` のテーブルを読み書きできること

反映の手順（`supabase link` など）を README か docs に残す。prod への反映は行わない（CI/CD のマップで扱う）。

補足（Supabase の無料プランで使える機能の調査から）：実機で確かめることとして、`create extension pg_cron` が無料プランで通るか、`config push` 後に Data API が本当に無効になるか、transaction mode（6543 番ポート）で専用ロールでログインできるか、を加える。

## Resolution

9 本のマイグレーションを dev（re-sekirepo-dev・`ekbitoqbsuguqtbujowx`）に `supabase db push` で反映し、クラウド上で次を確かめた。手順は [supabase/README.md](../../../supabase/README.md) に残した。

- **反映**：`supabase link` は `supabase login` のアクセストークンで済み、DB パスワードは聞かれなかった。`db push` も CLI が Management API で一時的なログイン用ロールを作って接続するので、パスワードは要らなかった（CLI 2.121.0）。seed は流れず、マスタはマイグレーションで入った。
- **pg_cron**：無料プランでも `create extension pg_cron with schema pg_catalog` が通り、3 つのジョブ（UTC 18:00・18:10・18:20）が登録された。
- **マスタ**：会場 28 件・アイドル 44 件。
- **RLS と権限**：`app` の全テーブルで RLS が有効。`anon`・`authenticated` への grant は 0 件。
- **Data API**：`anon` のキーで `Accept-Profile: app` を付けて `/rest/v1/venues` などを叩くと、503（`PGRST002`：スキーマキャッシュを読めない）でデータは返らない。ダッシュボードで無効にした状態でこのエラーになるのが仕様どおりかは未確認（触れないという目的は満たしている）。
- **config push はしなかった**：`supabase config diff` で、dev の `api.enabled` はすでに手元の `false` と一致していた（作成時にダッシュボードで無効にしたため）。`config push` は `config.toml` に書いてある項目をすべて送り、今の値はローカル用なので、push すると dev の Auth が書き換わる（メール確認 true → false、TOTP の MFA が無効、`site_url` が `127.0.0.1:3000`、`storage.vector.enabled` が true など）。目的は果たされているので行わず、ローカルと dev の設定の分け方は匿名サインインを有効にするとき（バックエンド＋インフラ）に決めるよう、メタマップの申し送りに足した。
- **sekirepo_api**：SQL Editor でパスワードを設定し、Chrome のパスワードマネージャーに保存した。Supavisor の transaction mode（`aws-0-ap-northeast-1.pooler.supabase.com:6543`）に `sekirepo_api.ekbitoqbsuguqtbujowx` でログインでき、`app.venues` の読み取りと `app.idols` への追加ができた。`app.idols` の更新と `auth.users` の読み取りは `permission denied` で拒否された（どちらも設計どおり）。
