# アプリのテーブルは public ではなく app スキーマに置く

新しいデータモデルのテーブルは、Supabase の標準の `public` スキーマではなく、アプリ専用の `app` スキーマに置く。決め手は、prod の `public` に今のフロントが使っているテーブル（`venues`・`artists`・`users`・`likes`・`reviews`）が残っていること。`app` に置けば、新しいテーブルを prod に並べて作り、データを移してから切り替える、という順番がとれる。また Data API は `config.toml` の `schemas` に書いたスキーマしか公開しないので、`app` は何もしなくても Data API から見えない（ADR 0002 の「Data API から触れない」が既定の状態になる）。

## Considered Options

- **public に置く**：Supabase の標準で、ダッシュボードやドキュメントの例をそのまま使える。ただし prod では同じ名前のテーブルとぶつかるので、切り替えの日に古いテーブルを消してから作り直すことになる。Data API から見えないようにするのも、設定や権限の取り消しに頼ることになる。

## Consequences

- Go の接続ロールには、`app` スキーマの usage とテーブルの権限を明示的に与え、`search_path` を `app` にする（「Data API の封鎖と DB ロールの権限」で扱う）。
- `config.toml` の `[api] schemas` に `app` を加えてはいけない。
- 切り替えが終わったら、prod の `public` に残った古いテーブルを削除する。
