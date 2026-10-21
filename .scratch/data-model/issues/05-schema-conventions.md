# スキーマ全体の規約

Type: grilling
Status: open
Blocked by: 01, 04

## Question

すべてのテーブルに共通する規約を決め、最初のマイグレーション（拡張機能の有効化、共通の関数など）を書く。
- テーブルを置くスキーマ：`public` か、アプリ専用のスキーマ（例：`app`）か。Data API の封鎖のしやすさ（調査の結果）とあわせて決める。
- 名前の付け方：用語集に合わせる（例：座席レポは `seat_reports`）。複数形か単数形か。
- ID の型：`uuid`（v4 / v7）か、`bigint` の identity か。URL に出る ID かどうかも考える。
- `created_at` / `updated_at` の持ち方と、`updated_at` を自動で更新するトリガー。
- 削除の方針：物理削除か論理削除（`deleted_at`）か。
- 文字列の長さなどの制約を DB の `check` で持つか、Go の検証だけにするか。

補足（Supabase の無料プランで使える機能の調査から）：マイグレーションで作ったテーブルは RLS が既定で無効。`ensure_rls` のイベントトリガーを入れるか、マイグレーションごとに明示するかは、ここか「Data API の封鎖と DB ロールの権限」で決める。2026-10-30 以降、`public` の新しいテーブルは anon などに自動で grant されなくなる。
