# Data API の封鎖と DB ロールの権限

Type: grilling
Status: open
Blocked by: 04, 05

## Question

ADR 0002 で決めた「フロントから直接呼ぶのは認証だけ。Data API からは触れられないようにする」を、具体的な設定と権限にして、マイグレーション（と必要なら `config.toml`）に書く。
- Data API からアプリのテーブルを見えなくする方法（スキーマを公開しない、`anon`・`authenticated` から権限を外す、またはその両方）。
- Go の API が接続する DB ロール：`postgres` を使うか、必要な権限だけを持つ専用のロールを作るか。
- RLS を保険として有効にするか（Data API を塞いだうえで、さらに RLS を有効にして「ポリシーなし＝すべて拒否」にする、など）。
- 塞げていることをどう確かめるか（ローカルで `anon` のキーを使って REST を叩くテストなど）。

補足（Supabase の無料プランで使える機能の調査から）：Data API は `config.toml` の `[api] enabled = false` を `supabase config push` で送れば丸ごと無効にでき、コードで管理できる。既存プロジェクトでは 2026-10-30 より前に作ったテーブルに anon などへの grant が残るので revoke が要る（prod を作り直すなら関係しない）。公式は専用のロールを勧めており、プーラー経由のユーザー名は `[ROLE].[PROJECT-REF]`。ローカルは `supabase/roles.sql`、クラウドは `db push --include-roles` で作る。RLS を有効にしてポリシーがないと専用ロールは読めないので、`bypassrls` かポリシーが要る。専用ロールのパスワードをどう管理するかもここで決める。
