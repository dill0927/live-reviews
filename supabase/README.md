# supabase

DB のマイグレーション（`migrations/`）と pgTAP のテスト（`tests/`）を置く。テーブルは `app` スキーマにあり、Data API からは触れない（ADR 0007・0008）。会場とアイドルのマスタもマイグレーションで入る（ADR 0009）。

## ローカル

```zsh
supabase start
make db-reset   # マイグレーションを流し直し、sekirepo_api にローカル用のパスワードを設定する
make db-test    # pgTAP のテスト
```

## dev への反映

dev は re-sekirepo-dev（`ekbitoqbsuguqtbujowx`）。prod（re-sekirepo）への反映は CI/CD で行うので、手元からは行わない。

```zsh
supabase link --project-ref ekbitoqbsuguqtbujowx   # supabase login 済みならパスワードは不要
supabase db push --dry-run                          # 流すマイグレーションを確かめる
supabase db push
```

`supabase/.temp/project-ref` がリンク先になる。push の前に、ここが dev の ref であることを確かめる。

反映後の確認：

```zsh
supabase db query --linked "select count(*) from app.venues"   # 28
supabase db query --linked "select jobname, schedule from cron.job"
```

### config push はしない

`supabase config push` は `config.toml` に書いてある項目をすべて送る（`api` だけを選べない）。今の `config.toml` はローカル用の値（メール確認なし、`site_url` が `127.0.0.1` など）なので、push すると dev の Auth の設定を上書きする。Data API は dev の作成時にダッシュボードで無効にしてあり、`[api] enabled = false` と一致している（`supabase config diff` で確かめられる）。

## sekirepo_api のパスワード（dev を作り直したときだけ）

ダッシュボードの SQL Editor で設定し、Chrome のパスワードマネージャーに保存する。リポジトリには書かない。

```sql
alter role sekirepo_api password '<生成したパスワード>';
```

Supavisor の transaction mode（6543 番ポート）で接続できることを確かめる。ユーザー名は `<ロール>.<プロジェクトの ref>` の形にする。

```zsh
psql "postgresql://sekirepo_api.ekbitoqbsuguqtbujowx@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
```
