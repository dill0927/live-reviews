# データストアと認証基盤の選定

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

ゼロベースで、データストアと認証基盤に何を使うか決める。Supabase（Postgres＋Auth）継続／一部だけ AWS に移す（例：Auth を Cognito に）／完全に AWS に移す（例：Aurora DSQL・DynamoDB＋Cognito）を、コスト・複雑さ・ポートフォリオとしての説明しやすさで比較する。

## Answer

ADR：[認証と DB には Supabase を使い続ける](../../../docs/adr/0002-keep-supabase-for-auth-and-db.md)
調査：[docs/research/datastore-auth-options.md](../../../docs/research/datastore-auth-options.md)（Supabase の一時停止、Cognito、Aurora DSQL、Neon などの比較）

- **判断基準の優先順位**：固定費ゼロ → 運用の手間 → AWS での統一 → 学習価値。
- **ログイン方法**：メールとパスワード、Google、X の 3 つを残す。
- **認証**：Supabase Auth。Cognito は X ログインに対応していないため採らない。
- **DB**：Supabase の Postgres。データはリレーショナルなので DynamoDB はメインの保存先の候補から外す。Aurora DSQL と Neon は、認証が Supabase に残るため利点が小さい。
- **Go からの接続**：Supavisor（transaction mode）経由。
- **フロントから直接呼ぶ範囲**：認証だけ。DB の読み書きはすべて Go の API を通し、Data API からは `public` スキーマに触れられないようにする。
- **一時停止への対策**：GitHub Actions の cron で、API のヘルスチェック（DB に軽いクエリを流す）を週 1〜2 回呼ぶ。
- 申し送り（インフラのマップ）：定期アクセスが Supabase の利用規約上問題ないかを確認する。停止中の API が HTTP 540 を返すので、その場合のエラー表示も考える。
- 申し送り（「匿名投稿の不正対策の決定」）：IP 単位の流量制限に使うカウンタの置き場所の第一候補は、Supabase の Postgres になる。
