# dev と prod の Supabase プロジェクトの用意

Type: task（HITL）
Status: open
Blocked by: 02

## Question

「既存の Supabase プロジェクトの確認とマスタの退避」の結果をもとに、次を行う。
- prod：今の re-sekirepo（東京・Postgres 17）をそのまま使い、署名鍵を HS256 から非対称鍵に移行する（作り直しは不要と確定）。
- 一時停止中の古いプロジェクト live-reviews（ref `dijapmjyqzdspjwdxyge`）を削除するか残すか。dev を作るときに、無料プランのプロジェクト数の上限に引っかかるかどうかも確かめる。
- dev：無料枠の 2 つ目のプロジェクトとして、東京リージョンで作る。
- 両方のプロジェクトの ref、URL、接続文字列（Supavisor の transaction mode）の保管場所を記録する（値そのものはリポジトリに書かない）。

既存プロジェクトの作り直しや削除は元に戻せないので、手順をユーザーに渡して実行してもらう。
