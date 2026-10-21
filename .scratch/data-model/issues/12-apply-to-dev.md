# dev への反映と確認

Type: task（HITL）
Status: open
Blocked by: 03, 06, 10, 11

## Question

ここまでのマイグレーションと seed を、dev の Supabase プロジェクトに `supabase db push` で反映し、クラウド上でも意図どおりに動くかを確かめる。
- Data API（`anon` のキー）からアプリのテーブルに触れないこと
- `pg_cron` のジョブが登録されていること
- 会場とアーティストの seed が入っていること

反映の手順（`supabase link` など）を README か docs に残す。prod への反映は行わない（CI/CD のマップで扱う）。

補足（Supabase の無料プランで使える機能の調査から）：実機で確かめることとして、`create extension pg_cron` が無料プランで通るか、`config push` 後に Data API が本当に無効になるか、transaction mode（6543 番ポート）で専用ロールでログインできるか、を加える。
